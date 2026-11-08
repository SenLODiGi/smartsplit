import { supabase, isSupabaseConfigured } from './supabase';
import { supabaseStorage } from './supabaseStorage';
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

  let defaultPayerId = row.payer_id || row.payer_member_id || '';

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
    title: row.title,
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
            gm.invited_name ||
            (gm.invited_email ? gm.invited_email.split('@')[0] : 'Member');
          const email = extracted?.email || gm.invited_email || '';
          const avatar =
            extracted?.avatar ||
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
          gm.invited_name ||
          (gm.invited_email ? gm.invited_email.split('@')[0] : 'Member');
        const email = extracted?.email || gm.invited_email || '';
        const avatar =
          extracted?.avatar ||
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
        await supabase
          .from('profiles')
          .insert({
            id: currentAuthUserId,
            email: currentAuthUser?.email || '',
            name: fallbackName,
            full_name: fallbackName,
          })
          .catch((pErr) => {
            console.warn('Profile sync on createGroup warning:', pErr.message);
          });
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

      // 3. Insert creator into group_members as admin (Required operation)
      const { error: memberErr } = await supabase.from('group_members').insert({
        group_id: newGroup.id,
        user_id: currentAuthUserId,
        role: 'admin',
      });

      if (memberErr) {
        console.error('Creator membership insertion failed. Rolling back group creation:', memberErr.message);
        // CRITICAL: Roll back the created group to maintain transactional integrity
        await supabase.from('groups').delete().eq('id', newGroup.id);
        return { group: null, error: `Failed to register group admin membership: ${memberErr.message}` };
      }

      // 4. Insert initial invited members if provided
      if (Array.isArray(data.memberNames) && data.memberNames.length > 0) {
        for (const mName of data.memberNames) {
          const clean = mName.trim();
          if (clean && clean !== currentAuthUserId) {
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('*')
              .or(`email.ilike.${clean},name.ilike.${clean},full_name.ilike.${clean}`)
              .maybeSingle();

            if (existingProfile && existingProfile.id !== currentAuthUserId) {
              await supabase.from('group_members').insert({
                group_id: newGroup.id,
                user_id: existingProfile.id,
                role: 'member',
              }).catch(() => {});
            } else {
              await supabase.from('group_members').insert({
                group_id: newGroup.id,
                invited_name: clean,
                role: 'member',
              }).catch(() => {});
            }
          }
        }
      }

      // 5. Log group created activity
      await supabase.from('activities').insert({
        group_id: newGroup.id,
        type: 'group_created',
        actor_id: currentAuthUserId,
        actor_name: currentAuthUser?.user_metadata?.full_name || 'Creator',
        description: `created group "${newGroup.name}"`,
      }).catch(() => {});

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
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();
        matchedProfile = prof;
      }
      if (!matchedProfile && cleanName) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .or(`full_name.ilike.${cleanName},name.ilike.${cleanName}`)
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

      if (!error && data) {
        return data.map(mapExpenseFromDb);
      }

      // 2. Fallback query if expense_payments or member_id not yet migrated
      const { data: fallbackData, error: fbError } = await supabase
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
        p_payers: expenseData.payers || [],
      });

      if (!rpcErr && rpcData) {
        return mapExpenseFromDb(rpcData);
      }

      // 2. Direct fallback insert if RPC is not present
      let payerIdToInsert: string | null = expenseData.payerId;
      let payerMemberIdToInsert: string | null = null;
      let payerNameToInsert = 'Member';

      if (expenseData.payers && Array.isArray(expenseData.payers) && expenseData.payers.length > 0) {
        const firstPayer = expenseData.payers[0];
        payerIdToInsert = firstPayer.userId;
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

      const paymentsToInsert: any[] = [];
      for (const p of payersList) {
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
          expense_id: expRow.id,
          user_id: pUserId,
          member_id: pMemberId,
          payer_name: pName,
          amount_paid: Number(p.amount) || 0,
        });
      }

      if (paymentsToInsert.length > 0) {
        await supabase
          .from('expense_payments')
          .insert(paymentsToInsert)
          .catch((pErr) => {
            console.warn('expense_payments insert notice:', pErr.message);
          });
      }

      // Insert items and item assignments if present
      if (expenseData.items && Array.isArray(expenseData.items) && expenseData.items.length > 0) {
        for (const item of expenseData.items) {
          const { data: itemRow, error: itemErr } = await supabase
            .from('expense_items')
            .insert({
              expense_id: expRow.id,
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
        await supabase.from('expense_payments').delete().eq('expense_id', expenseId).catch(() => {});

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
            amount_paid: Number(p.amount) || 0,
          });
        }

        if (paymentsToInsert.length > 0) {
          await supabase
            .from('expense_payments')
            .insert(paymentsToInsert)
            .catch((pErr) => {
              console.warn('expense_payments update notice:', pErr.message);
            });
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
        .select('id, group_id, title, receipt_url')
        .eq('id', expenseId)
        .maybeSingle();

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

