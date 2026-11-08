-- ============================================================================
-- SMART EXPENSE SPLITTER — PHASE 3: EXPENSE MANAGEMENT MIGRATION
-- ============================================================================

-- 1. Table schema enhancements for Expenses
ALTER TABLE public.expenses ALTER COLUMN payer_id DROP NOT NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payer_name TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payer_member_id UUID REFERENCES public.group_members(id) ON DELETE SET NULL;

-- 2. Table schema enhancements for Expense Splits (Supporting both registered users and invited members)
ALTER TABLE public.expense_splits ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.group_members(id) ON DELETE CASCADE;
ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS invited_name TEXT;

-- Drop legacy unique constraint on (expense_id, user_id) if present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'expense_splits_expense_id_user_id_key'
    ) THEN
        ALTER TABLE public.expense_splits DROP CONSTRAINT expense_splits_expense_id_user_id_key;
    END IF;
END $$;

-- Create unique indexes to prevent duplicate splits for the same person
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_splits_unique_user 
ON public.expense_splits(expense_id, user_id) 
WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_splits_unique_member 
ON public.expense_splits(expense_id, member_id) 
WHERE member_id IS NOT NULL;

-- 3. Row Level Security Policies for Expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view group expenses" ON public.expenses;
CREATE POLICY "Members can view group expenses"
    ON public.expenses FOR SELECT TO authenticated
    USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "Members can insert group expenses" ON public.expenses;
CREATE POLICY "Members can insert group expenses"
    ON public.expenses FOR INSERT TO authenticated
    WITH CHECK (public.is_group_member(group_id));

DROP POLICY IF EXISTS "Members can update group expenses" ON public.expenses;
CREATE POLICY "Members can update group expenses"
    ON public.expenses FOR UPDATE TO authenticated
    USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "Members can delete group expenses" ON public.expenses;
CREATE POLICY "Members can delete group expenses"
    ON public.expenses FOR DELETE TO authenticated
    USING (public.is_group_member(group_id));

-- 4. Row Level Security Policies for Expense Splits
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view expense splits" ON public.expense_splits;
CREATE POLICY "Members can view expense splits"
    ON public.expense_splits FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.expenses 
        WHERE id = expense_splits.expense_id AND public.is_group_member(group_id)
    ));

DROP POLICY IF EXISTS "Members can insert expense splits" ON public.expense_splits;
CREATE POLICY "Members can insert expense splits"
    ON public.expense_splits FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.expenses 
        WHERE id = expense_splits.expense_id AND public.is_group_member(group_id)
    ));

DROP POLICY IF EXISTS "Members can update expense splits" ON public.expense_splits;
CREATE POLICY "Members can update expense splits"
    ON public.expense_splits FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.expenses 
        WHERE id = expense_splits.expense_id AND public.is_group_member(group_id)
    ));

DROP POLICY IF EXISTS "Members can delete expense splits" ON public.expense_splits;
CREATE POLICY "Members can delete expense splits"
    ON public.expense_splits FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.expenses 
        WHERE id = expense_splits.expense_id AND public.is_group_member(group_id)
    ));

-- 5. Row Level Security Policies for Expense Items & Assignments
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

-- 6. Atomic Stored Procedure: create_complete_expense
CREATE OR REPLACE FUNCTION public.create_complete_expense(
    p_group_id UUID,
    p_payer_id UUID,
    p_title TEXT,
    p_amount NUMERIC,
    p_currency TEXT DEFAULT 'LKR',
    p_category TEXT DEFAULT 'food',
    p_expense_date DATE DEFAULT CURRENT_DATE,
    p_split_method TEXT DEFAULT 'equal',
    p_notes TEXT DEFAULT '',
    p_receipt_url TEXT DEFAULT '',
    p_splits JSONB DEFAULT '[]'::jsonb,
    p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expense_id UUID;
    v_caller_id UUID;
    v_resolved_payer_id UUID := NULL;
    v_payer_member_id UUID := NULL;
    v_payer_name TEXT := 'Member';
    v_split_record RECORD;
    v_split_raw_id TEXT;
    v_split_uid UUID;
    v_split_amount NUMERIC;
    v_split_pct NUMERIC;
    v_split_shares NUMERIC;
    v_split_user_id UUID;
    v_split_member_id UUID;
    v_split_name TEXT;
    v_item_record RECORD;
    v_new_item_id UUID;
    v_assigned_user TEXT;
    v_result JSONB;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Validate caller is member of group
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'Not authorized to add expenses to this group';
    END IF;

    -- Resolve payer
    IF p_payer_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_payer_id) THEN
            v_resolved_payer_id := p_payer_id;
            SELECT name INTO v_payer_name FROM public.profiles WHERE id = p_payer_id;
        ELSIF EXISTS (SELECT 1 FROM public.group_members WHERE id = p_payer_id) THEN
            v_payer_member_id := p_payer_id;
            SELECT COALESCE(invited_name, 'Member') INTO v_payer_name FROM public.group_members WHERE id = p_payer_id;
        ELSE
            v_resolved_payer_id := v_caller_id;
            SELECT name INTO v_payer_name FROM public.profiles WHERE id = v_caller_id;
        END IF;
    ELSE
        v_resolved_payer_id := v_caller_id;
        SELECT name INTO v_payer_name FROM public.profiles WHERE id = v_caller_id;
    END IF;

    -- 1. Insert into expenses
    INSERT INTO public.expenses (
        group_id,
        payer_id,
        payer_member_id,
        payer_name,
        title,
        amount,
        currency,
        category,
        expense_date,
        split_method,
        notes,
        receipt_url
    )
    VALUES (
        p_group_id,
        v_resolved_payer_id,
        v_payer_member_id,
        v_payer_name,
        trim(p_title),
        p_amount,
        COALESCE(upper(trim(p_currency)), 'LKR'),
        COALESCE(p_category, 'food'),
        COALESCE(p_expense_date, CURRENT_DATE),
        COALESCE(p_split_method, 'equal'),
        COALESCE(trim(p_notes), ''),
        COALESCE(trim(p_receipt_url), '')
    )
    RETURNING id INTO v_expense_id;

    -- 2. Insert Splits
    IF p_splits IS NOT NULL AND jsonb_array_length(p_splits) > 0 THEN
        FOR v_split_record IN SELECT * FROM jsonb_to_recordset(p_splits) AS x(
            "userId" TEXT,
            "userName" TEXT,
            amount NUMERIC,
            percentage NUMERIC,
            shares NUMERIC
        )
        LOOP
            v_split_raw_id := trim(v_split_record."userId");
            v_split_amount := COALESCE(v_split_record.amount, 0);
            v_split_pct := v_split_record.percentage;
            v_split_shares := v_split_record.shares;
            v_split_name := COALESCE(v_split_record."userName", 'Member');
            v_split_user_id := NULL;
            v_split_member_id := NULL;

            BEGIN
                v_split_uid := v_split_raw_id::UUID;
            EXCEPTION WHEN OTHERS THEN
                v_split_uid := NULL;
            END;

            IF v_split_uid IS NOT NULL THEN
                -- Check if it is a profile
                IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_split_uid) THEN
                    v_split_user_id := v_split_uid;
                -- Check if it is a group member row
                ELSIF EXISTS (SELECT 1 FROM public.group_members WHERE id = v_split_uid) THEN
                    v_split_member_id := v_split_uid;
                    -- If that group member row happens to have a user_id, link it too
                    SELECT user_id, COALESCE(invited_name, v_split_name) 
                    INTO v_split_user_id, v_split_name 
                    FROM public.group_members WHERE id = v_split_uid;
                END IF;
            END IF;

            -- Insert split row
            INSERT INTO public.expense_splits (
                expense_id,
                user_id,
                member_id,
                invited_name,
                amount,
                percentage,
                shares
            )
            VALUES (
                v_expense_id,
                v_split_user_id,
                v_split_member_id,
                v_split_name,
                v_split_amount,
                v_split_pct,
                v_split_shares
            );
        END LOOP;
    END IF;

    -- 3. Insert Items (if itemized)
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item_record IN SELECT * FROM jsonb_to_recordset(p_items) AS y(
            name TEXT,
            quantity NUMERIC,
            "unitPrice" NUMERIC,
            "totalPrice" NUMERIC,
            confidence NUMERIC,
            "assignedTo" JSONB
        )
        LOOP
            INSERT INTO public.expense_items (
                expense_id,
                name,
                quantity,
                unit_price,
                total_price,
                confidence
            )
            VALUES (
                v_expense_id,
                trim(v_item_record.name),
                COALESCE(v_item_record.quantity, 1),
                COALESCE(v_item_record."unitPrice", 0),
                COALESCE(v_item_record."totalPrice", 0),
                COALESCE(v_item_record.confidence, 0.98)
            )
            RETURNING id INTO v_new_item_id;

            -- Assign item to users
            IF v_item_record."assignedTo" IS NOT NULL THEN
                FOR v_assigned_user IN SELECT jsonb_array_elements_text(v_item_record."assignedTo")
                LOOP
                    BEGIN
                        INSERT INTO public.expense_item_assignments (item_id, user_id)
                        VALUES (v_new_item_id, v_assigned_user::UUID)
                        ON CONFLICT DO NOTHING;
                    EXCEPTION WHEN OTHERS THEN
                        -- Ignore non-uuid demo ids
                    END;
                END LOOP;
            END IF;
        END LOOP;
    END IF;

    -- 4. Audit activity log
    INSERT INTO public.activities (
        group_id,
        type,
        actor_id,
        actor_name,
        description,
        amount,
        currency
    )
    VALUES (
        p_group_id,
        'expense_created',
        v_resolved_payer_id,
        COALESCE(v_payer_name, 'A member'),
        'added "' || trim(p_title) || '" (' || COALESCE(p_currency, 'LKR') || ' ' || p_amount || ')',
        p_amount,
        COALESCE(p_currency, 'LKR')
    );

    -- 5. Return complete JSON object
    SELECT jsonb_build_object(
        'id', e.id,
        'group_id', e.group_id,
        'payer_id', e.payer_id,
        'payer_name', e.payer_name,
        'title', e.title,
        'amount', e.amount,
        'currency', e.currency,
        'category', e.category,
        'expense_date', e.expense_date,
        'split_method', e.split_method,
        'notes', e.notes,
        'receipt_url', e.receipt_url,
        'created_at', e.created_at,
        'expense_splits', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', s.id,
                'user_id', s.user_id,
                'member_id', s.member_id,
                'invited_name', s.invited_name,
                'amount', s.amount,
                'percentage', s.percentage,
                'shares', s.shares
            )), '[]'::jsonb)
            FROM public.expense_splits s
            WHERE s.expense_id = e.id
        )
    ) INTO v_result
    FROM public.expenses e
    WHERE e.id = v_expense_id;

    RETURN v_result;
END;
$$;

-- 7. Atomic Stored Procedure: update_complete_expense
CREATE OR REPLACE FUNCTION public.update_complete_expense(
    p_expense_id UUID,
    p_title TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_payer_id UUID,
    p_expense_date DATE,
    p_notes TEXT DEFAULT '',
    p_splits JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_group_id UUID;
    v_caller_id UUID;
    v_resolved_payer_id UUID := NULL;
    v_payer_member_id UUID := NULL;
    v_payer_name TEXT := 'Member';
    v_split_record RECORD;
    v_split_raw_id TEXT;
    v_split_uid UUID;
    v_split_amount NUMERIC;
    v_split_pct NUMERIC;
    v_split_shares NUMERIC;
    v_split_user_id UUID;
    v_split_member_id UUID;
    v_split_name TEXT;
    v_result JSONB;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lookup existing expense
    SELECT group_id INTO v_group_id FROM public.expenses WHERE id = p_expense_id;
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Expense not found';
    END IF;

    -- Validate caller is member
    IF NOT public.is_group_member(v_group_id) THEN
        RAISE EXCEPTION 'Not authorized to edit expenses in this group';
    END IF;

    -- Resolve payer
    IF p_payer_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_payer_id) THEN
            v_resolved_payer_id := p_payer_id;
            SELECT name INTO v_payer_name FROM public.profiles WHERE id = p_payer_id;
        ELSIF EXISTS (SELECT 1 FROM public.group_members WHERE id = p_payer_id) THEN
            v_payer_member_id := p_payer_id;
            SELECT COALESCE(invited_name, 'Member') INTO v_payer_name FROM public.group_members WHERE id = p_payer_id;
        ELSE
            v_resolved_payer_id := v_caller_id;
            SELECT name INTO v_payer_name FROM public.profiles WHERE id = v_caller_id;
        END IF;
    ELSE
        SELECT payer_id, payer_name INTO v_resolved_payer_id, v_payer_name FROM public.expenses WHERE id = p_expense_id;
    END IF;

    -- 1. Update expense
    UPDATE public.expenses
    SET
        title = trim(p_title),
        amount = p_amount,
        category = COALESCE(p_category, category),
        payer_id = v_resolved_payer_id,
        payer_member_id = v_payer_member_id,
        payer_name = v_payer_name,
        expense_date = COALESCE(p_expense_date, expense_date),
        notes = COALESCE(trim(p_notes), notes),
        updated_at = NOW()
    WHERE id = p_expense_id;

    -- 2. Atomically delete and replace splits
    IF p_splits IS NOT NULL AND jsonb_array_length(p_splits) > 0 THEN
        DELETE FROM public.expense_splits WHERE expense_id = p_expense_id;

        FOR v_split_record IN SELECT * FROM jsonb_to_recordset(p_splits) AS x(
            "userId" TEXT,
            "userName" TEXT,
            amount NUMERIC,
            percentage NUMERIC,
            shares NUMERIC
        )
        LOOP
            v_split_raw_id := trim(v_split_record."userId");
            v_split_amount := COALESCE(v_split_record.amount, 0);
            v_split_pct := v_split_record.percentage;
            v_split_shares := v_split_record.shares;
            v_split_name := COALESCE(v_split_record."userName", 'Member');
            v_split_user_id := NULL;
            v_split_member_id := NULL;

            BEGIN
                v_split_uid := v_split_raw_id::UUID;
            EXCEPTION WHEN OTHERS THEN
                v_split_uid := NULL;
            END;

            IF v_split_uid IS NOT NULL THEN
                IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_split_uid) THEN
                    v_split_user_id := v_split_uid;
                ELSIF EXISTS (SELECT 1 FROM public.group_members WHERE id = v_split_uid) THEN
                    v_split_member_id := v_split_uid;
                    SELECT user_id, COALESCE(invited_name, v_split_name) 
                    INTO v_split_user_id, v_split_name 
                    FROM public.group_members WHERE id = v_split_uid;
                END IF;
            END IF;

            INSERT INTO public.expense_splits (
                expense_id,
                user_id,
                member_id,
                invited_name,
                amount,
                percentage,
                shares
            )
            VALUES (
                p_expense_id,
                v_split_user_id,
                v_split_member_id,
                v_split_name,
                v_split_amount,
                v_split_pct,
                v_split_shares
            );
        END LOOP;
    END IF;

    -- 3. Audit Activity
    INSERT INTO public.activities (
        group_id,
        type,
        actor_id,
        actor_name,
        description,
        amount
    )
    VALUES (
        v_group_id,
        'expense_created',
        v_caller_id,
        COALESCE(v_payer_name, 'Member'),
        'updated expense "' || trim(p_title) || '"',
        p_amount
    );

    -- 4. Return updated expense JSON
    SELECT jsonb_build_object(
        'id', e.id,
        'group_id', e.group_id,
        'payer_id', e.payer_id,
        'payer_name', e.payer_name,
        'title', e.title,
        'amount', e.amount,
        'currency', e.currency,
        'category', e.category,
        'expense_date', e.expense_date,
        'split_method', e.split_method,
        'notes', e.notes,
        'receipt_url', e.receipt_url,
        'created_at', e.created_at,
        'expense_splits', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', s.id,
                'user_id', s.user_id,
                'member_id', s.member_id,
                'invited_name', s.invited_name,
                'amount', s.amount,
                'percentage', s.percentage,
                'shares', s.shares
            )), '[]'::jsonb)
            FROM public.expense_splits s
            WHERE s.expense_id = e.id
        )
    ) INTO v_result
    FROM public.expenses e
    WHERE e.id = p_expense_id;

    RETURN v_result;
END;
$$;

