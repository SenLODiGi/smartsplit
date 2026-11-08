import { supabase, isSupabaseConfigured } from './supabase';
import {
  Group,
  GroupMember,
  Expense,
  ExpenseSplit,
  ExpenseItem,
  SettlementPayment,
  ActivityItem,
  NotificationItem,
  User,
} from '../types';

/**
 * Maps PostgreSQL snake_case rows to frontend camelCase interfaces
 */

export function mapGroupFromDb(row: any, members: GroupMember[] = []): Group {
  const creatorMember = members.find((m) => m.userId === row.created_by);
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
    creatorName: row.creator?.name || creatorMember?.name || 'Group Admin',
  };
}

export function mapExpenseFromDb(row: any): Expense {
  const splits: ExpenseSplit[] = (row.expense_splits || []).map((s: any) => {
    const rawId = s.user_id || s.member_id || s.id;
    const name =
      s.profiles?.name ||
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
    assignedTo: (i.expense_item_assignments || []).map((a: any) => a.user_id),
  }));

  const payerName =
    row.profiles?.name ||
    row.payer?.name ||
    row.payer_name ||
    row.payer_member?.invited_name ||
    'Member';

  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    amount: Number(row.amount) || 0,
    currency: row.currency || 'LKR',
    category: row.category || 'food',
    payerId: row.payer_id || row.payer_member_id || '',
    payerName,
    date: row.expense_date || new Date().toISOString().slice(0, 10),
    splitMethod: row.split_method || 'equal',
    splits,
    items,
    receiptUrl: row.receipt_url || '',
    notes: row.notes || '',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function mapSettlementFromDb(row: any): SettlementPayment {
  return {
    id: row.id,
    groupId: row.group_id,
    payerId: row.payer_id,
    payerName: row.payer?.name || 'Payer',
    payeeId: row.payee_id,
    payeeName: row.payee?.name || 'Payee',
    amount: Number(row.amount) || 0,
    currency: row.currency || 'LKR',
    paymentMethod: row.payment_method || 'bank_transfer',
    referenceNote: row.reference_note || '',
    date: row.payment_date || new Date().toISOString().slice(0, 10),
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
      let groupsData: any = null;
      let groupsErr: any = null;

      // Primary query with invited members, creator and expenses
      const res = await supabase
        .from('groups')
        .select(`
          *,
          creator:created_by ( id, name, email ),
          group_members (
            id,
            user_id,
            role,
            invited_name,
            invited_email,
            profiles (
              id,
              name,
              email,
              avatar,
              initials
            )
          ),
          expenses (
            id,
            amount
          )
        `)
        .order('created_at', { ascending: false });

      groupsData = res.data;
      groupsErr = res.error;

      // Fallback query if columns not yet migrated
      if (groupsErr) {
        const fallbackRes = await supabase
          .from('groups')
          .select(`
            *,
            creator:created_by ( id, name, email ),
            group_members (
              id,
              user_id,
              role,
              profiles (
                id,
                name,
                email,
                avatar,
                initials
              )
            )
          `)
          .order('created_at', { ascending: false });
        groupsData = fallbackRes.data;
        groupsErr = fallbackRes.error;
      }

      if (groupsErr || !groupsData) {
        console.warn('Supabase getGroups notice:', groupsErr?.message);
        return [];
      }

      return groupsData.map((g: any) => {
        const members: GroupMember[] = (g.group_members || []).map((gm: any) => {
          const isRegistered = Boolean(gm.profiles);
          const name = isRegistered
            ? gm.profiles?.name || 'Member'
            : gm.invited_name || (gm.invited_email ? gm.invited_email.split('@')[0] : 'Invited Member');
          const email = isRegistered ? gm.profiles?.email || '' : gm.invited_email || '';
          const avatar = isRegistered
            ? gm.profiles?.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
            : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
          const initials = isRegistered
            ? gm.profiles?.initials || name.slice(0, 2).toUpperCase()
            : name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

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
        const grp = mapGroupFromDb(g, members);
        if (g.expenses && Array.isArray(g.expenses)) {
          grp.expensesCount = g.expenses.length;
          grp.totalSpend = g.expenses.reduce(
            (sum: number, e: any) => sum + (Number(e.amount) || 0),
            0
          );
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
      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          creator:created_by ( id, name, email ),
          group_members (
            id,
            user_id,
            role,
            invited_name,
            invited_email,
            profiles ( id, name, email, avatar, initials )
          ),
          expenses ( id, amount )
        `)
        .eq('id', groupId)
        .single();

      if (error || !data) return null;

      const members: GroupMember[] = (data.group_members || []).map((gm: any) => {
        const isRegistered = Boolean(gm.profiles);
        const name = isRegistered
          ? gm.profiles?.name || 'Member'
          : gm.invited_name || (gm.invited_email ? gm.invited_email.split('@')[0] : 'Invited Member');
        const email = isRegistered ? gm.profiles?.email || '' : gm.invited_email || '';
        const avatar = isRegistered
          ? gm.profiles?.avatar ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
          : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
        const initials = isRegistered
          ? gm.profiles?.initials || name.slice(0, 2).toUpperCase()
          : name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

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

      const grp = mapGroupFromDb(data, members);
      if (data.expenses && Array.isArray(data.expenses)) {
        grp.expensesCount = data.expenses.length;
        grp.totalSpend = data.expenses.reduce(
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
  }): Promise<Group | null> {
    if (!isSupabaseConfigured) return null;
    try {
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

      if (!rpcErr && rpcGroup) {
        // Fetch freshly created group with members
        const { data: freshGroup } = await supabase
          .from('groups')
          .select(`
            *,
            creator:created_by ( id, name, email ),
            group_members (
              id,
              user_id,
              role,
              invited_name,
              invited_email,
              profiles ( id, name, email, avatar, initials )
            )
          `)
          .eq('id', rpcGroup.id)
          .single();

        if (freshGroup) {
          const members: GroupMember[] = (freshGroup.group_members || []).map((gm: any) => ({
            id: gm.id,
            userId: gm.user_id || gm.id,
            role: gm.role,
            name: gm.profiles?.name || gm.invited_name || 'Member',
            email: gm.profiles?.email || gm.invited_email || '',
            avatar: gm.profiles?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
            initials: gm.profiles?.initials || 'M',
          }));
          return mapGroupFromDb(freshGroup, members);
        }
        return mapGroupFromDb(rpcGroup, []);
      }

      // 2. Direct Supabase insert fallback
      const { data: newGroup, error: groupErr } = await supabase
        .from('groups')
        .insert({
          name: data.name.trim(),
          description: data.description?.trim() || '',
          currency: (data.currency || 'LKR').toUpperCase(),
          category: data.category || 'trip',
          cover_gradient,
          created_by: data.userId,
        })
        .select()
        .single();

      if (groupErr || !newGroup) throw groupErr || new Error('Failed to create group');

      // Add creator as admin
      await supabase.from('group_members').insert({
        group_id: newGroup.id,
        user_id: data.userId,
        role: 'admin',
      });

      // Add initial invited members if provided
      if (Array.isArray(data.memberNames) && data.memberNames.length > 0) {
        for (const mName of data.memberNames) {
          const clean = mName.trim();
          if (clean && clean !== data.userId) {
            // Check if profile exists
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('id, name, email')
              .or(`email.ilike.${clean},name.ilike.${clean}`)
              .maybeSingle();

            if (existingProfile && existingProfile.id !== data.userId) {
              await supabase.from('group_members').insert({
                group_id: newGroup.id,
                user_id: existingProfile.id,
                role: 'member',
              });
            } else {
              await supabase.from('group_members').insert({
                group_id: newGroup.id,
                invited_name: clean,
                role: 'member',
              });
            }
          }
        }
      }

      // Log group created activity
      await supabase.from('activities').insert({
        group_id: newGroup.id,
        type: 'group_created',
        actor_name: 'You',
        description: `created group "${newGroup.name}"`,
      });

      return mapGroupFromDb(newGroup, []);
    } catch (err) {
      console.error('Supabase createGroup error:', err);
      return null;
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
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
    try {
      const cleanName = name.trim();
      const cleanEmail = email?.trim().toLowerCase();

      if (!cleanName && !cleanEmail) {
        return { success: false, error: 'Member name or email is required.' };
      }

      // 1. Check if a profile matches the email or name
      let matchedProfile: any = null;
      if (cleanEmail) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, name, email')
          .eq('email', cleanEmail)
          .maybeSingle();
        matchedProfile = prof;
      }

      // 2. Prevent duplicate membership check
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

        if (insertErr) throw insertErr;
      } else {
        // Check duplicate by invited_email
        if (cleanEmail) {
          const { data: existingInv } = await supabase
            .from('group_members')
            .select('id')
            .eq('group_id', groupId)
            .ilike('invited_email', cleanEmail)
            .maybeSingle();

          if (existingInv) {
            return { success: false, error: 'An invitation has already been added with this email.' };
          }
        }

        // Insert as invited guest (without fake auth user ID)
        const { error: invErr } = await supabase.from('group_members').insert({
          group_id: groupId,
          invited_name: cleanName || cleanEmail?.split('@')[0] || 'Guest',
          invited_email: cleanEmail || null,
          role: 'member',
        });

        if (invErr) {
          if (invErr.message.includes('column') || invErr.message.includes('invited_name')) {
            return {
              success: false,
              error: 'Database update required: Please run supabase_phase2_migration.sql in Supabase SQL Editor to enable invited guests.',
            };
          }
          throw invErr;
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
    if (!isSupabaseConfigured) return [];
    try {
      // 1. Primary query with profiles, members and items
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          profiles:payer_id ( id, name, avatar, initials ),
          expense_splits (
            id,
            user_id,
            member_id,
            invited_name,
            amount,
            percentage,
            shares,
            profiles:user_id ( id, name, avatar ),
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

      if (!error && data) {
        return data.map(mapExpenseFromDb);
      }

      // 2. Fallback query if member_id not yet migrated
      const { data: fallbackData, error: fbError } = await supabase
        .from('expenses')
        .select(`
          *,
          profiles:payer_id ( id, name, avatar, initials ),
          expense_splits (
            id,
            user_id,
            amount,
            percentage,
            shares,
            profiles:user_id ( id, name )
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

      if (fbError || !fallbackData) {
        console.warn('getExpenses notice:', fbError?.message || error?.message);
        return [];
      }

      return fallbackData.map(mapExpenseFromDb);
    } catch (err) {
      console.error('getExpenses error:', err);
      return [];
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

      if (error || !data) return null;
      return mapExpenseFromDb(data);
    } catch (err) {
      console.error('getExpenseById error:', err);
      return null;
    }
  },

  async createExpense(expenseData: any): Promise<Expense | null> {
    if (!isSupabaseConfigured) return null;
    try {
      // 1. Try atomic stored procedure first for 100% transactional safety
      const { data: rpcData, error: rpcErr } = await supabase.rpc('create_complete_expense', {
        p_group_id: expenseData.groupId,
        p_payer_id: expenseData.payerId,
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
      });

      if (!rpcErr && rpcData) {
        return mapExpenseFromDb(rpcData);
      }

      // 2. Direct fallback insert if RPC is not present
      let payerIdToInsert: string | null = expenseData.payerId;
      let payerMemberIdToInsert: string | null = null;
      let payerNameToInsert = 'Member';

      if (expenseData.payerId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('id', expenseData.payerId)
          .maybeSingle();

        if (prof) {
          payerIdToInsert = prof.id;
          payerNameToInsert = prof.name;
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

      const { data: expRow, error: expErr } = await supabase
        .from('expenses')
        .insert({
          group_id: expenseData.groupId,
          payer_id: payerIdToInsert,
          payer_member_id: payerMemberIdToInsert,
          payer_name: payerNameToInsert,
          title: expenseData.title.trim(),
          amount: Number(expenseData.amount),
          currency: expenseData.currency || 'LKR',
          category: expenseData.category || 'food',
          expense_date: expenseData.date || new Date().toISOString().slice(0, 10),
          split_method: expenseData.splitMethod || 'equal',
          notes: expenseData.notes || '',
          receipt_url: expenseData.receiptUrl || '',
        })
        .select()
        .single();

      if (expErr || !expRow) throw expErr || new Error('Failed to insert expense');

      // Insert splits
      if (expenseData.splits && Array.isArray(expenseData.splits)) {
        const splitsToInsert: any[] = [];
        for (const s of expenseData.splits) {
          let sUserId: string | null = null;
          let sMemberId: string | null = null;
          let sInvitedName: string = s.userName || 'Member';

          if (s.userId) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('id, name')
              .eq('id', s.userId)
              .maybeSingle();

            if (prof) {
              sUserId = prof.id;
              sInvitedName = prof.name;
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
            expense_id: expRow.id,
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

      return mapExpenseFromDb({
        ...expRow,
        expense_splits: expenseData.splits,
      });
    } catch (err) {
      console.error('createExpense error:', err);
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

      if (expenseData.payerId) {
        // Resolve profile or member
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('id', expenseData.payerId)
          .maybeSingle();

        if (prof) {
          updates.payer_id = prof.id;
          updates.payer_name = prof.name;
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
              .select('id, name')
              .eq('id', s.userId)
              .maybeSingle();

            if (prof) {
              sUserId = prof.id;
              sInvitedName = prof.name;
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

      return mapExpenseFromDb({ ...updatedExp, expense_splits: expenseData.splits });
    } catch (err) {
      console.error('updateExpense error:', err);
      return null;
    }
  },

  async deleteExpense(expenseId: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { data: exp } = await supabase
        .from('expenses')
        .select('id, group_id, title')
        .eq('id', expenseId)
        .maybeSingle();

      const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
      if (error) throw error;

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
    if (!isSupabaseConfigured) return [];
    try {
      let query = supabase
        .from('settlement_payments')
        .select(`
          *,
          payer:payer_id ( name ),
          payee:payee_id ( name )
        `)
        .order('payment_date', { ascending: false });

      if (groupId) {
        query = query.eq('group_id', groupId);
      }

      const { data, error } = await query;
      if (error || !data) return [];
      return data.map(mapSettlementFromDb);
    } catch (err) {
      console.error('getSettlements error:', err);
      return [];
    }
  },

  async recordSettlement(paymentData: any): Promise<SettlementPayment | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase
        .from('settlement_payments')
        .insert({
          group_id: paymentData.groupId,
          payer_id: paymentData.payerId,
          payee_id: paymentData.payeeId,
          amount: Number(paymentData.amount),
          currency: paymentData.currency || 'LKR',
          payment_method: paymentData.paymentMethod || 'bank_transfer',
          reference_note: paymentData.referenceNote || '',
          payment_date: paymentData.date || new Date().toISOString().slice(0, 10),
          status: 'completed',
        })
        .select()
        .single();

      if (error || !data) throw error;
      return mapSettlementFromDb(data);
    } catch (err) {
      console.error('recordSettlement error:', err);
      return null;
    }
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

