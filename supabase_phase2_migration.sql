-- ============================================================================
-- SMART EXPENSE SPLITTER — PHASE 2: GROUP MANAGEMENT MIGRATION
-- ============================================================================

-- 1. Support Invited Members (Who haven't registered yet)
ALTER TABLE public.group_members ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS invited_name TEXT;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS invited_email TEXT;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();

-- Prevent duplicate invites by email within the same group
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_unique_invited_email
ON public.group_members(group_id, lower(invited_email))
WHERE invited_email IS NOT NULL;

-- 2. Security Definer Helper Functions
-- Note: Function parameter name must remain 'gid' to prevent PostgreSQL 42P13
CREATE OR REPLACE FUNCTION public.is_group_member(gid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = gid AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.groups
        WHERE id = gid AND created_by = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_group_admin(gid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = gid AND user_id = auth.uid() AND role = 'admin'
    ) OR EXISTS (
        SELECT 1 FROM public.groups
        WHERE id = gid AND created_by = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Row Level Security Policies for Groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their groups" ON public.groups;
CREATE POLICY "Members can view their groups"
    ON public.groups FOR SELECT TO authenticated
    USING (public.is_group_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
CREATE POLICY "Users can create groups"
    ON public.groups FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Members can update their groups" ON public.groups;
CREATE POLICY "Members can update their groups"
    ON public.groups FOR UPDATE TO authenticated
    USING (public.is_group_admin(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "Admins or creators can delete groups" ON public.groups;
CREATE POLICY "Admins or creators can delete groups"
    ON public.groups FOR DELETE TO authenticated
    USING (created_by = auth.uid() OR public.is_group_admin(id));

-- 4. Row Level Security Policies for Group Members
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view members in their groups" ON public.group_members;
CREATE POLICY "Members can view members in their groups"
    ON public.group_members FOR SELECT TO authenticated
    USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "Members can add or invite group members" ON public.group_members;
DROP POLICY IF EXISTS "Admins can add or invite group members" ON public.group_members;
CREATE POLICY "Admins can add or invite group members"
    ON public.group_members FOR INSERT TO authenticated
    WITH CHECK (
        public.is_group_admin(group_id)
        OR (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid()))
    );

DROP POLICY IF EXISTS "Members can leave or admins can remove members" ON public.group_members;
DROP POLICY IF EXISTS "Admins can remove members or members can leave" ON public.group_members;
CREATE POLICY "Admins can remove members or members can leave"
    ON public.group_members FOR DELETE TO authenticated
    USING (
        public.is_group_admin(group_id)
        OR user_id = auth.uid()
    );

DROP POLICY IF EXISTS "Admins can update group members" ON public.group_members;
CREATE POLICY "Admins can update group members"
    ON public.group_members FOR UPDATE TO authenticated
    USING (public.is_group_admin(group_id));

-- 5. Atomic RPC: Create Group with Creator and Initial Members in one transaction
CREATE OR REPLACE FUNCTION public.create_group_with_creator(
    p_name TEXT,
    p_description TEXT DEFAULT '',
    p_currency TEXT DEFAULT 'LKR',
    p_category TEXT DEFAULT 'trip',
    p_cover_gradient TEXT DEFAULT 'from-emerald-600 to-teal-800',
    p_member_names TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_group_id UUID;
    v_user_id UUID;
    v_user_name TEXT;
    v_name TEXT;
    v_matched_user_id UUID;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Insert Group
    INSERT INTO public.groups (
        name,
        description,
        currency,
        category,
        cover_gradient,
        created_by
    )
    VALUES (
        trim(p_name),
        trim(COALESCE(p_description, '')),
        upper(trim(COALESCE(p_currency, 'LKR'))),
        COALESCE(p_category, 'trip'),
        COALESCE(p_cover_gradient, 'from-emerald-600 to-teal-800'),
        v_user_id
    )
    RETURNING id INTO v_group_id;

    -- 2. Insert Creator as Admin
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (v_group_id, v_user_id, 'admin');

    -- 3. Insert Initial Member Names if provided
    IF p_member_names IS NOT NULL AND array_length(p_member_names, 1) > 0 THEN
        FOREACH v_name IN ARRAY p_member_names LOOP
            v_name := trim(v_name);
            IF v_name <> '' THEN
                -- Look up if member is already a registered user
                SELECT id INTO v_matched_user_id
                FROM public.profiles
                WHERE lower(email) = lower(v_name) OR lower(name) = lower(v_name)
                LIMIT 1;

                IF v_matched_user_id IS NOT NULL AND v_matched_user_id <> v_user_id THEN
                    INSERT INTO public.group_members (group_id, user_id, role)
                    VALUES (v_group_id, v_matched_user_id, 'member')
                    ON CONFLICT DO NOTHING;
                ELSIF v_matched_user_id IS NULL THEN
                    IF v_name LIKE '%@%' THEN
                        INSERT INTO public.group_members (group_id, invited_email, invited_name, role)
                        VALUES (v_group_id, lower(v_name), split_part(v_name, '@', 1), 'member')
                        ON CONFLICT DO NOTHING;
                    ELSE
                        INSERT INTO public.group_members (group_id, invited_name, role)
                        VALUES (v_group_id, v_name, 'member');
                    END IF;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 4. Audit Activity
    SELECT name INTO v_user_name FROM public.profiles WHERE id = v_user_id;
    INSERT INTO public.activities (group_id, type, actor_name, description)
    VALUES (
        v_group_id,
        'group_created',
        COALESCE(v_user_name, 'Creator'),
        'created group "' || trim(p_name) || '"'
    );

    -- 5. Return JSON Representation
    SELECT jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'description', g.description,
        'currency', g.currency,
        'category', g.category,
        'cover_gradient', g.cover_gradient,
        'created_by', g.created_by,
        'created_at', g.created_at
    ) INTO v_result
    FROM public.groups g
    WHERE g.id = v_group_id;

    RETURN v_result;
END;
$$;

