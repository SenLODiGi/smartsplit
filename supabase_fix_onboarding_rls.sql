-- ==============================================================================
-- SMARTSPLIT: ONBOARDING & GROUP MEMBERS ROW LEVEL SECURITY (RLS) FIX
-- File: supabase_fix_onboarding_rls.sql
-- Description:
--   1. Fixes the chicken-and-egg RLS paradox on public.group_members where
--      newly registered users cannot insert their initial admin membership.
--   2. Provides atomic RPC create_group_with_creator for transactional creation.
--   3. Ensures invited/placeholder members can be stored safely.
-- ==============================================================================

-- 1. Ensure columns exist and constraints support onboarding
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'trip';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS cover_gradient TEXT DEFAULT 'from-blue-600 to-indigo-800';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS email TEXT;
-- Allow guest/invited members who do not have an auth.users account yet
ALTER TABLE public.group_members ALTER COLUMN user_id DROP NOT NULL;

-- 2. Security Helper Functions (SECURITY DEFINER with safe search_path)
CREATE OR REPLACE FUNCTION public.is_group_member(gid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.groups WHERE id = gid AND created_by = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.group_members WHERE group_id = gid AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(gid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.groups WHERE id = gid AND created_by = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.group_members WHERE group_id = gid AND user_id = auth.uid() AND role = 'admin'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_group_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_admin(UUID) TO authenticated;

-- 3. Row Level Security for public.groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members and creators can view groups" ON public.groups;
DROP POLICY IF EXISTS "Members can view their groups" ON public.groups;
CREATE POLICY "Members and creators can view groups"
    ON public.groups FOR SELECT TO authenticated
    USING (
        auth.uid() IS NOT NULL
        AND (
            created_by = auth.uid()
            OR public.is_group_member(id)
        )
    );

DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
CREATE POLICY "Authenticated users can create groups"
    ON public.groups FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND created_by = auth.uid()
    );

DROP POLICY IF EXISTS "Admins and creators can update groups" ON public.groups;
DROP POLICY IF EXISTS "Members can update their groups" ON public.groups;
CREATE POLICY "Admins and creators can update groups"
    ON public.groups FOR UPDATE TO authenticated
    USING (
        auth.uid() IS NOT NULL
        AND (
            created_by = auth.uid()
            OR public.is_group_admin(id)
        )
    );

DROP POLICY IF EXISTS "Creators can delete their groups" ON public.groups;
DROP POLICY IF EXISTS "Admins or creators can delete groups" ON public.groups;
CREATE POLICY "Creators can delete their groups"
    ON public.groups FOR DELETE TO authenticated
    USING (
        auth.uid() IS NOT NULL
        AND created_by = auth.uid()
    );

-- 4. Row Level Security for public.group_members (THE CORE FIX)
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Drop all conflicting legacy policies
DROP POLICY IF EXISTS "Members can view members in their groups" ON public.group_members;
DROP POLICY IF EXISTS "Members and creators can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Admins can add or invite group members" ON public.group_members;
DROP POLICY IF EXISTS "Members can add or invite group members" ON public.group_members;
DROP POLICY IF EXISTS "Creators and admins can add group members" ON public.group_members;
DROP POLICY IF EXISTS "Admins can update group members" ON public.group_members;
DROP POLICY IF EXISTS "Admins and creators can update group members" ON public.group_members;
DROP POLICY IF EXISTS "Members can leave or admins can remove members" ON public.group_members;
DROP POLICY IF EXISTS "Admins can remove members or members can leave" ON public.group_members;
DROP POLICY IF EXISTS "Admins and creators can remove members" ON public.group_members;

-- SELECT POLICY: Members and creators can view group members
CREATE POLICY "Members and creators can view group members"
    ON public.group_members FOR SELECT TO authenticated
    USING (
        auth.uid() IS NOT NULL
        AND (
            user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.groups g
                WHERE g.id = group_members.group_id
                AND g.created_by = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM public.group_members gm
                WHERE gm.group_id = group_members.group_id
                AND gm.user_id = auth.uid()
            )
        )
    );

-- INSERT POLICY: Allow group creator to add themselves as initial admin AND allow admins/creators to invite others
CREATE POLICY "Creators and admins can add group members"
    ON public.group_members FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND (
            -- 1. Initial Group Creator registering themselves as Admin
            (
                user_id = auth.uid()
                AND role = 'admin'
                AND EXISTS (
                    SELECT 1 FROM public.groups g
                    WHERE g.id = group_members.group_id
                    AND g.created_by = auth.uid()
                )
            )
            -- 2. Group Creator adding other members (registered or invited guests)
            OR EXISTS (
                SELECT 1 FROM public.groups g2
                WHERE g2.id = group_members.group_id
                AND g2.created_by = auth.uid()
            )
            -- 3. Existing Group Admin adding other members
            OR EXISTS (
                SELECT 1 FROM public.group_members gm2
                WHERE gm2.group_id = group_members.group_id
                AND gm2.user_id = auth.uid()
                AND gm2.role = 'admin'
            )
        )
    );

-- UPDATE POLICY: Admins and creators can update members
CREATE POLICY "Admins and creators can update group members"
    ON public.group_members FOR UPDATE TO authenticated
    USING (
        auth.uid() IS NOT NULL
        AND (
            EXISTS (
                SELECT 1 FROM public.groups g
                WHERE g.id = group_members.group_id
                AND g.created_by = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM public.group_members gm
                WHERE gm.group_id = group_members.group_id
                AND gm.user_id = auth.uid()
                AND gm.role = 'admin'
            )
        )
    );

-- DELETE POLICY: Members can leave their own membership, or admins/creators can remove members
CREATE POLICY "Admins and creators can remove members"
    ON public.group_members FOR DELETE TO authenticated
    USING (
        auth.uid() IS NOT NULL
        AND (
            user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.groups g
                WHERE g.id = group_members.group_id
                AND g.created_by = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM public.group_members gm
                WHERE gm.group_id = group_members.group_id
                AND gm.user_id = auth.uid()
                AND gm.role = 'admin'
            )
        )
    );

-- 5. ATOMIC RPC FUNCTION: create_group_with_creator
CREATE OR REPLACE FUNCTION public.create_group_with_creator(
    p_name TEXT,
    p_description TEXT DEFAULT '',
    p_currency TEXT DEFAULT 'LKR',
    p_category TEXT DEFAULT 'trip',
    p_cover_gradient TEXT DEFAULT 'from-blue-600 to-indigo-800',
    p_member_names TEXT[] DEFAULT '{}'::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_group_id UUID;
    v_member_name TEXT;
    v_matched_user_id UUID;
    v_result JSONB;
BEGIN
    -- 1. Validate authenticated caller
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated: An authenticated user is required to create a group.';
    END IF;

    -- 2. Validate input parameters
    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        RAISE EXCEPTION 'Group name cannot be empty.';
    END IF;

    -- 3. Ensure creator profile exists in profiles table
    INSERT INTO public.profiles (id, email, full_name, name)
    SELECT 
        v_user_id,
        u.email,
        COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
        COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
    FROM auth.users u
    WHERE u.id = v_user_id
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
        name = COALESCE(profiles.name, EXCLUDED.name);

    -- 4. Create the group record
    BEGIN
        INSERT INTO public.groups (name, description, currency, category, cover_gradient, created_by)
        VALUES (TRIM(p_name), COALESCE(TRIM(p_description), ''), UPPER(COALESCE(p_currency, 'LKR')), COALESCE(p_category, 'trip'), COALESCE(p_cover_gradient, 'from-blue-600 to-indigo-800'), v_user_id)
        RETURNING id INTO v_group_id;
    EXCEPTION WHEN undefined_column THEN
        INSERT INTO public.groups (name, description, currency, created_by)
        VALUES (TRIM(p_name), COALESCE(TRIM(p_description), ''), UPPER(COALESCE(p_currency, 'LKR')), v_user_id)
        RETURNING id INTO v_group_id;
    END;

    -- 5. Add creator as initial admin in group_members (Atomic guarantee)
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (v_group_id, v_user_id, 'admin')
    ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'admin';

    -- 6. Add invited initial members
    IF p_member_names IS NOT NULL AND array_length(p_member_names, 1) > 0 THEN
        FOREACH v_member_name IN ARRAY p_member_names LOOP
            v_member_name := TRIM(v_member_name);
            IF v_member_name <> '' THEN
                -- Check if matching registered user exists
                SELECT id INTO v_matched_user_id
                FROM public.profiles
                WHERE LOWER(email) = LOWER(v_member_name)
                   OR LOWER(full_name) = LOWER(v_member_name)
                   OR LOWER(name) = LOWER(v_member_name)
                LIMIT 1;

                IF v_matched_user_id IS NOT NULL AND v_matched_user_id <> v_user_id THEN
                    INSERT INTO public.group_members (group_id, user_id, role)
                    VALUES (v_group_id, v_matched_user_id, 'member')
                    ON CONFLICT DO NOTHING;
                ELSE
                    -- Guest/placeholder member without fake user_id
                    BEGIN
                        INSERT INTO public.group_members (group_id, display_name, role)
                        VALUES (v_group_id, v_member_name, 'member');
                    EXCEPTION WHEN OTHERS THEN
                        NULL;
                    END;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 7. Log creation activity
    BEGIN
        INSERT INTO public.activities (group_id, type, actor_name, description)
        VALUES (v_group_id, 'group_created', 'Admin', 'created the group');
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 8. Return JSON representation
    SELECT jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'description', g.description,
        'currency', g.currency,
        'created_by', g.created_by,
        'created_at', g.created_at
    ) INTO v_result
    FROM public.groups g
    WHERE g.id = v_group_id;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group_with_creator TO authenticated;

-- 6. SAFE REPAIR: Backfill missing admin memberships for existing groups
-- Ensures any group previously created where membership failed is restored with creator as admin
INSERT INTO public.group_members (group_id, user_id, role)
SELECT g.id, g.created_by, 'admin'
FROM public.groups g
WHERE g.created_by IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = g.id AND gm.user_id = g.created_by
  )
ON CONFLICT (group_id, user_id) DO NOTHING;

