-- ============================================================================
-- SMART EXPENSE SPLITTER — PHASE 4: RECEIPT OCR & STORAGE MIGRATION
-- ============================================================================

-- 1. Create Private Storage Bucket for Receipts
-- Ensures receipt files are never publicly exposed to unauthorized users
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts',
    'receipts',
    false,
    15728640, -- 15MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE 
SET public = false,
    file_size_limit = 15728640,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Storage Row Level Security (RLS) Policies on storage.objects
-- File Path Format: <group_id>/<timestamp>_receipt.<ext>
-- Enforces that only members of the group can view, upload, or delete receipt photos.

DROP POLICY IF EXISTS "Group members can view receipt images" ON storage.objects;
CREATE POLICY "Group members can view receipt images"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'receipts'
        AND (
            public.is_group_member((storage.foldername(name))[1]::uuid)
            OR owner = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Group members can upload receipt images" ON storage.objects;
CREATE POLICY "Group members can upload receipt images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'receipts'
        AND (
            public.is_group_member((storage.foldername(name))[1]::uuid)
            OR owner = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Group members can delete receipt images" ON storage.objects;
CREATE POLICY "Group members can delete receipt images"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'receipts'
        AND (
            public.is_group_member((storage.foldername(name))[1]::uuid)
            OR owner = auth.uid()
        )
    );

-- 3. Enhance Item Assignments to support both registered users and invited group members
ALTER TABLE public.expense_item_assignments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.expense_item_assignments ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.group_members(id) ON DELETE CASCADE;
ALTER TABLE public.expense_item_assignments ADD COLUMN IF NOT EXISTS invited_name TEXT;

-- Drop legacy unique constraint on (item_id, user_id) if present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'expense_item_assignments_item_id_user_id_key'
    ) THEN
        ALTER TABLE public.expense_item_assignments DROP CONSTRAINT expense_item_assignments_item_id_user_id_key;
    END IF;
END $$;

-- Prevent duplicate assignments for the same person on the same item
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_item_assignments_unique_user
ON public.expense_item_assignments(item_id, user_id)
WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_item_assignments_unique_member
ON public.expense_item_assignments(item_id, member_id)
WHERE member_id IS NOT NULL;

-- 4. RLS for expense_items and expense_item_assignments
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_item_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view expense items" ON public.expense_items;
CREATE POLICY "Members can view expense items"
    ON public.expense_items FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.expenses 
        WHERE id = expense_items.expense_id AND public.is_group_member(group_id)
    ));

DROP POLICY IF EXISTS "Members can insert expense items" ON public.expense_items;
CREATE POLICY "Members can insert expense items"
    ON public.expense_items FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.expenses 
        WHERE id = expense_items.expense_id AND public.is_group_member(group_id)
    ));

DROP POLICY IF EXISTS "Members can update expense items" ON public.expense_items;
CREATE POLICY "Members can update expense items"
    ON public.expense_items FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.expenses 
        WHERE id = expense_items.expense_id AND public.is_group_member(group_id)
    ));

DROP POLICY IF EXISTS "Members can delete expense items" ON public.expense_items;
CREATE POLICY "Members can delete expense items"
    ON public.expense_items FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.expenses 
        WHERE id = expense_items.expense_id AND public.is_group_member(group_id)
    ));

DROP POLICY IF EXISTS "Members can view item assignments" ON public.expense_item_assignments;
CREATE POLICY "Members can view item assignments"
    ON public.expense_item_assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Members can insert item assignments" ON public.expense_item_assignments;
CREATE POLICY "Members can insert item assignments"
    ON public.expense_item_assignments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Members can delete item assignments" ON public.expense_item_assignments;
CREATE POLICY "Members can delete item assignments"
    ON public.expense_item_assignments FOR DELETE TO authenticated USING (true);

