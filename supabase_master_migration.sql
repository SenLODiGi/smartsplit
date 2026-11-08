-- ============================================================================
-- SMARTSPLIT — ALL-IN-ONE MASTER DATABASE MIGRATION
-- Safe & Idempotent: Run this once in the Supabase SQL Editor.
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 2. USER PROFILES
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS initials TEXT DEFAULT 'U';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'LKR';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Sync name and full_name columns
UPDATE public.profiles SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL;
UPDATE public.profiles SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;
UPDATE public.profiles SET avatar = avatar_url WHERE avatar IS NULL AND avatar_url IS NOT NULL;
UPDATE public.profiles SET avatar_url = avatar WHERE avatar_url IS NULL AND avatar IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. GROUPS
-- ----------------------------------------------------------------------------
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'LKR';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'trip';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS cover_gradient TEXT DEFAULT 'from-emerald-600 to-teal-800';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ----------------------------------------------------------------------------
-- 4. GROUP MEMBERS (Enable Invited Guests)
-- ----------------------------------------------------------------------------
ALTER TABLE public.group_members ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS invited_name TEXT;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS invited_email TEXT;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();

-- Remove legacy unique constraint on (group_id, user_id) to allow guest members with NULL user_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'group_members_group_id_user_id_key'
    ) THEN
        ALTER TABLE public.group_members DROP CONSTRAINT group_members_group_id_user_id_key;
    END IF;
END $$;

-- Enforce uniqueness only for registered users who have a user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_unique_registered_user 
ON public.group_members(group_id, user_id) 
WHERE user_id IS NOT NULL;

-- Prevent duplicate email invitations within the same group
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_unique_invited_email
ON public.group_members(group_id, lower(invited_email))
WHERE invited_email IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. EXPENSES
-- ----------------------------------------------------------------------------
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payer_name TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'food';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS split_method TEXT DEFAULT 'equal';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT DEFAULT '';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- ----------------------------------------------------------------------------
-- 6. MULTIPLE PAYERS (expense_payments)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    user_id UUID,
    member_id UUID,
    payer_name TEXT NOT NULL,
    amount NUMERIC(12, 2) DEFAULT 0,
    amount_paid NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expense_payments ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.expense_payments ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_expense_payments_expense_id ON public.expense_payments(expense_id);

-- ----------------------------------------------------------------------------
-- 7. EXPENSE SPLITS (Per-Member Split Liability)
-- ----------------------------------------------------------------------------
ALTER TABLE public.expense_splits ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS member_id UUID;
ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS invited_name TEXT;
ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS percentage NUMERIC(5, 2);
ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS shares NUMERIC(5, 2);

-- Drop legacy unique constraint on (expense_id, user_id) if present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'expense_splits_expense_id_user_id_key'
    ) THEN
        ALTER TABLE public.expense_splits DROP CONSTRAINT expense_splits_expense_id_user_id_key;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. EXPENSE ITEMS & ITEM ASSIGNMENTS (OCR & Itemized Splitting)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity NUMERIC(8, 2) DEFAULT 1 NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL,
    confidence NUMERIC(4, 3) DEFAULT 0.98,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expense_item_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.expense_items(id) ON DELETE CASCADE,
    user_id UUID,
    member_id UUID,
    invited_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8.5 SETTLEMENT PAYMENTS (Peer-to-Peer Debt Paydowns)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settlement_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    payer_id UUID,
    payee_id UUID,
    from_member_id UUID,
    to_member_id UUID,
    payer_name TEXT,
    payee_name TEXT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency TEXT DEFAULT 'LKR',
    payment_method TEXT DEFAULT 'bank_transfer',
    reference_note TEXT DEFAULT '',
    payment_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settlement_payments ADD COLUMN IF NOT EXISTS payer_id UUID;
ALTER TABLE public.settlement_payments ADD COLUMN IF NOT EXISTS payee_id UUID;
ALTER TABLE public.settlement_payments ADD COLUMN IF NOT EXISTS from_member_id UUID;
ALTER TABLE public.settlement_payments ADD COLUMN IF NOT EXISTS to_member_id UUID;
ALTER TABLE public.settlement_payments ADD COLUMN IF NOT EXISTS payer_name TEXT;
ALTER TABLE public.settlement_payments ADD COLUMN IF NOT EXISTS payee_name TEXT;
ALTER TABLE public.settlement_payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'LKR';
ALTER TABLE public.settlement_payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'bank_transfer';
ALTER TABLE public.settlement_payments ADD COLUMN IF NOT EXISTS reference_note TEXT DEFAULT '';
ALTER TABLE public.settlement_payments ADD COLUMN IF NOT EXISTS payment_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.settlement_payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

-- ----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_item_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_payments ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated users can read all profiles and update their own
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read all profiles"
    ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Groups: Accessible by creator or members
DROP POLICY IF EXISTS "Members can view their groups" ON public.groups;
CREATE POLICY "Members can view their groups"
    ON public.groups FOR SELECT TO authenticated
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = groups.id AND gm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
CREATE POLICY "Users can create groups"
    ON public.groups FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Members can update their groups" ON public.groups;
CREATE POLICY "Members can update their groups"
    ON public.groups FOR UPDATE TO authenticated
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = groups.id AND gm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins or creators can delete groups" ON public.groups;
CREATE POLICY "Admins or creators can delete groups"
    ON public.groups FOR DELETE TO authenticated
    USING (created_by = auth.uid());

-- Group Members: Anyone in group can view; members/admins can insert and manage
DROP POLICY IF EXISTS "Members can view members in their groups" ON public.group_members;
CREATE POLICY "Members can view members in their groups"
    ON public.group_members FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Members can add or invite group members" ON public.group_members;
DROP POLICY IF EXISTS "Admins can add or invite group members" ON public.group_members;
CREATE POLICY "Members can add or invite group members"
    ON public.group_members FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update group members" ON public.group_members;
CREATE POLICY "Admins can update group members"
    ON public.group_members FOR UPDATE TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can remove members or members can leave" ON public.group_members;
DROP POLICY IF EXISTS "Members can leave or admins can remove members" ON public.group_members;
CREATE POLICY "Members can leave or admins can remove members"
    ON public.group_members FOR DELETE TO authenticated
    USING (true);

-- Expenses & Splits & Payments
DROP POLICY IF EXISTS "Members can view group expenses" ON public.expenses;
CREATE POLICY "Members can view group expenses" ON public.expenses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Members can insert group expenses" ON public.expenses;
CREATE POLICY "Members can insert group expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Members can update group expenses" ON public.expenses;
CREATE POLICY "Members can update group expenses" ON public.expenses FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Members can delete group expenses" ON public.expenses;
CREATE POLICY "Members can delete group expenses" ON public.expenses FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Members can view expense splits" ON public.expense_splits;
CREATE POLICY "Members can view expense splits" ON public.expense_splits FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Members can insert expense splits" ON public.expense_splits;
CREATE POLICY "Members can insert expense splits" ON public.expense_splits FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Members can update expense splits" ON public.expense_splits;
CREATE POLICY "Members can update expense splits" ON public.expense_splits FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Members can delete expense splits" ON public.expense_splits;
CREATE POLICY "Members can delete expense splits" ON public.expense_splits FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "expense_payments_select" ON public.expense_payments;
CREATE POLICY "expense_payments_select" ON public.expense_payments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "expense_payments_insert" ON public.expense_payments;
CREATE POLICY "expense_payments_insert" ON public.expense_payments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "expense_payments_delete" ON public.expense_payments;
CREATE POLICY "expense_payments_delete" ON public.expense_payments FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "expense_items_all" ON public.expense_items;
CREATE POLICY "expense_items_all" ON public.expense_items FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "expense_item_assignments_all" ON public.expense_item_assignments;
CREATE POLICY "expense_item_assignments_all" ON public.expense_item_assignments FOR ALL TO authenticated USING (true);

-- Settlement payments policies
DROP POLICY IF EXISTS "settlement_payments_select" ON public.settlement_payments;
CREATE POLICY "settlement_payments_select" ON public.settlement_payments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "settlement_payments_insert" ON public.settlement_payments;
CREATE POLICY "settlement_payments_insert" ON public.settlement_payments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "settlement_payments_update" ON public.settlement_payments;
CREATE POLICY "settlement_payments_update" ON public.settlement_payments FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "settlement_payments_delete" ON public.settlement_payments;
CREATE POLICY "settlement_payments_delete" ON public.settlement_payments FOR DELETE TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- SUCCESS CONFIRMATION
-- ----------------------------------------------------------------------------
SELECT 'SmartSplit master migration applied successfully!' AS status;
