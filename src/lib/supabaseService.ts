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
  };
}

export function mapExpenseFromDb(row: any): Expense {
  const splits: ExpenseSplit[] = (row.expense_splits || []).map((s: any) => ({
    userId: s.user_id,
    userName: s.profiles?.name || 'Member',
    amount: Number(s.amount) || 0,
    percentage: s.percentage ? Number(s.percentage) : undefined,
    shares: s.shares ? Number(s.shares) : undefined,
  }));

  const items: ExpenseItem[] = (row.expense_items || []).map((i: any) => ({
    id: i.id,
    name: i.name,
    quantity: Number(i.quantity) || 1,
    unitPrice: Number(i.unit_price) || 0,
    totalPrice: Number(i.total_price) || 0,
    confidence: i.confidence ? Number(i.confidence) : 0.98,
    assignedTo: (i.expense_item_assignments || []).map((a: any) => a.user_id),
  }));

  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    amount: Number(row.amount) || 0,
    currency: row.currency || 'LKR',
    category: row.category || 'food',
    payerId: row.payer_id,
    payerName: row.profiles?.name || 'Member',
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
      const { data: groupsData, error: groupsErr } = await supabase
        .from('groups')
        .select(`
          *,
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

      if (groupsErr || !groupsData) {
        console.warn('Supabase getGroups notice:', groupsErr?.message);
        return [];
      }

      return groupsData.map((g: any) => {
        const members: GroupMember[] = (g.group_members || []).map((gm: any) => ({
          id: gm.id,
          userId: gm.user_id,
          role: gm.role,
          name: gm.profiles?.name || 'Member',
          email: gm.profiles?.email || '',
          avatar: gm.profiles?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
          initials: gm.profiles?.initials || 'M',
        }));
        return mapGroupFromDb(g, members);
      });
    } catch (err) {
      console.error('Failed to get groups:', err);
      return [];
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

  // Expenses
  async getExpenses(groupId: string): Promise<Expense[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          profiles:payer_id ( name, avatar, initials ),
          expense_splits (
            user_id,
            amount,
            percentage,
            shares,
            profiles:user_id ( name )
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

      if (error || !data) {
        console.warn('getExpenses notice:', error?.message);
        return [];
      }

      return data.map(mapExpenseFromDb);
    } catch (err) {
      console.error('getExpenses error:', err);
      return [];
    }
  },

  async createExpense(expenseData: any): Promise<Expense | null> {
    if (!isSupabaseConfigured) return null;
    try {
      // Try atomic stored procedure first
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

      // Direct fallback insert if RPC is not present
      const { data: expRow, error: expErr } = await supabase
        .from('expenses')
        .insert({
          group_id: expenseData.groupId,
          payer_id: expenseData.payerId,
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

      if (expErr || !expRow) throw expErr;

      // Insert splits
      if (expenseData.splits && Array.isArray(expenseData.splits)) {
        const splitsToInsert = expenseData.splits.map((s: any) => ({
          expense_id: expRow.id,
          user_id: s.userId,
          amount: Number(s.amount) || 0,
          percentage: s.percentage ? Number(s.percentage) : null,
          shares: s.shares ? Number(s.shares) : null,
        }));
        await supabase.from('expense_splits').insert(splitsToInsert);
      }

      return mapExpenseFromDb(expRow);
    } catch (err) {
      console.error('createExpense error:', err);
      return null;
    }
  },

  async deleteExpense(expenseId: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
      return !error;
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

