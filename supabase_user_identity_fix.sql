-- ==============================================================================
-- SMARTSPLIT: USER IDENTITY & SCHEMA SYNCHRONIZATION MIGRATION
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Ensure public.profiles has all expected columns (supporting both naming styles)
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar TEXT,
  ADD COLUMN IF NOT EXISTS initials TEXT,
  ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'LKR',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill name from full_name (or vice versa) and avatar from avatar_url
UPDATE public.profiles
SET 
  name = COALESCE(name, full_name, split_part(email, '@', 1)),
  full_name = COALESCE(full_name, name, split_part(email, '@', 1)),
  avatar = COALESCE(avatar, avatar_url, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'),
  avatar_url = COALESCE(avatar_url, avatar, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'),
  initials = COALESCE(initials, UPPER(SUBSTRING(COALESCE(full_name, name, 'US') FROM 1 FOR 2)));

-- 2. Ensure public.groups has category and cover_gradient columns
ALTER TABLE IF EXISTS public.groups
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'trip',
  ADD COLUMN IF NOT EXISTS cover_gradient TEXT DEFAULT 'from-emerald-600 to-teal-800',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Ensure public.group_members has invited_name and invited_email columns
ALTER TABLE IF EXISTS public.group_members
  ADD COLUMN IF NOT EXISTS invited_name TEXT,
  ADD COLUMN IF NOT EXISTS invited_email TEXT,
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();

-- Allow user_id to be NULL for invited non-registered guests
ALTER TABLE IF EXISTS public.group_members
  ALTER COLUMN user_id DROP NOT NULL;

-- 4. CLEANUP: Remove stray Kasun Perera demo references from real user groups
-- This removes any unwanted Kasun Perera demo membership from groups created by real users
DELETE FROM public.group_members
WHERE 
  (
    user_id::text = 'usr_kasun'
    OR invited_name ILIKE '%Kasun Perera%'
    OR invited_email ILIKE 'kasun.p@example.com'
  )
  AND group_id IN (
    SELECT id FROM public.groups WHERE created_by::text <> 'usr_kasun'
  );

-- 5. Guarantee that group creators exist in group_members as admin for every group
INSERT INTO public.group_members (group_id, user_id, role, joined_at)
SELECT g.id, g.created_by, 'admin', g.created_at
FROM public.groups g
WHERE g.created_by IS NOT NULL
  AND g.created_by::text <> 'usr_kasun'
  AND NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = g.id AND gm.user_id = g.created_by
  )
ON CONFLICT DO NOTHING;

-- 6. Trigger: Synchronize auth.users to public.profiles seamlessly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  extracted_name TEXT;
  extracted_avatar TEXT;
  extracted_initials TEXT;
BEGIN
  extracted_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  extracted_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'avatar',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
  );

  extracted_initials := UPPER(SUBSTRING(extracted_name FROM 1 FOR 2));

  INSERT INTO public.profiles (id, email, full_name, name, avatar_url, avatar, initials, preferred_currency)
  VALUES (
    NEW.id,
    NEW.email,
    extracted_name,
    extracted_name,
    extracted_avatar,
    extracted_avatar,
    extracted_initials,
    'LKR'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    name = COALESCE(public.profiles.name, EXCLUDED.name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    avatar = COALESCE(public.profiles.avatar, EXCLUDED.avatar),
    initials = COALESCE(public.profiles.initials, EXCLUDED.initials),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Secure Atomic RPC for Group Creation with Verified Creator
CREATE OR REPLACE FUNCTION public.create_group_with_creator(
  p_name TEXT,
  p_description TEXT DEFAULT '',
  p_currency TEXT DEFAULT 'LKR',
  p_category TEXT DEFAULT 'trip',
  p_cover_gradient TEXT DEFAULT 'from-emerald-600 to-teal-800',
  p_member_names TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_group_id UUID;
  v_group JSONB;
  v_m_name TEXT;
  v_found_profile RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a group';
  END IF;

  -- Insert group with verified creator
  INSERT INTO public.groups (name, description, currency, category, cover_gradient, created_by)
  VALUES (p_name, p_description, UPPER(p_currency), p_category, p_cover_gradient, v_user_id)
  RETURNING id INTO v_group_id;

  -- Add authenticated creator as admin
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group_id, v_user_id, 'admin')
  ON CONFLICT DO NOTHING;

  -- Add any invited members
  IF p_member_names IS NOT NULL THEN
    FOREACH v_m_name IN ARRAY p_member_names LOOP
      IF TRIM(v_m_name) <> '' THEN
        -- Check if profile exists by email or name
        SELECT id INTO v_found_profile
        FROM public.profiles
        WHERE email ILIKE TRIM(v_m_name)
           OR name ILIKE TRIM(v_m_name)
           OR full_name ILIKE TRIM(v_m_name)
        LIMIT 1;

        IF v_found_profile.id IS NOT NULL AND v_found_profile.id <> v_user_id THEN
          INSERT INTO public.group_members (group_id, user_id, role)
          VALUES (v_group_id, v_found_profile.id, 'member')
          ON CONFLICT DO NOTHING;
        ELSE
          INSERT INTO public.group_members (group_id, invited_name, role)
          VALUES (v_group_id, TRIM(v_m_name), 'member');
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Return created group as JSON
  SELECT to_jsonb(g.*) INTO v_group
  FROM public.groups g
  WHERE g.id = v_group_id;

  RETURN v_group;
END;
$$;
