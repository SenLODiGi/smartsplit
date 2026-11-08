-- ============================================================================
-- SMART EXPENSE SPLITTER — GROUP CREATION & RETRIEVAL FIX
-- Resolves foreign key schema cache issues, ensures atomic group creation,
-- and configures complete RLS policies for groups and group_members.
-- ============================================================================

-- 1. Profiles Table Enhancements
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS initials TEXT DEFAULT 'U';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'LKR';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Sync name <-> full_name and avatar <-> avatar_url
UPDATE public.profiles SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL;
UPDATE public.profiles SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;
UPDATE public.profiles SET avatar = avatar_url WHERE avatar IS NULL AND avatar_url IS NOT NULL;
UPDATE public.profiles SET avatar_url = avatar WHERE avatar_url IS NULL AND avatar IS NOT NULL;

-- 2. Groups Table Schema Enhancements
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'LKR';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'trip';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS cover_gradient TEXT DEFAULT 'from-emerald-600 to-teal-800';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Group Members Table Schema Enhancements
ALTER TABLE public.group_members ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS invited_name TEXT;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS invited_email TEXT;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();

-- Foreign Key Constraints for PostgREST schema cache
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_groups_created_by_profiles'
    ) THEN
        BEGIN
            ALTER TABLE public.groups 
            ADD CONSTRAINT fk_groups_created_by_profiles 
            FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
        EXCEPTION WHEN OTHERS THEN
            -- Profiles might not contain all past auth users yet, safe to ignore
        END;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_group_members_user_id_profiles'
    ) THEN
        BEGIN
            ALTER TABLE public.group_members 
            ADD CONSTRAINT fk_group_members_user_id_profiles 
            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
        EXCEPTION WHEN OTHERS THEN
            -- Safe to ignore if orphan rows exist
        END;
    END IF;
END $$;

-- Drop legacy unique constraint on (group_id, user_id) if present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'group_members_group_id_user_id_key'
    ) THEN
        ALTER TABLE public.group_members DROP CONSTRAINT group_members_group_id_user_id_key;
    END IF;
END $$;

-- Partial unique index for registered users (allows multiple invited members with null user_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_unique_user 
ON public.group_members(group_id, user_id) 
WHERE user_id IS NOT NULL;

-- 4. Row Level Security Policies for Groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their groups" ON public.groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Members can update their groups" ON public.groups;
DROP POLICY IF EXISTS "Admins or creators can delete groups" ON public.groups;

CREATE POLICY "Members can view their groups"
    ON public.groups FOR SELECT TO authenticated
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = groups.id AND gm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create groups"
    ON public.groups FOR INSERT TO authenticated
    WITH CHECK (
        created_by = auth.uid() OR created_by IS NULL
    );

CREATE POLICY "Members can update their groups"
    ON public.groups FOR UPDATE TO authenticated
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = groups.id AND gm.user_id = auth.uid() AND gm.role = 'admin'
        )
    );

CREATE POLICY "Admins or creators can delete groups"
    ON public.groups FOR DELETE TO authenticated
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = groups.id AND gm.user_id = auth.uid() AND gm.role = 'admin'
        )
    );

-- 5. Row Level Security Policies for Group Members
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view members in their groups" ON public.group_members;
DROP POLICY IF EXISTS "Members can add or invite group members" ON public.group_members;
DROP POLICY IF EXISTS "Admins can add or invite group members" ON public.group_members;
DROP POLICY IF EXISTS "Members can leave or admins can remove members" ON public.group_members;
DROP POLICY IF EXISTS "Admins can remove members or members can leave" ON public.group_members;
DROP POLICY IF EXISTS "Admins can update group members" ON public.group_members;

CREATE POLICY "Members can view members in their groups"
    ON public.group_members FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = group_members.group_id AND g.created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.group_members gm2
            WHERE gm2.group_id = group_members.group_id AND gm2.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can add or invite group members"
    ON public.group_members FOR INSERT TO authenticated
    WITH CHECK (
        -- Authenticated creator adding themselves as member during group creation
        (user_id = auth.uid() AND EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = group_members.group_id AND g.created_by = auth.uid()
        ))
        -- Group creator adding invited members
        OR EXISTS (
            SELECT 1 FROM public.groups g2
            WHERE g2.id = group_members.group_id AND g2.created_by = auth.uid()
        )
        -- Group admin adding members
        OR EXISTS (
            SELECT 1 FROM public.group_members gm3
            WHERE gm3.group_id = group_members.group_id AND gm3.user_id = auth.uid() AND gm3.role = 'admin'
        )
    );

CREATE POLICY "Admins can update group members"
    ON public.group_members FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = group_members.group_id AND g.created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
        )
    );

CREATE POLICY "Admins can remove members or members can leave"
    ON public.group_members FOR DELETE TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = group_members.group_id AND g.created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
        )
    );

-- 6. Atomic Stored Procedure: create_group_with_creator
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
SET search_path = public
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

    -- Ensure creator profile exists
    INSERT INTO public.profiles (id, email, full_name, name)
    SELECT 
        u.id, 
        u.email, 
        COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
        COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
    FROM auth.users u
    WHERE u.id = v_user_id
    ON CONFLICT (id) DO UPDATE 
    SET 
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        name = COALESCE(public.profiles.name, EXCLUDED.name);

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
    VALUES (v_group_id, v_user_id, 'admin')
    ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'admin';

    -- 3. Insert Initial Member Names if provided
    IF p_member_names IS NOT NULL AND array_length(p_member_names, 1) > 0 THEN
        FOREACH v_name IN ARRAY p_member_names LOOP
            v_name := trim(v_name);
            IF v_name <> '' THEN
                SELECT id INTO v_matched_user_id
                FROM public.profiles
                WHERE lower(email) = lower(v_name) 
                   OR lower(COALESCE(name, full_name)) = lower(v_name)
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

    -- 4. Audit Activity (if activities table exists)
    BEGIN
        SELECT COALESCE(name, full_name, 'Creator') INTO v_user_name FROM public.profiles WHERE id = v_user_id;
        INSERT INTO public.activities (group_id, type, actor_id, actor_name, description)
        VALUES (
            v_group_id,
            'group_created',
            v_user_id,
            COALESCE(v_user_name, 'Creator'),
            'created group "' || trim(p_name) || '"'
        );
    EXCEPTION WHEN OTHERS THEN
        -- Activity logging non-blocking
    END;

    -- 5. Construct full JSON response
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

