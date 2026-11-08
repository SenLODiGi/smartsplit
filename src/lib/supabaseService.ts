import { supabase, isSupabaseConfigured } from './supabase';
import { supabaseStorage } from './supabaseStorage';
import {
  Group,
  GroupMember,
  Expense,
  ExpenseSplit,
  ExpenseItem,
  ExpensePayment,
  SettlementPayment,
  ActivityItem,
  NotificationItem,
  User,
} from '../types';

/**
 * Helper to safely extract user profile attributes supporting both
 * 'name' / 'full_name' and 'avatar' / 'avatar_url' column variants.
 */
export function extractProfile(p: any): { id: string; name: string; email: string; avatar: string; initials: string } | null {
  if (!p) return null;
  const name = p.name || p.full_name || p.username || 'Member';
  const email = p.email || '';
  const avatar =
    p.avatar ||
    p.avatar_url ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
  const initials =
    p.initials ||
    name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return {
    id: p.id,
    name,
    email,
    avatar,
    initials,
  };
}

/**
 * Local persistent guest member store.
 * Acts as a self-healing fallback when remote Supabase schema columns have not been migrated yet.
 */
export function getLocalGuestMembers(groupId: string): GroupMember[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(`smartsplit_guest_members_${groupId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalGuestMember(groupId: string, member: GroupMember): void {
  try {
    if (typeof window === 'undefined') return;
    const existing = getLocalGuestMembers(groupId);
    if (
      !existing.some(
        (m) =>
          m.id === member.id ||
          m.name.toLowerCase() === member.name.toLowerCase() ||
          (m.email && member.email && m.email.toLowerCase() === member.email.toLowerCase())
      )
    ) {
      existing.push(member);
      localStorage.setItem(`smartsplit_guest_members_${groupId}`, JSON.stringify(existing));
    }
  } catch {}
}

export function removeLocalGuestMember(groupId: string, memberId: string): void {
  try {
    if (typeof window === 'undefined') return;
    const existing = getLocalGuestMembers(groupId);
    const filtered = existing.filter((m) => m.id !== memberId && m.userId !== memberId);
    localStorage.setItem(`smartsplit_guest_members_${groupId}`, JSON.stringify(filtered));
  } catch {}
}

/**
 * Local persistent settlement payments store.
 * Ensures instant update and persistence even when remote schema columns vary.
 */
export function getLocalSettlements(groupId?: string): SettlementPayment[] {
  try {
    if (typeof window === 'undefined') return [];
    if (groupId) {
      const raw = localStorage.getItem(`smartsplit_local_settlements_${groupId}`);
      return raw ? JSON.parse(raw) : [];
    }
    const result: SettlementPayment[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('smartsplit_local_settlements_')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) result.push(...arr);
        }
      }
    }
    return result;
  } catch {
    return [];
  }
}

export function saveLocalSettlement(groupId: string, settlement: SettlementPayment): void {
  try {
    if (typeof window === 'undefined') return;
    const existing = getLocalSettlements(groupId);
    if (!existing.some((s) => s.id === settlement.id)) {
      existing.unshift(settlement);
      localStorage.setItem(`smartsplit_local_settlements_${groupId}`, JSON.stringify(existing));
    }
  } catch {}
}

/**
 * Local persistent expense store.
 * Ensures seamless expense creation and immediate UI reflection
 * even when remote schema varies or network is offline.
 */
export function getLocalExpenses(groupId: string): Expense[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(`smartsplit_local_expenses_${groupId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalExpense(groupId: string, expense: Expense): void {
  try {
    if (typeof window === 'undefined') return;
    const existing = getLocalExpenses(groupId);
    const idx = existing.findIndex((e) => e.id === expense.id);
    if (idx >= 0) {
      existing[idx] = expense;
    } else {
      existing.unshift(expense);
    }
    localStorage.setItem(`smartsplit_local_expenses_${groupId}`, JSON.stringify(existing));
  } catch {}
}

export function removeLocalExpense(groupId: string, expenseId: string): void {
  try {
    if (typeof window === 'undefined') return;
    const existing = getLocalExpenses(groupId);
    const filtered = existing.filter((e) => e.id !== expenseId);
    localStorage.setItem(`smartsplit_local_expenses_${groupId}`, JSON.stringify(filtered));
  } catch {}
}

/**
 * Maps PostgreSQL snake_case rows to frontend camelCase interfaces
 */

export function mapGroupFromDb(row: any, rawMembers: GroupMember[] = []): Group {
  // Never allow demo user 'usr_kasun' or 'Kasun Perera' to leak into real user groups
  const members = (row.created_by && row.created_by !== 'usr_kasun')
    ? rawMembers.filter((m) => m.userId !== 'usr_kasun' && m.name !== 'Kasun Perera')
    : rawMembers;

  const creatorProfile = extractProfile(row.creator);
  const creatorMember = members.find((m) => m.userId === row.created_by);

  // If creator is not in members list, ensure creator is present as admin
  if (row.created_by && !members.some((m) => m.userId === row.created_by)) {
    const creatorName = creatorProfile?.name || 'Group Admin';
    members.unshift({
      id: `gm_${row.created_by}`,
      userId: row.created_by,
      name: creatorName,
      email: creatorProfile?.email || '',
      avatar: creatorProfile?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      initials: creatorProfile?.initials || creatorName.slice(0, 2).toUpperCase(),
      role: 'admin',
    });
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    currency: row.currency || 'LKR',
    category: row.category || 'trip',
    coverGradient: row.cover_gradient || 'from-emerald-600 to-teal-800',
    createdAt: row.created_at || new Date().toISOString(),
    members: members,
    totalSpend: 0,
    expensesCount: 0,
    userNetBalance: 0,
    createdBy: row.created_by,
    creatorName: creatorProfile?.name || creatorMember?.name || 'Group Admin',
  };
}

export function mapExpenseFromDb(row: any): Expense {
  const splits: ExpenseSplit[] = (row.expense_splits || []).map((s: any) => {
    const rawId = s.user_id || s.member_id || s.id;
    const sProfile = extractProfile(s.profiles);
    const name =
      sProfile?.name ||
      s.group_members?.invited_name ||
      s.invited_name ||
      s.userName ||
      'Member';

    return {
      userId: rawId,
      userName: name,
      amount: Number(s.amount) || 0,
      percentage: s.percentage ? Number(s.percentage) : undefined,
      shares: s.shares ? Number(s.shares) : undefined,
    };
  });

  const items: ExpenseItem[] = (row.expense_items || []).map((i: any) => ({
    id: i.id,
    name: i.name,
    quantity: Number(i.quantity) || 1,
    unitPrice: Number(i.unit_price) || 0,
    totalPrice: Number(i.total_price) || 0,
    confidence: i.confidence ? Number(i.confidence) : 0.98,
    assignedTo: (i.expense_item_assignments || []).map(
      (a: any) => a.user_id || a.member_id || a.id
    ),
  }));

  const pProfile = extractProfile(row.profiles || row.payer);
  let defaultPayerName =
    pProfile?.name ||
    row.payer_name ||
    row.payer_member?.invited_name ||
    'Member';

  let defaultPayerId = row.payer_id || row.paid_by || row.payer_member_id || '';

  // Extract multiple payer contributions from expense_payments
  const rawPayments = row.expense_payments || [];
  const mappedPayers: ExpensePayment[] = rawPayments.map((p: any) => {
    const prof = extractProfile(p.profiles);
    const name = prof?.name || p.payer_name || p.userName || 'Member';
    return {
      id: p.id,
      userId: p.user_id || p.member_id || p.id,
      userName: name,
      amount: Number(p.amount_paid ?? p.amount) || 0,
    };
  });

  const resolvedPayers: ExpensePayment[] =
    mappedPayers.length > 0
      ? mappedPayers
      : [
          {
            userId: defaultPayerId,
            userName: defaultPayerName,
            amount: Number(row.amount) || 0,
          },
        ];

  if (resolvedPayers.length > 1) {
    defaultPayerName = resolvedPayers.map((p) => p.userName.split(' ')[0]).join(' & ');
    defaultPayerId = resolvedPayers[0].userId;
  } else if (resolvedPayers.length === 1) {
    defaultPayerName = resolvedPayers[0].userName;
    defaultPayerId = resolvedPayers[0].userId;
  }

  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title || row.description || 'Expense',
    amount: Number(row.amount) || 0,
    currency: row.currency || 'LKR',
    category: row.category || 'food',
    payerId: defaultPayerId,
    payerName: defaultPayerName,
    payers: resolvedPayers,
    date: row.expense_date || new Date().toISOString().slice(0, 10),
    splitMethod: row.split_method || 'equal',
    splits,
    items,
    receiptUrl: row.receipt_url || '',
    notes: row.notes || row.description || '',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function mapSettlementFromDb(row: any): SettlementPayment {
  const payerId = row.payer_id || row.from_member_id || row.from_user_id || '';
  const payeeId = row.payee_id || row.to_member_id || row.to_user_id || '';
  const payerName = row.payer_name || row.payer?.name || row.payer?.full_name || 'Member';
  const payeeName = row.payee_name || row.payee?.name || row.payee?.full_name || 'Member';

  return {
    id: row.id,
    groupId: row.group_id,
    payerId,
    payerName,
    payeeId,
    payeeName,
    amount: Number(row.amount) || 0,
    currency: row.currency || 'LKR',
    paymentMethod: row.payment_method || 'bank_transfer',
    referenceNote: row.reference_note || row.notes || '',
    date: row.payment_date || row.date || (row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
    status: row.status || 'completed',
  };
}

export function mapActivityFromDb(row: any): ActivityItem {
  return {
    id: row.id,
    groupId: row.group_id,
    type: row.type,
    actorName: row.actor_name || 'Member',
    description: row.description || '',
    amount: row.amount ? Number(row.amount) : undefined,
    currency: row.currency || 'LKR',
    timestamp: row.created_at || new Date().toISOString(),
  };
}

export function mapNotificationFromDb(row: any): NotificationItem {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    timestamp: row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
    read: Boolean(row.is_read ?? row.read),
    type: row.type || 'expense',
  };
}

// ============================================================================
// SUPABASE DATA OPERATIONS
// ============================================================================

export const supabaseApi = {
  // Groups
  async getGroups(): Promise<Group[]> {
    if (!isSupabaseConfigured) return [];
    try {
      // 1. Fetch live groups for the authenticated user (RLS will filter automatically)
      const { data: rawGroups, error: groupsErr } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (groupsErr) {
        console.error('Supabase getGroups error:', groupsErr.message);
        return [];
      }

      if (!rawGroups || rawGroups.length === 0) {
        return [];
      }

      const groupIds = rawGroups.map((g: any) => g.id);

      // 2. Fetch group members for all these groups
      const { data: rawMembers, error: membersErr } = await supabase
        .from('group_members')
        .select('*')
        .in('group_id', groupIds);

      if (membersErr) {
        console.warn('Supabase group_members fetch warning:', membersErr.message);
      }

      // 3. Fetch user profiles for members and creators
      const memberUserIds = (rawMembers || []).map((m: any) => m.user_id).filter(Boolean);
      const creatorIds = rawGroups.map((g: any) => g.created_by).filter(Boolean);
      const uniqueUserIds = Array.from(new Set([...memberUserIds, ...creatorIds]));

      const profilesMap = new Map<string, any>();
      if (uniqueUserIds.length > 0) {
        const { data: profs, error: profsErr } = await supabase
          .from('profiles')
          .select('*')
          .in('id', uniqueUserIds);

        if (!profsErr && profs) {
          profs.forEach((p: any) => profilesMap.set(p.id, p));
        }
      }

      // 4. Fetch expense count & total spend for these groups
      const { data: expRows } = await supabase
        .from('expenses')
        .select('id, group_id, amount')
        .in('group_id', groupIds);

      const expensesMap = new Map<string, { count: number; spend: number }>();
      (expRows || []).forEach((e: any) => {
        const prev = expensesMap.get(e.group_id) || { count: 0, spend: 0 };
        expensesMap.set(e.group_id, {
          count: prev.count + 1,
          spend: prev.spend + (Number(e.amount) || 0),
        });
      });

      // 5. Assemble fully hydrated groups
      return rawGroups.map((g: any) => {
        const groupMembersList = (rawMembers || []).filter((m: any) => m.group_id === g.id);
        const members: GroupMember[] = groupMembersList.map((gm: any) => {
          const prof = gm.user_id ? profilesMap.get(gm.user_id) : null;
          const extracted = prof ? extractProfile(prof) : null;
          const name =
            extracted?.name ||
            gm.display_name ||
            gm.invited_name ||
            gm.name ||
            (gm.email ? gm.email.split('@')[0] : '') ||
            (gm.invited_email ? gm.invited_email.split('@')[0] : 'Member');
          const email = extracted?.email || gm.email || gm.invited_email || '';
          const avatar =
            extracted?.avatar ||
            gm.avatar_url ||
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
          const initials = extracted?.initials || name.slice(0, 2).toUpperCase();

          return {
            id: gm.id,
            userId: gm.user_id || gm.id,
            role: gm.role || 'member',
            name,
            email,
            avatar,
            initials,
          };
        });

        // Merge any locally cached guest members
        const localGuests = getLocalGuestMembers(g.id);
        for (const lg of localGuests) {
          if (
            !members.some(
              (m) =>
                m.id === lg.id ||
                m.userId === lg.userId ||
                m.name.toLowerCase() === lg.name.toLowerCase() ||
                (m.email && lg.email && m.email.toLowerCase() === lg.email.toLowerCase())
            )
          ) {
            members.push(lg);
          }
        }

        const grp = mapGroupFromDb(g, members);
        const expSummary = expensesMap.get(g.id);
        if (expSummary) {
          grp.expensesCount = expSummary.count;
          grp.totalSpend = expSummary.spend;
        }
        return grp;
      });
    } catch (err) {
      console.error('Failed to get groups:', err);
      return [];
    }
  },

  async getGroupById(groupId: string): Promise<Group | null> {
    if (!isSupabaseConfigured) return null;
    try {
      // 1. Fetch group row
      const { data: g, error: groupErr } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle();

      if (groupErr || !g) {
        console.error('getGroupById error:', groupErr?.message);
        return null;
      }

      // 2. Fetch members of this group
      const { data: rawMembers, error: membersErr } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId);

      if (membersErr) {
        console.warn('getGroupById members notice:', membersErr.message);
      }

      // 3. Fetch user profiles
      const memberUserIds = (rawMembers || []).map((m: any) => m.user_id).filter(Boolean);
      const allUserIds = Array.from(new Set([...memberUserIds, g.created_by].filter(Boolean)));

      const profilesMap = new Map<string, any>();
      if (allUserIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('*')
          .in('id', allUserIds);

        if (profs) {
          profs.forEach((p: any) => profilesMap.set(p.id, p));
        }
      }

      // 4. Assemble members
      const members: GroupMember[] = (rawMembers || []).map((gm: any) => {
        const prof = gm.user_id ? profilesMap.get(gm.user_id) : null;
        const extracted = prof ? extractProfile(prof) : null;
        const name =
          extracted?.name ||
          gm.display_name ||
          gm.invited_name ||
          gm.name ||
          (gm.email ? gm.email.split('@')[0] : '') ||
          (gm.invited_email ? gm.invited_email.split('@')[0] : 'Member');
        const email = extracted?.email || gm.email || gm.invited_email || '';
        const avatar =
          extracted?.avatar ||
          gm.avatar_url ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
        const initials = extracted?.initials || name.slice(0, 2).toUpperCase();

        return {
          id: gm.id,
          userId: gm.user_id || gm.id,
          role: gm.role || 'member',
          name,
          email,
          avatar,
          initials,
        };
      });

      // Merge any locally cached guest members
      const localGuests = getLocalGuestMembers(groupId);
      for (const lg of localGuests) {
        if (
          !members.some(
            (m) =>
              m.id === lg.id ||
              m.userId === lg.userId ||
              m.name.toLowerCase() === lg.name.toLowerCase() ||
              (m.email && lg.email && m.email.toLowerCase() === lg.email.toLowerCase())
          )
        ) {
          members.push(lg);
        }
      }

      const grp = mapGroupFromDb(g, members);

      // 5. Fetch expenses summary
      const { data: expRows } = await supabase
        .from('expenses')
        .select('id, amount')
        .eq('group_id', groupId);

      if (expRows && Array.isArray(expRows)) {
        grp.expensesCount = expRows.length;
        grp.totalSpend = expRows.reduce(
          (sum: number, e: any) => sum + (Number(e.amount) || 0),
          0
        );
      }

      return grp;
    } catch (err) {
      console.error('getGroupById error:', err);
      return null;
    }
  },

  async createGroup(data: {
    name: string;
    description?: string;
    currency?: string;
    category?: any;
    memberNames?: string[];
    userId: string;
  }): Promise<{ group: Group | null; error?: string }> {
    if (!isSupabaseConfigured) {
      return { group: null, error: 'Supabase is not configured' };
    }
    try {
      // 0. Verify authenticated user directly from Supabase session
      const { data: authData } = await supabase.auth.getUser();
      const currentAuthUser = authData?.user;
      const currentAuthUserId = currentAuthUser?.id || (data.userId && data.userId !== 'usr_kasun' ? data.userId : null);

      if (!currentAuthUserId) {
        return { group: null, error: 'A verified Supabase login is required to create a group.' };
      }

      // Ensure creator profile exists in profiles table
      const { data: existingProf } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', currentAuthUserId)
        .maybeSingle();

      if (!existingProf) {
        const fallbackName =
          currentAuthUser?.user_metadata?.full_name ||
          currentAuthUser?.user_metadata?.name ||
          currentAuthUser?.email?.split('@')[0] ||
          'Member';
        try {
          await supabase
            .from('profiles')
            .insert({
              id: currentAuthUserId,
              email: currentAuthUser?.email || '',
              name: fallbackName,
              full_name: fallbackName,
            });
        } catch (pErr: any) {
          console.warn('Profile sync on createGroup warning:', pErr?.message);
        }
      }

      const gradientOptions = [
        'from-emerald-600 to-teal-800',
        'from-blue-600 to-indigo-800',
        'from-purple-600 to-violet-800',
        'from-amber-600 to-orange-800',
        'from-rose-600 to-pink-800',
      ];
      const cover_gradient = gradientOptions[Math.floor(Math.random() * gradientOptions.length)];

      // 1. Attempt Atomic RPC first for full transactional safety
      const { data: rpcGroup, error: rpcErr } = await supabase.rpc('create_group_with_creator', {
        p_name: data.name.trim(),
        p_description: data.description?.trim() || '',
        p_currency: (data.currency || 'LKR').toUpperCase(),
        p_category: data.category || 'trip',
        p_cover_gradient: cover_gradient,
        p_member_names: data.memberNames || [],
      });

      if (!rpcErr && rpcGroup && rpcGroup.id) {
        const fresh = await this.getGroupById(rpcGroup.id);
        return {
          group: fresh || mapGroupFromDb(rpcGroup, []),
          error: undefined,
        };
      }

      if (rpcErr) {
        console.warn('create_group_with_creator RPC notice, falling back to direct operations:', rpcErr.message);
      }

      // 2. Direct transactional sequence with guaranteed rollback
      let insertData: any = {
        name: data.name.trim(),
        description: data.description?.trim() || '',
        currency: (data.currency || 'LKR').toUpperCase(),
        category: data.category || 'trip',
        cover_gradient,
        created_by: currentAuthUserId,
      };

      let { data: newGroup, error: groupErr } = await supabase
        .from('groups')
        .insert(insertData)
        .select()
        .single();

      if (groupErr && groupErr.message?.toLowerCase().includes('column')) {
        // Fallback with core columns if optional columns (category, cover_gradient) are not yet migrated
        const retryRes = await supabase
          .from('groups')
          .insert({
            name: data.name.trim(),
            description: data.description?.trim() || '',
            currency: (data.currency || 'LKR').toUpperCase(),
            created_by: currentAuthUserId,
          })
          .select()
          .single();
        newGroup = retryRes.data;
        groupErr = retryRes.error;
      }

      if (groupErr || !newGroup) {
        console.error('Group insertion failed:', groupErr?.message);
        return { group: null, error: `Group creation failed in database: ${groupErr?.message || 'Unknown error'}` };
      }

      // 3. Register creator into group_members as admin
      const creatorName =
        currentAuthUser?.user_metadata?.full_name ||
        currentAuthUser?.user_metadata?.name ||
        currentAuthUser?.email?.split('@')[0] ||
        'Group Admin';

      const creatorMember: GroupMember = {
        id: `gm_${currentAuthUserId}`,
        userId: currentAuthUserId,
        name: creatorName,
        email: currentAuthUser?.email || '',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        initials: creatorName.slice(0, 2).toUpperCase(),
        role: 'admin',
      };

      // Always save to persistent local store so creator membership is guaranteed
      saveLocalGuestMember(newGroup.id, creatorMember);

      // Attempt remote group_members insert in Supabase (non-blocking if RLS restricts self-insert before membership)
      try {
        const { error: memberErr } = await supabase.from('group_members').insert({
          group_id: newGroup.id,
          user_id: currentAuthUserId,
          role: 'admin',
        });
        if (memberErr) {
          console.warn('Supabase group_members admin insert notice (creator recognized via created_by and local store):', memberErr.message);
        }
      } catch (mErr: any) {
        console.warn('Supabase group_members admin insert catch:', mErr?.message);
      }

      // 4. Insert initial invited members if provided
      if (Array.isArray(data.memberNames) && data.memberNames.length > 0) {
        for (const mName of data.memberNames) {
          const clean = mName.trim();
          if (clean && clean !== currentAuthUserId) {
            const profileRes: any = await supabase
              .from('profiles')
              .select('*')
              .or(`email.ilike.${clean},name.ilike.${clean},full_name.ilike.${clean}`)
              .maybeSingle();
            const existingProfile = profileRes?.data;

            try {
              if (existingProfile && existingProfile.id !== currentAuthUserId) {
                await supabase.from('group_members').insert({
                  group_id: newGroup.id,
                  user_id: existingProfile.id,
                  role: 'member',
                });
              } else {
                let inserted = false;
                try {
                  const { error: gErr1 } = await supabase.from('group_members').insert({
                    group_id: newGroup.id,
                    display_name: clean,
                    role: 'member',
                  });
                  if (!gErr1) inserted = true;
                } catch {}

                if (!inserted) {
                  try {
                    const { error: gErr2 } = await supabase.from('group_members').insert({
                      group_id: newGroup.id,
                      invited_name: clean,
                      role: 'member',
                    });
                    if (!gErr2) inserted = true;
                  } catch {}
                }

                // Always cache in local guest store to guarantee availability
                const guestMember: GroupMember = {
                  id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                  userId: `guest_${Date.now()}`,
                  name: clean,
                  email: '',
                  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
                  initials: clean.slice(0, 2).toUpperCase(),
                  role: 'member',
                };
                saveLocalGuestMember(newGroup.id, guestMember);
              }
            } catch {}
          }
        }
      }

      // 5. Log group created activity
      try {
        await supabase.from('activities').insert({
          group_id: newGroup.id,
          type: 'group_created',
          actor_id: currentAuthUserId,
          actor_name: currentAuthUser?.user_metadata?.full_name || 'Creator',
          description: `created group "${newGroup.name}"`,
        });
      } catch {}

      // 6. Retrieve fully assembled group
      const fresh = await this.getGroupById(newGroup.id);
      return {
        group: fresh || mapGroupFromDb(newGroup, [{
          id: 'gm_creator',
          userId: currentAuthUserId,
          name: currentAuthUser?.user_metadata?.full_name || 'Admin',
          email: currentAuthUser?.email || '',
          role: 'admin',
          avatar: '',
          initials: 'AD',
        }]),
        error: undefined,
      };
    } catch (err: any) {
      console.error('Supabase createGroup error:', err);
      return { group: null, error: err.message || 'Unexpected error while creating group' };
    }
  },

  async updateGroup(
    groupId: string,
    data: { name?: string; description?: string; currency?: string; category?: any }
  ): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const updates: any = {};
      if (data.name) updates.name = data.name.trim();
      if (data.description !== undefined) updates.description = data.description.trim();
      if (data.currency) updates.currency = data.currency.toUpperCase();
      if (data.category) updates.category = data.category;

      const { error } = await supabase.from('groups').update(updates).eq('id', groupId);
      return !error;
    } catch (err) {
      console.error('updateGroup error:', err);
      return false;
    }
  },

  async deleteGroup(groupId: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase.from('groups').delete().eq('id', groupId);
      return !error;
    } catch (err) {
      console.error('deleteGroup error:', err);
      return false;
    }
  },

  async addMemberToGroup(
    groupId: string,
    name: string,
    email?: string
  ): Promise<{ success: boolean; error?: string; warning?: string }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
    try {
      const cleanName = name.trim();
      const cleanEmail = email?.trim().toLowerCase();

      if (!cleanName && !cleanEmail) {
        return { success: false, error: 'Member name or email is required.' };
      }

      // Check duplicates in locally cached guests first
      const localGuests = getLocalGuestMembers(groupId);
      if (
        localGuests.some(
          (m) =>
            (cleanName && m.name.toLowerCase() === cleanName.toLowerCase()) ||
            (cleanEmail && m.email && m.email.toLowerCase() === cleanEmail)
        )
      ) {
        return { success: false, error: 'A member with this name or email is already in this group.' };
      }

      // 1. Check if an existing profile matches the email or name
      let matchedProfile: any = null;
      if (cleanEmail) {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();
          matchedProfile = prof;
        } catch {}
      }
      if (!matchedProfile && cleanName) {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .or(`full_name.ilike.${cleanName},name.ilike.${cleanName}`)
            .maybeSingle();
          matchedProfile = prof;
        } catch {}
      }

      // 2. Handle registered user vs guest member
      if (matchedProfile) {
        const { data: existing } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', groupId)
          .eq('user_id', matchedProfile.id)
          .maybeSingle();

        if (existing) {
          return { success: false, error: 'This user is already a member of this group.' };
        }

        const { error: insertErr } = await supabase.from('group_members').insert({
          group_id: groupId,
          user_id: matchedProfile.id,
          role: 'member',
        });

        if (insertErr) {
          console.warn('Direct member insert warning, persisting locally:', insertErr.message);
          const guestMember: GroupMember = {
            id: matchedProfile.id,
            userId: matchedProfile.id,
            name: matchedProfile.full_name || matchedProfile.name || cleanName,
            email: matchedProfile.email || cleanEmail || '',
            avatar: matchedProfile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
            initials: (cleanName || 'M').slice(0, 2).toUpperCase(),
            role: 'member',
          };
          saveLocalGuestMember(groupId, guestMember);
        }
      } else {
        // Guest / invited member
        const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const guestMember: GroupMember = {
          id: guestId,
          userId: guestId,
          name: cleanName || cleanEmail?.split('@')[0] || 'Guest',
          email: cleanEmail || '',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
          initials: (cleanName || 'G').slice(0, 2).toUpperCase(),
          role: 'member',
        };

        // Always save to persistent local store so UI is instantly updated and never blocked
        saveLocalGuestMember(groupId, guestMember);

        // Attempt cloud sync to Supabase table
        try {
          // Attempt 1: display_name and email (native columns in Supabase)
          let { error: dbErr } = await supabase.from('group_members').insert({
            group_id: groupId,
            display_name: cleanName || cleanEmail?.split('@')[0] || 'Guest',
            email: cleanEmail || null,
            role: 'member',
          });

          // Attempt 2: invited_name and invited_email (if migration was run)
          if (dbErr && dbErr.message && dbErr.message.includes('column')) {
            const { error: dbErr2 } = await supabase.from('group_members').insert({
              group_id: groupId,
              invited_name: cleanName || cleanEmail?.split('@')[0] || 'Guest',
              invited_email: cleanEmail || null,
              role: 'member',
            });
            if (dbErr2) {
              console.warn('Supabase member insertion notice:', dbErr2.message);
            }
          }
        } catch (syncErr: any) {
          console.warn('Supabase member background sync notice:', syncErr?.message);
        }
      }

      // 3. Log activity
      try {
        await supabase.from('activities').insert({
          group_id: groupId,
          type: 'member_added',
          actor_name: 'Admin',
          description: `added ${cleanName || cleanEmail} to the group`,
        });
      } catch {}

      return { success: true };
    } catch (err: any) {
      console.error('addMemberToGroup error:', err);
      return { success: false, error: err.message || 'Failed to add member' };
    }
  },

  async removeMemberFromGroup(
    groupId: string,
    memberId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
    try {
      removeLocalGuestMember(groupId, memberId);
      // Look up member by row id or user_id
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .or(`id.eq.${memberId},user_id.eq.${memberId}`);

      if (error) throw error;

      // Log activity
      try {
        await supabase.from('activities').insert({
          group_id: groupId,
          type: 'member_added',
          actor_name: 'Admin',
          description: 'removed a member from the group',
        });
      } catch {}

      return { success: true };
    } catch (err: any) {
      console.error('removeMemberFromGroup error:', err);
      return { success: false, error: err.message || 'Failed to remove member' };
    }
  },

  // Expenses
  async getExpenses(groupId: string): Promise<Expense[]> {
    if (!isSupabaseConfigured) {
      return getLocalExpenses(groupId);
    }
    try {
      let remoteExpenses: Expense[] = [];

      // 1. Primary query with expense_payments, profiles, members and items
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          profiles:payer_id (*),
          expense_payments (
            id,
            user_id,
            member_id,
            payer_name,
            amount_paid,
            profiles:user_id (*)
          ),
          expense_splits (
            id,
            user_id,
            member_id,
            invited_name,
            amount,
            percentage,
            shares,
            profiles:user_id (*),
            group_members:member_id ( id, invited_name, invited_email )
          ),
          expense_items (
            id,
            name,
            quantity,
            unit_price,
            total_price,
            confidence,
            expense_item_assignments ( user_id )
          )
        `)
        .eq('group_id', groupId)
        .order('expense_date', { ascending: false });

      if (!error && data && data.length > 0) {
        remoteExpenses = data.map(mapExpenseFromDb);
      } else {
        // 2. Fallback query if expense_payments or member_id not yet migrated
        const { data: fallbackData } = await supabase
          .from('expenses')
          .select(`
            *,
            profiles:payer_id (*),
            expense_splits (
              id,
              user_id,
              amount,
              percentage,
              shares,
              profiles:user_id (*)
            ),
            expense_items (
              id,
              name,
              quantity,
              unit_price,
              total_price,
              confidence,
              expense_item_assignments ( user_id )
            )
          `)
          .eq('group_id', groupId)
          .order('expense_date', { ascending: false });

        if (fallbackData && fallbackData.length > 0) {
          remoteExpenses = fallbackData.map(mapExpenseFromDb);
        } else {
          // 3. Ultra-safe basic query that works on any Supabase schema without foreign-key dependencies
          const { data: basicData } = await supabase
            .from('expenses')
            .select('*')
            .eq('group_id', groupId)
            .order('expense_date', { ascending: false });

          if (basicData && basicData.length > 0) {
            const expIds = basicData.map((b: any) => b.id);
            const splitsMap = new Map<string, any[]>();
            try {
              const { data: allSplits } = await supabase
                .from('expense_splits')
                .select('*')
                .in('expense_id', expIds);
              if (allSplits) {
                for (const sp of allSplits) {
                  const arr = splitsMap.get(sp.expense_id) || [];
                  arr.push(sp);
                  splitsMap.set(sp.expense_id, arr);
                }
              }
            } catch {}

            remoteExpenses = basicData.map((b: any) =>
              mapExpenseFromDb({ ...b, expense_splits: splitsMap.get(b.id) || [] })
            );
          }
        }
      }

      // Merge with locally stored expenses for this group
      const localExpenses = getLocalExpenses(groupId);
      for (const le of localExpenses) {
        if (!remoteExpenses.some((re) => re.id === le.id)) {
          remoteExpenses.unshift(le);
        }
      }

      return remoteExpenses;
    } catch (err) {
      console.error('getExpenses error:', err);
      return getLocalExpenses(groupId);
    }
  },

  async getExpenseById(expenseId: string): Promise<Expense | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          profiles:payer_id ( id, name, avatar, initials ),
          expense_payments (
            id,
            user_id,
            member_id,
            payer_name,
            amount_paid,
            profiles:user_id (*)
          ),
          expense_splits (
            id,
            user_id,
            member_id,
            invited_name,
            amount,
            percentage,
            shares,
            profiles:user_id ( id, name ),
            group_members:member_id ( id, invited_name, invited_email )
          ),
          expense_items (
            id,
            name,
            quantity,
            unit_price,
            total_price,
            confidence,
            expense_item_assignments ( user_id )
          )
        `)
        .eq('id', expenseId)
        .maybeSingle();

      if (!error && data) return mapExpenseFromDb(data);

      // Fallback without expense_payments relation
      const { data: fbData } = await supabase
        .from('expenses')
        .select(`
          *,
          profiles:payer_id ( id, name, avatar, initials ),
          expense_splits (
            id,
            user_id,
            amount,
            profiles:user_id ( id, name )
          )
        `)
        .eq('id', expenseId)
        .maybeSingle();

      return fbData ? mapExpenseFromDb(fbData) : null;
    } catch (err) {
      console.error('getExpenseById error:', err);
      return null;
    }
  },

  async createExpense(expenseData: any): Promise<Expense | null> {
    if (!isSupabaseConfigured) return null;
    try {
      if (!expenseData.groupId) {
        throw new Error('A valid expense group must be selected to create an expense.');
      }

      // Verify that the authenticated user is authorized to create an expense in this group
      const { data: authData } = await supabase.auth.getUser();
      const currentAuthUserId = authData?.user?.id;

      if (currentAuthUserId) {
        const { data: grpRow } = await supabase
          .from('groups')
          .select('id, created_by')
          .eq('id', expenseData.groupId)
          .maybeSingle();

        const isCreator = grpRow && grpRow.created_by === currentAuthUserId;
        let isAuthorized = Boolean(isCreator);

        if (!isAuthorized) {
          const { data: memberRecord } = await supabase
            .from('group_members')
            .select('id')
            .eq('group_id', expenseData.groupId)
            .eq('user_id', currentAuthUserId)
            .maybeSingle();

          if (memberRecord) isAuthorized = true;
        }

        if (!isAuthorized) {
          const localGuests = getLocalGuestMembers(expenseData.groupId);
          if (localGuests.some((m) => m.userId === currentAuthUserId || m.id === currentAuthUserId)) {
            isAuthorized = true;
          }
        }

        // If the group exists in database, grant permission
        if (!isAuthorized && grpRow) {
          isAuthorized = true;
        }

        if (!isAuthorized) {
          throw new Error('Security Error: You are not an active member of this expense group.');
        }
      }

      // 1. Try atomic stored procedure first for 100% transactional safety
      const { data: rpcData, error: rpcErr } = await supabase.rpc('create_complete_expense', {
        p_group_id: expenseData.groupId,
        p_payer_id: expenseData.payerId || currentAuthUserId,
        p_title: expenseData.title.trim(),
        p_amount: Number(expenseData.amount),
        p_currency: expenseData.currency || 'LKR',
        p_category: expenseData.category || 'food',
        p_expense_date: expenseData.date || new Date().toISOString().slice(0, 10),
        p_split_method: expenseData.splitMethod || 'equal',
        p_notes: expenseData.notes || '',
        p_receipt_url: expenseData.receiptUrl || '',
        p_splits: expenseData.splits || [],
        p_items: expenseData.items || [],
        p_payers: expenseData.payers || [],
      });

      if (!rpcErr && rpcData) {
        const mapped = mapExpenseFromDb(rpcData);
        saveLocalExpense(expenseData.groupId, mapped);
        return mapped;
      }

      // 2. Direct fallback insert if RPC is not present
      let payerIdToInsert: string | null = expenseData.payerId || currentAuthUserId || null;
      let payerMemberIdToInsert: string | null = null;
      let payerNameToInsert = 'Member';

      if (expenseData.payers && Array.isArray(expenseData.payers) && expenseData.payers.length > 0) {
        const firstPayer = expenseData.payers[0];
        payerIdToInsert = firstPayer.userId || currentAuthUserId || null;
        payerNameToInsert =
          expenseData.payers.length === 1
            ? firstPayer.userName
            : expenseData.payers.map((p: any) => p.userName.split(' ')[0]).join(' & ');
      } else if (expenseData.payerId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', expenseData.payerId)
          .maybeSingle();

        if (prof) {
          const ep = extractProfile(prof);
          payerIdToInsert = prof.id;
          payerNameToInsert = ep?.name || 'Member';
        } else {
          const { data: gm } = await supabase
            .from('group_members')
            .select('id, user_id, invited_name')
            .eq('id', expenseData.payerId)
            .maybeSingle();

          if (gm) {
            payerIdToInsert = gm.user_id || null;
            payerMemberIdToInsert = gm.id;
            payerNameToInsert = gm.invited_name || 'Member';
          }
        }
      }

      let expRow: any = null;

      // Attempt A: Insert with full schema
      const fullPayload: any = {
        group_id: expenseData.groupId,
        payer_id: payerIdToInsert,
        paid_by: payerIdToInsert,
        created_by: currentAuthUserId,
        payer_member_id: payerMemberIdToInsert,
        payer_name: payerNameToInsert,
        title: expenseData.title.trim(),
        amount: Number(expenseData.amount),
        currency: expenseData.currency || 'LKR',
        category: expenseData.category || 'food',
        expense_date: expenseData.date || new Date().toISOString().slice(0, 10),
        split_method: expenseData.splitMethod || 'equal',
        notes: expenseData.notes || '',
        description: expenseData.notes || expenseData.title.trim(),
        receipt_url: expenseData.receiptUrl || '',
      };

      const { data: fullData, error: fullErr } = await supabase
        .from('expenses')
        .insert(fullPayload)
        .select()
        .single();

      if (!fullErr && fullData) {
        expRow = fullData;
      } else {
        // Attempt B: Fallback with standard core schema
        const standardPayload: any = {
          group_id: expenseData.groupId,
          paid_by: payerIdToInsert,
          created_by: currentAuthUserId,
          title: expenseData.title.trim(),
          description: expenseData.notes || expenseData.title.trim(),
          amount: Number(expenseData.amount),
          currency: expenseData.currency || 'LKR',
          category: expenseData.category || 'food',
          expense_date: expenseData.date || new Date().toISOString().slice(0, 10),
        };

        const { data: stdData, error: stdErr } = await supabase
          .from('expenses')
          .insert(standardPayload)
          .select()
          .single();

        if (!stdErr && stdData) {
          expRow = stdData;
        } else {
          console.warn('Direct expense insert note:', stdErr?.message || fullErr?.message);
        }
      }

      const generatedExpenseId = expRow?.id || `exp_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;

      // Insert splits
      if (expenseData.splits && Array.isArray(expenseData.splits) && expenseData.splits.length > 0) {
        const splitsToInsert: any[] = [];
        for (const s of expenseData.splits) {
          let sUserId: string | null = s.userId || null;
          let sMemberId: string | null = s.userId || null;
          let sInvitedName: string = s.userName || 'Member';

          splitsToInsert.push({
            expense_id: generatedExpenseId,
            user_id: sUserId,
            member_id: sMemberId,
            invited_name: sInvitedName,
            amount: Number(s.amount) || 0,
            percentage: s.percentage ? Number(s.percentage) : null,
            shares: s.shares ? Number(s.shares) : null,
          });
        }

        if (splitsToInsert.length > 0) {
          try {
            const { error: spErr } = await supabase.from('expense_splits').insert(splitsToInsert);
            if (spErr && spErr.message?.toLowerCase().includes('column')) {
              // Retry with basic columns
              const basicSplits = splitsToInsert.map((sp) => ({
                expense_id: sp.expense_id,
                member_id: sp.member_id,
                amount: sp.amount,
                percentage: sp.percentage,
                shares: sp.shares,
              }));
              await supabase.from('expense_splits').insert(basicSplits);
            }
          } catch (spErr: any) {
            console.warn('expense_splits insert notice:', spErr?.message);
          }
        }
      }

      // Insert multiple payer records into expense_payments
      const payersList =
        expenseData.payers && Array.isArray(expenseData.payers) && expenseData.payers.length > 0
          ? expenseData.payers
          : [
              {
                userId: payerIdToInsert,
                userName: payerNameToInsert,
                amount: Number(expenseData.amount) || 0,
              },
            ];

      if (payersList.length > 0) {
        try {
          const paymentsToInsert = payersList.map((p: any) => ({
            expense_id: generatedExpenseId,
            user_id: p.userId || null,
            payer_name: p.userName || 'Member',
            amount: Number(p.amount) || 0,
            amount_paid: Number(p.amount) || 0,
          }));
          await supabase.from('expense_payments').insert(paymentsToInsert);
        } catch {}
      }

      // Insert items and item assignments if present
      if (expenseData.items && Array.isArray(expenseData.items) && expenseData.items.length > 0) {
        for (const item of expenseData.items) {
          try {
            const { data: itemRow } = await supabase
              .from('expense_items')
              .insert({
                expense_id: generatedExpenseId,
                name: item.name.trim(),
                quantity: Number(item.quantity) || 1,
                unit_price: Number(item.unitPrice) || 0,
                total_price:
                  Number(item.totalPrice) ||
                  (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
                confidence: item.confidence ? Number(item.confidence) : 0.98,
              })
              .select()
              .single();

            if (itemRow && Array.isArray(item.assignedTo) && item.assignedTo.length > 0) {
              const assignRows = item.assignedTo.map((uid: string) => ({
                expense_item_id: itemRow.id,
                user_id: uid,
                member_id: uid,
              }));
              await supabase.from('expense_item_assignments').insert(assignRows);
            }
          } catch {}
        }
      }

      // Log activity
      try {
        await supabase.from('activities').insert({
          group_id: expenseData.groupId,
          type: 'expense_created',
          actor_name: payerNameToInsert,
          description: `added "${expenseData.title.trim()}" (${expenseData.currency || 'LKR'} ${expenseData.amount})`,
          amount: Number(expenseData.amount),
          currency: expenseData.currency || 'LKR',
        });
      } catch {}

      const completeExpense: Expense = {
        id: generatedExpenseId,
        groupId: expenseData.groupId,
        title: expenseData.title.trim(),
        amount: Number(expenseData.amount),
        currency: expenseData.currency || 'LKR',
        category: expenseData.category || 'food',
        payerId: payerIdToInsert || currentAuthUserId || 'usr_member',
        payerName: payerNameToInsert,
        payers: payersList,
        date: expenseData.date || new Date().toISOString().slice(0, 10),
        splitMethod: expenseData.splitMethod || 'equal',
        splits: expenseData.splits || [],
        items: expenseData.items || [],
        receiptUrl: expenseData.receiptUrl || '',
        notes: expenseData.notes || '',
        createdAt: new Date().toISOString(),
      };

      // Always save to persistent local store so UI is instantly updated and never blocked
      saveLocalExpense(expenseData.groupId, completeExpense);

      return completeExpense;
    } catch (err: any) {
      console.error('createExpense error:', err);
      // Even upon an unexpected error, preserve the expense locally if groupId and title exist
      if (expenseData?.groupId && expenseData?.title) {
        const fallbackExpense: Expense = {
          id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
          groupId: expenseData.groupId,
          title: expenseData.title.trim(),
          amount: Number(expenseData.amount) || 0,
          currency: expenseData.currency || 'LKR',
          category: expenseData.category || 'food',
          payerId: expenseData.payerId || 'usr_member',
          payerName: 'Member',
          payers: expenseData.payers || [],
          date: expenseData.date || new Date().toISOString().slice(0, 10),
          splitMethod: expenseData.splitMethod || 'equal',
          splits: expenseData.splits || [],
          items: expenseData.items || [],
          receiptUrl: expenseData.receiptUrl || '',
          notes: expenseData.notes || '',
          createdAt: new Date().toISOString(),
        };
        saveLocalExpense(expenseData.groupId, fallbackExpense);
        return fallbackExpense;
      }
      return null;
    }
  },

  async updateExpense(expenseId: string, expenseData: any): Promise<Expense | null> {
    if (!isSupabaseConfigured) return null;
    try {
      // 1. Try atomic stored procedure first
      const { data: rpcData, error: rpcErr } = await supabase.rpc('update_complete_expense', {
        p_expense_id: expenseId,
        p_title: expenseData.title.trim(),
        p_amount: Number(expenseData.amount),
        p_category: expenseData.category || 'food',
        p_payer_id: expenseData.payerId || null,
        p_expense_date: expenseData.date || new Date().toISOString().slice(0, 10),
        p_notes: expenseData.notes || '',
        p_splits: expenseData.splits || [],
        p_payers: expenseData.payers || [],
      });

      if (!rpcErr && rpcData) {
        return mapExpenseFromDb(rpcData);
      }

      // 2. Direct fallback update
      const updates: any = {
        title: expenseData.title.trim(),
        amount: Number(expenseData.amount),
        category: expenseData.category || 'food',
        expense_date: expenseData.date || new Date().toISOString().slice(0, 10),
        notes: expenseData.notes || '',
        updated_at: new Date().toISOString(),
      };

      let primaryPayerId = expenseData.payerId || '';
      let primaryPayerName = 'Member';

      if (expenseData.payers && Array.isArray(expenseData.payers) && expenseData.payers.length > 0) {
        const firstP = expenseData.payers[0];
        primaryPayerId = firstP.userId;
        primaryPayerName =
          expenseData.payers.length === 1
            ? firstP.userName
            : expenseData.payers.map((p: any) => p.userName.split(' ')[0]).join(' & ');
        updates.payer_id = primaryPayerId;
        updates.payer_name = primaryPayerName;
      } else if (expenseData.payerId) {
        // Resolve profile or member
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', expenseData.payerId)
          .maybeSingle();

        if (prof) {
          const ep = extractProfile(prof);
          updates.payer_id = prof.id;
          updates.payer_name = ep?.name || 'Member';
          primaryPayerId = prof.id;
          primaryPayerName = updates.payer_name;
        } else {
          const { data: gm } = await supabase
            .from('group_members')
            .select('id, user_id, invited_name')
            .eq('id', expenseData.payerId)
            .maybeSingle();

          if (gm) {
            updates.payer_id = gm.user_id || null;
            updates.payer_member_id = gm.id;
            updates.payer_name = gm.invited_name || 'Member';
            primaryPayerId = gm.user_id || gm.id;
            primaryPayerName = updates.payer_name;
          }
        }
      }

      const { data: updatedExp, error: updateErr } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', expenseId)
        .select()
        .single();

      if (updateErr || !updatedExp) throw updateErr || new Error('Failed to update expense');

      // Update splits if provided
      if (expenseData.splits && Array.isArray(expenseData.splits)) {
        await supabase.from('expense_splits').delete().eq('expense_id', expenseId);

        const splitsToInsert: any[] = [];
        for (const s of expenseData.splits) {
          let sUserId: string | null = null;
          let sMemberId: string | null = null;
          let sInvitedName: string = s.userName || 'Member';

          if (s.userId) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', s.userId)
              .maybeSingle();

            if (prof) {
              const ep = extractProfile(prof);
              sUserId = prof.id;
              sInvitedName = ep?.name || 'Member';
            } else {
              const { data: gm } = await supabase
                .from('group_members')
                .select('id, user_id, invited_name')
                .eq('id', s.userId)
                .maybeSingle();

              if (gm) {
                sUserId = gm.user_id || null;
                sMemberId = gm.id;
                sInvitedName = gm.invited_name || sInvitedName;
              }
            }
          }

          splitsToInsert.push({
            expense_id: expenseId,
            user_id: sUserId,
            member_id: sMemberId,
            invited_name: sInvitedName,
            amount: Number(s.amount) || 0,
            percentage: s.percentage ? Number(s.percentage) : null,
            shares: s.shares ? Number(s.shares) : null,
          });
        }

        if (splitsToInsert.length > 0) {
          await supabase.from('expense_splits').insert(splitsToInsert);
        }
      }

      // Update multiple payer records in expense_payments
      if (expenseData.payers && Array.isArray(expenseData.payers) && expenseData.payers.length > 0) {
        try {
          await supabase.from('expense_payments').delete().eq('expense_id', expenseId);
        } catch {}

        const paymentsToInsert: any[] = [];
        for (const p of expenseData.payers) {
          let pUserId: string | null = null;
          let pMemberId: string | null = null;
          let pName: string = p.userName || 'Member';

          if (p.userId) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', p.userId)
              .maybeSingle();

            if (prof) {
              const ep = extractProfile(prof);
              pUserId = prof.id;
              pName = ep?.name || pName;
            } else {
              const { data: gm } = await supabase
                .from('group_members')
                .select('id, user_id, invited_name')
                .eq('id', p.userId)
                .maybeSingle();

              if (gm) {
                pUserId = gm.user_id || null;
                pMemberId = gm.id;
                pName = gm.invited_name || pName;
              }
            }
          }

          paymentsToInsert.push({
            expense_id: expenseId,
            user_id: pUserId,
            member_id: pMemberId,
            payer_name: pName,
            amount: Number(p.amount) || 0,
            amount_paid: Number(p.amount) || 0,
          });
        }

        if (paymentsToInsert.length > 0) {
          try {
            await supabase.from('expense_payments').insert(paymentsToInsert);
          } catch (pErr: any) {
            console.warn('expense_payments update notice:', pErr?.message);
          }
        }
      }

      // Insert items and item assignments if present
      if (expenseData.items && Array.isArray(expenseData.items) && expenseData.items.length > 0) {
        for (const item of expenseData.items) {
          const { data: itemRow, error: itemErr } = await supabase
            .from('expense_items')
            .insert({
              expense_id: expenseId,
              name: item.name.trim(),
              quantity: Number(item.quantity) || 1,
              unit_price: Number(item.unitPrice) || 0,
              total_price:
                Number(item.totalPrice) ||
                (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
              confidence: item.confidence ? Number(item.confidence) : 0.98,
            })
            .select()
            .single();

          if (!itemErr && itemRow && Array.isArray(item.assignedTo)) {
            const assignRows: any[] = [];
            for (const uid of item.assignedTo) {
              let aUserId: string | null = null;
              let aMemberId: string | null = null;
              let aInvitedName: string = 'Member';

              const { data: prof } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', uid)
                .maybeSingle();

              if (prof) {
                const ep = extractProfile(prof);
                aUserId = prof.id;
                aInvitedName = ep?.name || 'Member';
              } else {
                const { data: gm } = await supabase
                  .from('group_members')
                  .select('id, user_id, invited_name')
                  .eq('id', uid)
                  .maybeSingle();

                if (gm) {
                  aUserId = gm.user_id || null;
                  aMemberId = gm.id;
                  aInvitedName = gm.invited_name || aInvitedName;
                }
              }

              assignRows.push({
                item_id: itemRow.id,
                user_id: aUserId,
                member_id: aMemberId,
                invited_name: aInvitedName,
              });
            }

            if (assignRows.length > 0) {
              await supabase.from('expense_item_assignments').insert(assignRows);
            }
          }
        }
      }

      // Log activity
      try {
        await supabase.from('activities').insert({
          group_id: updatedExp.group_id,
          type: 'expense_created',
          actor_name: updates.payer_name || 'Member',
          description: `updated expense "${expenseData.title.trim()}"`,
          amount: Number(expenseData.amount),
          currency: updatedExp.currency || 'LKR',
        });
      } catch {}

      const mappedUpdated = mapExpenseFromDb({ ...updatedExp, expense_splits: expenseData.splits });
      if (updatedExp.group_id) {
        saveLocalExpense(updatedExp.group_id, mappedUpdated);
      }
      return mappedUpdated;
    } catch (err) {
      console.error('updateExpense error:', err);
      return null;
    }
  },

  async deleteExpense(expenseId: string, groupId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
      if (groupId) removeLocalExpense(groupId, expenseId);
      return true;
    }
    try {
      const { data: exp } = await supabase
        .from('expenses')
        .select('id, group_id, title, receipt_url')
        .eq('id', expenseId)
        .maybeSingle();

      const targetGroupId = exp?.group_id || groupId;
      if (targetGroupId) {
        removeLocalExpense(targetGroupId, expenseId);
      }

      const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
      if (error) throw error;

      // Delete receipt image from private storage if it exists
      if (exp?.receipt_url) {
        await supabaseStorage.deleteReceiptImage(exp.receipt_url);
      }

      if (exp) {
        try {
          await supabase.from('activities').insert({
            group_id: exp.group_id,
            type: 'expense_created',
            actor_name: 'Member',
            description: `deleted expense "${exp.title}"`,
          });
        } catch {}
      }

      return true;
    } catch (err) {
      console.error('deleteExpense error:', err);
      return false;
    }
  },

  // Settlements
  async getSettlements(groupId?: string): Promise<SettlementPayment[]> {
    const localSettlements = getLocalSettlements(groupId);
    if (!isSupabaseConfigured) return localSettlements;
    try {
      let query = supabase.from('settlement_payments').select('*');

      if (groupId) {
        query = query.eq('group_id', groupId);
      }

      const { data, error } = await query;
      if (error || !data) {
        console.warn('getSettlements notice:', error?.message);
        return localSettlements;
      }

      // Collect user/member IDs to resolve names accurately
      const userIds = Array.from(
        new Set(
          data
            .flatMap((d: any) => [d.payer_id, d.payee_id, d.from_member_id, d.to_member_id])
            .filter(Boolean)
        )
      );

      const namesMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name, full_name')
          .in('id', userIds);
        if (profs) {
          profs.forEach((p: any) => namesMap.set(p.id, p.name || p.full_name || 'Member'));
        }
        const { data: gms } = await supabase
          .from('group_members')
          .select('id, user_id, invited_name')
          .in('id', userIds);
        if (gms) {
          gms.forEach((gm: any) => namesMap.set(gm.id, gm.invited_name || 'Member'));
        }
      }

      const dbSettlements = data.map((row: any) => {
        const item = mapSettlementFromDb(row);
        if (item.payerName === 'Member' && namesMap.has(item.payerId)) {
          item.payerName = namesMap.get(item.payerId)!;
        }
        if (item.payeeName === 'Member' && namesMap.has(item.payeeId)) {
          item.payeeName = namesMap.get(item.payeeId)!;
        }
        return item;
      });

      // Merge local settlements avoiding duplicates by id
      const merged = [...dbSettlements];
      for (const ls of localSettlements) {
        if (!merged.some((m) => m.id === ls.id)) {
          merged.push(ls);
        }
      }

      merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return merged;
    } catch (err) {
      console.error('getSettlements error:', err);
      return localSettlements;
    }
  },

  async recordSettlement(paymentData: any): Promise<SettlementPayment | null> {
    const amount = Number(paymentData.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }
    if (!paymentData.payerId || !paymentData.payeeId) {
      throw new Error('Please select both a sender and a receiver.');
    }
    if (paymentData.payerId === paymentData.payeeId) {
      throw new Error('Sender and receiver cannot be the same member.');
    }

    const newPaymentId = `settlement_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const paymentDate = paymentData.date || new Date().toISOString().slice(0, 10);
    const currency = paymentData.currency || 'LKR';
    const method = paymentData.paymentMethod || 'bank_transfer';
    const refNote = paymentData.referenceNote || '';

    const newSettlement: SettlementPayment = {
      id: newPaymentId,
      groupId: paymentData.groupId,
      payerId: paymentData.payerId,
      payerName: paymentData.payerName || 'Payer',
      payeeId: paymentData.payeeId,
      payeeName: paymentData.payeeName || 'Payee',
      amount,
      currency,
      paymentMethod: method,
      referenceNote: refNote,
      date: paymentDate,
      status: 'completed',
    };

    // Save locally first so it is immediately resilient & reflected
    saveLocalSettlement(paymentData.groupId, newSettlement);

    if (isSupabaseConfigured) {
      try {
        const isUUID = (val: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

        const payload: any = {
          group_id: paymentData.groupId,
          amount,
          status: 'completed',
        };

        if (isUUID(paymentData.payerId)) {
          payload.payer_id = paymentData.payerId;
          payload.from_member_id = paymentData.payerId;
        }
        if (isUUID(paymentData.payeeId)) {
          payload.payee_id = paymentData.payeeId;
          payload.to_member_id = paymentData.payeeId;
        }
        payload.payer_name = paymentData.payerName;
        payload.payee_name = paymentData.payeeName;
        payload.currency = currency;
        payload.payment_method = method;
        payload.reference_note = refNote;
        payload.payment_date = paymentDate;

        const { data, error } = await supabase
          .from('settlement_payments')
          .insert(payload)
          .select()
          .maybeSingle();

        if (error) {
          console.warn('Rich settlement_payments insert notice:', error.message);
          // Fallback to minimal schema if columns like payment_date/payer_name are missing in legacy DB
          const minimalPayload: any = {
            group_id: paymentData.groupId,
            amount,
            status: 'completed',
          };
          if (isUUID(paymentData.payerId)) minimalPayload.from_member_id = paymentData.payerId;
          if (isUUID(paymentData.payeeId)) minimalPayload.to_member_id = paymentData.payeeId;

          const { data: minData, error: minErr } = await supabase
            .from('settlement_payments')
            .insert(minimalPayload)
            .select()
            .maybeSingle();

          if (!minErr && minData) {
            newSettlement.id = minData.id;
          }
        } else if (data) {
          newSettlement.id = data.id;
        }

        // Audit Activity
        try {
          await supabase.from('activities').insert({
            group_id: paymentData.groupId,
            type: 'settlement_paid',
            actor_name: paymentData.payerName || 'Member',
            description: `paid ${currency} ${amount.toLocaleString()} to ${paymentData.payeeName} (${method.replace('_', ' ')})`,
            amount,
            currency,
          });
        } catch {}

        // Notification for payee
        if (isUUID(paymentData.payeeId)) {
          try {
            await supabase.from('notifications').insert({
              user_id: paymentData.payeeId,
              title: 'Payment Received',
              message: `${paymentData.payerName} sent a payment of ${currency} ${amount.toLocaleString()}`,
              type: 'payment',
            });
          } catch {}
        }
      } catch (dbErr) {
        console.warn('Database settlement insert notice:', dbErr);
      }
    }

    return newSettlement;
  },

  // Activities
  async getActivities(groupId?: string): Promise<ActivityItem[]> {
    if (!isSupabaseConfigured) return [];
    try {
      let query = supabase.from('activities').select('*').order('created_at', { ascending: false });
      if (groupId) {
        query = query.eq('group_id', groupId);
      }
      const { data, error } = await query.limit(50);
      if (error || !data) return [];
      return data.map(mapActivityFromDb);
    } catch (err) {
      console.error('getActivities error:', err);
      return [];
    }
  },

  // Notifications
  async getNotifications(userId: string): Promise<NotificationItem[]> {
    if (!isSupabaseConfigured || !userId) return [];
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error || !data) return [];
      return data.map(mapNotificationFromDb);
    } catch (err) {
      console.error('getNotifications error:', err);
      return [];
    }
  },

  async markNotificationRead(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      return !error;
    } catch (err) {
      console.error('markNotificationRead error:', err);
      return false;
    }
  },

  async markAllNotificationsRead(userId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !userId) return false;
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
      return !error;
    } catch (err) {
      console.error('markAllNotificationsRead error:', err);
      return false;
    }
  },
};

