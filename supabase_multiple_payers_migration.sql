-- ============================================================================
-- SMART EXPENSE SPLITTER — MULTIPLE PAYERS SUPPORT MIGRATION
-- Enables multiple group members to contribute varying amounts to a single expense
-- ============================================================================

-- 1. Create expense_payments table
CREATE TABLE IF NOT EXISTS public.expense_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    member_id UUID REFERENCES public.group_members(id) ON DELETE SET NULL,
    payer_name TEXT NOT NULL DEFAULT 'Member',
    amount_paid NUMERIC(12, 2) NOT NULL CHECK (amount_paid >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Indexes for high performance queries and joins
CREATE INDEX IF NOT EXISTS idx_expense_payments_expense_id ON public.expense_payments(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_payments_user_id ON public.expense_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_payments_member_id ON public.expense_payments(member_id);

-- 3. Row Level Security Policies for expense_payments
ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view expense payments" ON public.expense_payments;
CREATE POLICY "Members can view expense payments"
    ON public.expense_payments FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.expenses 
        WHERE id = expense_payments.expense_id AND public.is_group_member(group_id)
    ));

DROP POLICY IF EXISTS "Members can insert expense payments" ON public.expense_payments;
CREATE POLICY "Members can insert expense payments"
    ON public.expense_payments FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.expenses 
        WHERE id = expense_payments.expense_id AND public.is_group_member(group_id)
    ));

DROP POLICY IF EXISTS "Members can update expense payments" ON public.expense_payments;
CREATE POLICY "Members can update expense payments"
    ON public.expense_payments FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.expenses 
        WHERE id = expense_payments.expense_id AND public.is_group_member(group_id)
    ));

DROP POLICY IF EXISTS "Members can delete expense payments" ON public.expense_payments;
CREATE POLICY "Members can delete expense payments"
    ON public.expense_payments FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.expenses 
        WHERE id = expense_payments.expense_id AND public.is_group_member(group_id)
    ));

-- 4. Backfill existing historical expenses into expense_payments
INSERT INTO public.expense_payments (
    expense_id,
    user_id,
    member_id,
    payer_name,
    amount_paid,
    created_at
)
SELECT 
    e.id AS expense_id,
    e.payer_id AS user_id,
    e.payer_member_id AS member_id,
    COALESCE(e.payer_name, 'Member') AS payer_name,
    e.amount AS amount_paid,
    COALESCE(e.created_at, now()) AS created_at
FROM public.expenses e
WHERE NOT EXISTS (
    SELECT 1 FROM public.expense_payments ep WHERE ep.expense_id = e.id
);

-- 5. Updated Atomic Stored Procedure: create_complete_expense
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
    p_items JSONB DEFAULT '[]'::jsonb,
    p_payers JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expense_id UUID;
    v_caller_id UUID;
    v_primary_payer_id UUID := NULL;
    v_primary_member_id UUID := NULL;
    v_composite_payer_name TEXT := '';
    v_split_record RECORD;
    v_split_raw_id TEXT;
    v_split_uid UUID;
    v_split_amount NUMERIC;
    v_split_pct NUMERIC;
    v_split_shares NUMERIC;
    v_split_user_id UUID;
    v_split_member_id UUID;
    v_split_name TEXT;
    v_payer_record RECORD;
    v_payer_raw_id TEXT;
    v_payer_uid UUID;
    v_payer_amount NUMERIC;
    v_payer_user_id UUID;
    v_payer_member_id UUID;
    v_payer_name TEXT;
    v_item_record RECORD;
    v_new_item_id UUID;
    v_assigned_user TEXT;
    v_result JSONB;
    v_payer_names TEXT[] := ARRAY[]::TEXT[];
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Validate caller is member of group
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'Not authorized to add expenses to this group';
    END IF;

    -- Process Payers from p_payers array if supplied
    IF p_payers IS NOT NULL AND jsonb_array_length(p_payers) > 0 THEN
        FOR v_payer_record IN SELECT * FROM jsonb_to_recordset(p_payers) AS z(
            "userId" TEXT,
            "userName" TEXT,
            amount NUMERIC
        )
        LOOP
            v_payer_raw_id := trim(v_payer_record."userId");
            v_payer_amount := COALESCE(v_payer_record.amount, 0);
            v_payer_name := COALESCE(v_payer_record."userName", 'Member');
            v_payer_user_id := NULL;
            v_payer_member_id := NULL;

            BEGIN
                v_payer_uid := v_payer_raw_id::UUID;
            EXCEPTION WHEN OTHERS THEN
                v_payer_uid := NULL;
            END;

            IF v_payer_uid IS NOT NULL THEN
                IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_payer_uid) THEN
                    v_payer_user_id := v_payer_uid;
                    SELECT name INTO v_payer_name FROM public.profiles WHERE id = v_payer_uid;
                ELSIF EXISTS (SELECT 1 FROM public.group_members WHERE id = v_payer_uid) THEN
                    v_payer_member_id := v_payer_uid;
                    SELECT user_id, COALESCE(invited_name, v_payer_name)
                    INTO v_payer_user_id, v_payer_name
                    FROM public.group_members WHERE id = v_payer_uid;
                END IF;
            END IF;

            IF v_primary_payer_id IS NULL AND v_payer_user_id IS NOT NULL THEN
                v_primary_payer_id := v_payer_user_id;
                v_primary_member_id := v_payer_member_id;
            END IF;

            v_payer_names := array_append(v_payer_names, split_part(v_payer_name, ' ', 1));
        END LOOP;

        IF array_length(v_payer_names, 1) = 1 THEN
            v_composite_payer_name := v_payer_names[1];
        ELSIF array_length(v_payer_names, 1) > 1 THEN
            v_composite_payer_name := array_to_string(v_payer_names, ' & ');
        ELSE
            v_composite_payer_name := 'Member';
        END IF;
    ELSE
        -- Fallback to single payer
        IF p_payer_id IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_payer_id) THEN
                v_primary_payer_id := p_payer_id;
                SELECT name INTO v_composite_payer_name FROM public.profiles WHERE id = p_payer_id;
            ELSIF EXISTS (SELECT 1 FROM public.group_members WHERE id = p_payer_id) THEN
                v_primary_member_id := p_payer_id;
                SELECT COALESCE(invited_name, 'Member') INTO v_composite_payer_name FROM public.group_members WHERE id = p_payer_id;
            ELSE
                v_primary_payer_id := v_caller_id;
                SELECT name INTO v_composite_payer_name FROM public.profiles WHERE id = v_caller_id;
            END IF;
        ELSE
            v_primary_payer_id := v_caller_id;
            SELECT name INTO v_composite_payer_name FROM public.profiles WHERE id = v_caller_id;
        END IF;
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
        v_primary_payer_id,
        v_primary_member_id,
        v_composite_payer_name,
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

    -- 2. Insert into expense_payments
    IF p_payers IS NOT NULL AND jsonb_array_length(p_payers) > 0 THEN
        FOR v_payer_record IN SELECT * FROM jsonb_to_recordset(p_payers) AS z(
            "userId" TEXT,
            "userName" TEXT,
            amount NUMERIC
        )
        LOOP
            v_payer_raw_id := trim(v_payer_record."userId");
            v_payer_amount := COALESCE(v_payer_record.amount, 0);
            v_payer_name := COALESCE(v_payer_record."userName", 'Member');
            v_payer_user_id := NULL;
            v_payer_member_id := NULL;

            BEGIN
                v_payer_uid := v_payer_raw_id::UUID;
            EXCEPTION WHEN OTHERS THEN
                v_payer_uid := NULL;
            END;

            IF v_payer_uid IS NOT NULL THEN
                IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_payer_uid) THEN
                    v_payer_user_id := v_payer_uid;
                    SELECT name INTO v_payer_name FROM public.profiles WHERE id = v_payer_uid;
                ELSIF EXISTS (SELECT 1 FROM public.group_members WHERE id = v_payer_uid) THEN
                    v_payer_member_id := v_payer_uid;
                    SELECT user_id, COALESCE(invited_name, v_payer_name)
                    INTO v_payer_user_id, v_payer_name
                    FROM public.group_members WHERE id = v_payer_uid;
                END IF;
            END IF;

            INSERT INTO public.expense_payments (
                expense_id,
                user_id,
                member_id,
                payer_name,
                amount_paid
            )
            VALUES (
                v_expense_id,
                v_payer_user_id,
                v_payer_member_id,
                v_payer_name,
                v_payer_amount
            );
        END LOOP;
    ELSE
        INSERT INTO public.expense_payments (
            expense_id,
            user_id,
            member_id,
            payer_name,
            amount_paid
        )
        VALUES (
            v_expense_id,
            v_primary_payer_id,
            v_primary_member_id,
            v_composite_payer_name,
            p_amount
        );
    END IF;

    -- 3. Insert Splits
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

    -- 4. Insert Items (if itemized)
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

            IF v_item_record."assignedTo" IS NOT NULL THEN
                FOR v_assigned_user IN SELECT jsonb_array_elements_text(v_item_record."assignedTo")
                LOOP
                    BEGIN
                        INSERT INTO public.expense_item_assignments (item_id, user_id)
                        VALUES (v_new_item_id, v_assigned_user::UUID)
                        ON CONFLICT DO NOTHING;
                    EXCEPTION WHEN OTHERS THEN
                    END;
                END LOOP;
            END IF;
        END LOOP;
    END IF;

    -- 5. Audit activity log
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
        v_primary_payer_id,
        COALESCE(v_composite_payer_name, 'A member'),
        'added "' || trim(p_title) || '" (' || COALESCE(p_currency, 'LKR') || ' ' || p_amount || ')',
        p_amount,
        COALESCE(p_currency, 'LKR')
    );

    -- 6. Construct full response payload
    SELECT jsonb_build_object(
        'id', e.id,
        'group_id', e.group_id,
        'payer_id', e.payer_id,
        'payer_member_id', e.payer_member_id,
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
        'expense_payments', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', ep.id,
                'user_id', ep.user_id,
                'member_id', ep.member_id,
                'payer_name', ep.payer_name,
                'amount_paid', ep.amount_paid
            ))
            FROM public.expense_payments ep
            WHERE ep.expense_id = e.id
        ), '[]'::jsonb),
        'expense_splits', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id,
                'user_id', s.user_id,
                'member_id', s.member_id,
                'invited_name', s.invited_name,
                'amount', s.amount,
                'percentage', s.percentage,
                'shares', s.shares
            ))
            FROM public.expense_splits s
            WHERE s.expense_id = e.id
        ), '[]'::jsonb)
    ) INTO v_result
    FROM public.expenses e
    WHERE e.id = v_expense_id;

    RETURN v_result;
END;
$$;

-- 6. Updated Atomic Stored Procedure: update_complete_expense
CREATE OR REPLACE FUNCTION public.update_complete_expense(
    p_expense_id UUID,
    p_title TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_payer_id UUID,
    p_expense_date DATE,
    p_notes TEXT DEFAULT '',
    p_splits JSONB DEFAULT '[]'::jsonb,
    p_payers JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_group_id UUID;
    v_caller_id UUID;
    v_primary_payer_id UUID := NULL;
    v_primary_member_id UUID := NULL;
    v_composite_payer_name TEXT := '';
    v_split_record RECORD;
    v_split_raw_id TEXT;
    v_split_uid UUID;
    v_split_amount NUMERIC;
    v_split_pct NUMERIC;
    v_split_shares NUMERIC;
    v_split_user_id UUID;
    v_split_member_id UUID;
    v_split_name TEXT;
    v_payer_record RECORD;
    v_payer_raw_id TEXT;
    v_payer_uid UUID;
    v_payer_amount NUMERIC;
    v_payer_user_id UUID;
    v_payer_member_id UUID;
    v_payer_name TEXT;
    v_result JSONB;
    v_payer_names TEXT[] := ARRAY[]::TEXT[];
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

    -- Process Payers
    IF p_payers IS NOT NULL AND jsonb_array_length(p_payers) > 0 THEN
        FOR v_payer_record IN SELECT * FROM jsonb_to_recordset(p_payers) AS z(
            "userId" TEXT,
            "userName" TEXT,
            amount NUMERIC
        )
        LOOP
            v_payer_raw_id := trim(v_payer_record."userId");
            v_payer_amount := COALESCE(v_payer_record.amount, 0);
            v_payer_name := COALESCE(v_payer_record."userName", 'Member');
            v_payer_user_id := NULL;
            v_payer_member_id := NULL;

            BEGIN
                v_payer_uid := v_payer_raw_id::UUID;
            EXCEPTION WHEN OTHERS THEN
                v_payer_uid := NULL;
            END;

            IF v_payer_uid IS NOT NULL THEN
                IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_payer_uid) THEN
                    v_payer_user_id := v_payer_uid;
                    SELECT name INTO v_payer_name FROM public.profiles WHERE id = v_payer_uid;
                ELSIF EXISTS (SELECT 1 FROM public.group_members WHERE id = v_payer_uid) THEN
                    v_payer_member_id := v_payer_uid;
                    SELECT user_id, COALESCE(invited_name, v_payer_name)
                    INTO v_payer_user_id, v_payer_name
                    FROM public.group_members WHERE id = v_payer_uid;
                END IF;
            END IF;

            IF v_primary_payer_id IS NULL AND v_payer_user_id IS NOT NULL THEN
                v_primary_payer_id := v_payer_user_id;
                v_primary_member_id := v_payer_member_id;
            END IF;

            v_payer_names := array_append(v_payer_names, split_part(v_payer_name, ' ', 1));
        END LOOP;

        IF array_length(v_payer_names, 1) = 1 THEN
            v_composite_payer_name := v_payer_names[1];
        ELSIF array_length(v_payer_names, 1) > 1 THEN
            v_composite_payer_name := array_to_string(v_payer_names, ' & ');
        ELSE
            v_composite_payer_name := 'Member';
        END IF;
    ELSE
        IF p_payer_id IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_payer_id) THEN
                v_primary_payer_id := p_payer_id;
                SELECT name INTO v_composite_payer_name FROM public.profiles WHERE id = p_payer_id;
            ELSIF EXISTS (SELECT 1 FROM public.group_members WHERE id = p_payer_id) THEN
                v_primary_member_id := p_payer_id;
                SELECT COALESCE(invited_name, 'Member') INTO v_composite_payer_name FROM public.group_members WHERE id = p_payer_id;
            ELSE
                v_primary_payer_id := v_caller_id;
                SELECT name INTO v_composite_payer_name FROM public.profiles WHERE id = v_caller_id;
            END IF;
        ELSE
            v_primary_payer_id := v_caller_id;
            SELECT name INTO v_composite_payer_name FROM public.profiles WHERE id = v_caller_id;
        END IF;
    END IF;

    -- Update expense master
    UPDATE public.expenses
    SET 
        title = trim(p_title),
        amount = p_amount,
        category = COALESCE(p_category, category),
        payer_id = v_primary_payer_id,
        payer_member_id = v_primary_member_id,
        payer_name = v_composite_payer_name,
        expense_date = COALESCE(p_expense_date, expense_date),
        notes = COALESCE(trim(p_notes), notes),
        updated_at = now()
    WHERE id = p_expense_id;

    -- Replace expense_payments
    DELETE FROM public.expense_payments WHERE expense_id = p_expense_id;

    IF p_payers IS NOT NULL AND jsonb_array_length(p_payers) > 0 THEN
        FOR v_payer_record IN SELECT * FROM jsonb_to_recordset(p_payers) AS z(
            "userId" TEXT,
            "userName" TEXT,
            amount NUMERIC
        )
        LOOP
            v_payer_raw_id := trim(v_payer_record."userId");
            v_payer_amount := COALESCE(v_payer_record.amount, 0);
            v_payer_name := COALESCE(v_payer_record."userName", 'Member');
            v_payer_user_id := NULL;
            v_payer_member_id := NULL;

            BEGIN
                v_payer_uid := v_payer_raw_id::UUID;
            EXCEPTION WHEN OTHERS THEN
                v_payer_uid := NULL;
            END;

            IF v_payer_uid IS NOT NULL THEN
                IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_payer_uid) THEN
                    v_payer_user_id := v_payer_uid;
                    SELECT name INTO v_payer_name FROM public.profiles WHERE id = v_payer_uid;
                ELSIF EXISTS (SELECT 1 FROM public.group_members WHERE id = v_payer_uid) THEN
                    v_payer_member_id := v_payer_uid;
                    SELECT user_id, COALESCE(invited_name, v_payer_name)
                    INTO v_payer_user_id, v_payer_name
                    FROM public.group_members WHERE id = v_payer_uid;
                END IF;
            END IF;

            INSERT INTO public.expense_payments (
                expense_id,
                user_id,
                member_id,
                payer_name,
                amount_paid
            )
            VALUES (
                p_expense_id,
                v_payer_user_id,
                v_payer_member_id,
                v_payer_name,
                v_payer_amount
            );
        END LOOP;
    ELSE
        INSERT INTO public.expense_payments (
            expense_id,
            user_id,
            member_id,
            payer_name,
            amount_paid
        )
        VALUES (
            p_expense_id,
            v_primary_payer_id,
            v_primary_member_id,
            v_composite_payer_name,
            p_amount
        );
    END IF;

    -- Replace splits if provided
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

    -- Return full expense object
    SELECT jsonb_build_object(
        'id', e.id,
        'group_id', e.group_id,
        'payer_id', e.payer_id,
        'payer_member_id', e.payer_member_id,
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
        'expense_payments', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', ep.id,
                'user_id', ep.user_id,
                'member_id', ep.member_id,
                'payer_name', ep.payer_name,
                'amount_paid', ep.amount_paid
            ))
            FROM public.expense_payments ep
            WHERE ep.expense_id = e.id
        ), '[]'::jsonb),
        'expense_splits', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id,
                'user_id', s.user_id,
                'member_id', s.member_id,
                'invited_name', s.invited_name,
                'amount', s.amount,
                'percentage', s.percentage,
                'shares', s.shares
            ))
            FROM public.expense_splits s
            WHERE s.expense_id = e.id
        ), '[]'::jsonb)
    ) INTO v_result
    FROM public.expenses e
    WHERE e.id = p_expense_id;

    RETURN v_result;
END;
$$;

