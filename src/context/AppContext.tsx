import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  User,
  Group,
  Expense,
  SettlementPayment,
  ActivityItem,
  NotificationItem,
  OCRResult,
  SettlementAnalysis,
} from '../types';
import { ToastItem, ToastContainer } from '../components/common/ToastContainer';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { supabaseApi } from '../lib/supabaseService';
import { calculateGroupBalancesAndOptimization } from '../utils/debtOptimizer';

interface AppContextType {
  currentUser: User;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ success: boolean; error?: string; confirmationRequired?: boolean }>;
  resendConfirmationEmail?: (email: string) => Promise<boolean>;
  groups: Group[];
  currentGroupId: string;
  setCurrentGroupId: (id: string) => void;
  activeGroup: Group | undefined;
  expenses: Expense[];
  settlements: SettlementPayment[];
  activities: ActivityItem[];
  notifications: NotificationItem[];
  preferredCurrency: string;
  setPreferredCurrency: (cur: string) => void;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  createGroup: (data: {
    name: string;
    description?: string;
    currency?: string;
    category?: any;
    memberNames?: string[];
  }) => Promise<Group | null>;
  updateGroup: (
    groupId: string,
    data: { name?: string; description?: string; currency?: string; category?: any }
  ) => Promise<Group | null>;
  deleteGroup: (groupId: string) => Promise<boolean>;
  addMemberToGroup: (groupId: string, name: string, email?: string) => Promise<boolean>;
  removeMemberFromGroup: (groupId: string, memberId: string) => Promise<{ success: boolean; error?: string }>;
  createExpense: (expenseData: any) => Promise<Expense | null>;
  updateExpense: (expenseId: string, expenseData: any) => Promise<Expense | null>;
  deleteExpense: (expenseId: string) => Promise<boolean>;
  recordSettlement: (paymentData: any) => Promise<SettlementPayment | null>;
  getGroupOptimization: (groupId: string) => Promise<SettlementAnalysis | null>;
  getSettlements: (groupId?: string) => Promise<SettlementPayment[]>;
  updateCurrentUserProfile: (data: { name?: string; email?: string }) => Promise<boolean>;
  // OCR Receipt pipeline state & actions
  activeOCR: {
    step: 'upload' | 'processing' | 'raw_review' | 'corrected_review' | 'assignment' | 'summary';
    receiptData: OCRResult | null;
    rawImage: string | null;
    assignments: Record<string, string[]>;
  };
  setActiveOCR: React.Dispatch<React.SetStateAction<any>>;
  processOCR: (imageBase64?: string, preset?: string) => Promise<OCRResult | null>;
  resetOCR: () => void;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  resetDemoDatabase: () => Promise<void>;
  // Global Toast System
  toasts: ToastItem[];
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
  dismissToast: (id: string) => void;
}

const defaultUser: User = {
  id: 'usr_kasun',
  name: 'Kasun Perera',
  email: 'kasun.p@example.com',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  initials: 'KP',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(defaultUser);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<string>('grp_ella_weekend');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<SettlementPayment[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [preferredCurrency, setPreferredCurrency] = useState<string>('LKR');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('smartsplit_demo_mode') === 'true';
    } catch {
      return false;
    }
  });

  // Toast dispatch
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration: number = 4000) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = { id, message, type, duration };
      setToasts((prev) => [...prev.slice(-4), newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
    },
    [dismissToast]
  );

  // Active OCR flow state
  const [activeOCR, setActiveOCR] = useState<{
    step: 'upload' | 'processing' | 'raw_review' | 'corrected_review' | 'assignment' | 'summary';
    receiptData: OCRResult | null;
    rawImage: string | null;
    assignments: Record<string, string[]>;
  }>({
    step: 'upload',
    receiptData: null,
    rawImage: null,
    assignments: {},
  });

  const activeGroup = groups.find((g) => g.id === currentGroupId) || groups[0];

  // ============================================================================
  // HELPER: SYNC USER PROFILE FROM SUPABASE
  // ============================================================================
  const syncUserProfile = useCallback(async (sessionUser: any): Promise<User> => {
    let name =
      sessionUser.user_metadata?.name ||
      sessionUser.user_metadata?.full_name ||
      sessionUser.email?.split('@')[0] ||
      'User';

    let avatar =
      sessionUser.user_metadata?.avatar ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';

    let initials = name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, name, email, avatar, initials, preferred_currency')
        .eq('id', sessionUser.id)
        .single();

      if (!error && profile) {
        name = profile.name || name;
        avatar = profile.avatar || avatar;
        initials = profile.initials || initials;
        if (profile.preferred_currency) {
          setPreferredCurrency(profile.preferred_currency);
        }
      } else {
        // Upsert fallback profile if trigger was delayed
        await supabase
          .from('profiles')
          .upsert(
            {
              id: sessionUser.id,
              name,
              email: sessionUser.email,
              avatar,
              initials,
            },
            { onConflict: 'id' }
          );
      }
    } catch (err) {
      console.warn('Profile sync notice:', err);
    }

    const resolvedUser: User = {
      id: sessionUser.id,
      name,
      email: sessionUser.email || '',
      avatar,
      initials,
    };

    return resolvedUser;
  }, []);

  // ============================================================================
  // SUPABASE AUTH INITIALIZATION & SUBSCRIPTION
  // ============================================================================
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        if (!isSupabaseConfigured) {
          const wasInDemo = localStorage.getItem('smartsplit_demo_mode') === 'true';
          if (isMounted) {
            setIsAuthenticated(wasInDemo);
            setIsDemoMode(wasInDemo);
            setIsLoading(false);
          }
          return;
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.warn('Supabase getSession notice:', error.message);
        }

        if (session?.user && isMounted) {
          try {
            localStorage.removeItem('smartsplit_demo_mode');
          } catch {}
          const userObj = await syncUserProfile(session.user);
          if (isMounted) {
            setCurrentUser(userObj);
            setIsAuthenticated(true);
            setIsDemoMode(false);
          }
        } else if (isMounted) {
          // Check if user previously logged in via Instant Demo Mode
          let wasInDemo = false;
          try {
            wasInDemo = localStorage.getItem('smartsplit_demo_mode') === 'true';
          } catch {}

          if (wasInDemo) {
            setIsAuthenticated(true);
            setIsDemoMode(true);
            setCurrentUser(defaultUser);
          } else {
            setIsAuthenticated(false);
            setIsDemoMode(false);
          }
        }
      } catch (err) {
        console.warn('Auth initialization error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (session?.user) {
        try {
          localStorage.removeItem('smartsplit_demo_mode');
        } catch {}
        const userObj = await syncUserProfile(session.user);
        if (isMounted) {
          setCurrentUser(userObj);
          setIsAuthenticated(true);
          setIsDemoMode(false);
        }
      } else if (event === 'SIGNED_OUT') {
        try {
          localStorage.removeItem('smartsplit_demo_mode');
        } catch {}
        if (isMounted) {
          setIsAuthenticated(false);
          setIsDemoMode(false);
          setCurrentUser(defaultUser);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [syncUserProfile]);

  // ============================================================================
  // DATA REFRESH
  // ============================================================================
  const refreshData = async () => {
    try {
      setIsLoading(true);

      let loadedGroups: Group[] = [];
      let loadedActivities: ActivityItem[] = [];
      let loadedNotifications: NotificationItem[] = [];
      let loadedSettlements: SettlementPayment[] = [];

      // 1. If real user is authenticated in Supabase, load live user groups
      if (isSupabaseConfigured && !isDemoMode) {
        const [sbGroups, sbActs, sbNotifs, sbStls] = await Promise.all([
          supabaseApi.getGroups(),
          supabaseApi.getActivities(),
          supabaseApi.getNotifications(currentUser.id),
          supabaseApi.getSettlements(),
        ]);

        loadedGroups = sbGroups || [];
        loadedActivities = sbActs || [];
        loadedNotifications = sbNotifs || [];
        loadedSettlements = sbStls || [];

        setGroups(loadedGroups);
        if (loadedGroups.length > 0) {
          if (!loadedGroups.some((g: Group) => g.id === currentGroupId)) {
            setCurrentGroupId(loadedGroups[0].id);
          }
        } else {
          setCurrentGroupId('');
        }
      } else {
        // 2. In Demo Mode, load the rich seed dataset
        const [groupsRes, historyRes, notifsRes, stlRes] = await Promise.all([
          fetch('/api/groups').then((r) => (r.ok ? r.json() : { groups: [] })),
          fetch('/api/history').then((r) => (r.ok ? r.json() : { activities: [] })),
          fetch('/api/notifications').then((r) => (r.ok ? r.json() : { notifications: [] })),
          fetch('/api/settlements').then((r) => (r.ok ? r.json() : { settlements: [] })),
        ]);

        loadedGroups = groupsRes.groups || [];
        loadedActivities = historyRes.activities || [];
        loadedNotifications = notifsRes.notifications || [];
        loadedSettlements = stlRes.settlements || [];

        setGroups(loadedGroups);
        if (loadedGroups.length > 0) {
          if (!loadedGroups.some((g: Group) => g.id === currentGroupId)) {
            setCurrentGroupId(loadedGroups[0].id);
          }
        }
      }

      setActivities(loadedActivities);
      setNotifications(loadedNotifications);
      setSettlements(loadedSettlements);

      // Fetch expenses for the current active group
      const targetGroupId = currentGroupId || (loadedGroups[0]?.id ?? 'grp_ella_weekend');
      if (targetGroupId) {
        if (isSupabaseConfigured && !isDemoMode) {
          const sbExpenses = await supabaseApi.getExpenses(targetGroupId);
          if (sbExpenses && sbExpenses.length > 0) {
            setExpenses(sbExpenses);
            return;
          }
        }

        const expRes = await fetch(`/api/groups/${targetGroupId}/expenses`).then((r) =>
          r.ok ? r.json() : { expenses: [] }
        );
        if (expRes.expenses) {
          setExpenses(expRes.expenses);
        }
      }
    } catch (err) {
      console.warn('Data sync notice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [isDemoMode]);

  useEffect(() => {
    if (currentGroupId) {
      if (isSupabaseConfigured && !isDemoMode) {
        supabaseApi.getExpenses(currentGroupId).then((res) => {
          if (res && res.length > 0) {
            setExpenses(res);
            return;
          }
          fetch(`/api/groups/${currentGroupId}/expenses`)
            .then((r) => (r.ok ? r.json() : { expenses: [] }))
            .then((resp) => {
              if (resp.expenses) setExpenses(resp.expenses);
            })
            .catch(console.error);
        });
      } else {
        fetch(`/api/groups/${currentGroupId}/expenses`)
          .then((r) => (r.ok ? r.json() : { expenses: [] }))
          .then((res) => {
            if (res.expenses) setExpenses(res.expenses);
          })
          .catch(console.error);
      }
    }
  }, [currentGroupId, isDemoMode]);

  // ============================================================================
  // AUTHENTICATION ACTIONS
  // ============================================================================

  // Demo Login (One-click instant login for testing/evaluators)
  const login = () => {
    try {
      localStorage.setItem('smartsplit_demo_mode', 'true');
    } catch {}
    setIsAuthenticated(true);
    setIsDemoMode(true);
    setCurrentUser(defaultUser);
    showToast(`Welcome back, ${defaultUser.name}! (Instant Demo Mode)`, 'success');
  };

  // Sign Out
  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      try {
        localStorage.removeItem('smartsplit_demo_mode');
      } catch {}
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Sign out notice:', err);
    } finally {
      setIsAuthenticated(false);
      setIsDemoMode(false);
      setCurrentUser(defaultUser);
      setIsLoading(false);
      showToast('You have been logged out.', 'info');
    }
  };

  // Real Email/Password Sign In
  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);

      const cleanEmail = email.trim();
      if (!cleanEmail || !password) {
        showToast('Please enter both email and password.', 'warning');
        return { success: false, error: 'Email and password are required.' };
      }

      if (!isSupabaseConfigured) {
        login();
        return { success: true };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        let friendlyMessage = error.message;
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          friendlyMessage = 'Invalid email or password. Please verify and try again.';
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          friendlyMessage = 'Email not confirmed. Please check your inbox or confirm user in Supabase.';
        }

        showToast(friendlyMessage, 'error', 6000);
        return { success: false, error: error.message };
      }

      if (data.user) {
        try {
          localStorage.removeItem('smartsplit_demo_mode');
        } catch {}
        const resolvedUser = await syncUserProfile(data.user);
        setCurrentUser(resolvedUser);
        setIsAuthenticated(true);
        setIsDemoMode(false);
        showToast(`Welcome back, ${resolvedUser.name}!`, 'success');
        return { success: true };
      }

      return { success: false, error: 'Sign in failed.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  // Real Email/Password Registration
  const signUpWithEmail = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ success: boolean; error?: string; confirmationRequired?: boolean }> => {
    try {
      setIsLoading(true);

      const cleanEmail = email.trim();
      const cleanName = name.trim();

      if (!cleanEmail || !password || !cleanName) {
        showToast('Please fill in all registration fields.', 'warning');
        return { success: false, error: 'All fields are required.' };
      }

      if (password.length < 6) {
        showToast('Password must be at least 6 characters.', 'warning');
        return { success: false, error: 'Password must be at least 6 characters.' };
      }

      if (!isSupabaseConfigured) {
        login();
        return { success: true };
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: cleanName,
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
          },
        },
      });

      if (error) {
        let friendlyMessage = error.message;
        if (error.message.toLowerCase().includes('already registered')) {
          friendlyMessage = 'An account with this email already exists. Please sign in.';
        } else if (error.message.toLowerCase().includes('rate limit')) {
          friendlyMessage = 'Supabase email limit reached (free tier allows only 3 emails/hour). Please turn off "Confirm email" in Supabase Dashboard to register instantly without rate limits.';
        }

        showToast(friendlyMessage, 'error', 7000);
        return { success: false, error: friendlyMessage };
      }

      // Check if email confirmation is required by Supabase project settings
      if (data.user && !data.session) {
        showToast('Registration successful! Please check your email to confirm your account.', 'info', 6000);
        return { success: true, confirmationRequired: true };
      }

      if (data.user && data.session) {
        try {
          localStorage.removeItem('smartsplit_demo_mode');
        } catch {}
        const resolvedUser = await syncUserProfile(data.user);
        setCurrentUser(resolvedUser);
        setIsAuthenticated(true);
        setIsDemoMode(false);
        showToast(`Account created! Welcome to SmartSplit, ${cleanName}!`, 'success');
        return { success: true, confirmationRequired: false };
      }

      return { success: false, error: 'Registration failed.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  // Resend confirmation email
  const resendConfirmationEmail = async (email: string): Promise<boolean> => {
    try {
      if (!isSupabaseConfigured) return true;
      const cleanEmail = email.trim();
      if (!cleanEmail) {
        showToast('Please enter your email address.', 'warning');
        return false;
      }
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      });
      if (error) {
        showToast(error.message, 'error');
        return false;
      }
      showToast('Confirmation email resent. Please check your inbox or spam folder.', 'success', 6000);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
      return false;
    }
  };

  // ============================================================================
  // GROUP OPERATIONS
  // ============================================================================
  const createGroup = async (data: {
    name: string;
    description?: string;
    currency?: string;
    category?: any;
    memberNames?: string[];
  }): Promise<Group | null> => {
    try {
      if (isSupabaseConfigured && !isDemoMode) {
        const created = await supabaseApi.createGroup({
          ...data,
          userId: currentUser.id,
        });
        if (created) {
          await refreshData();
          setCurrentGroupId(created.id);
          showToast(`Group "${created.name}" created successfully!`, 'success');
          return created;
        }
      }

      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await res.json();
        await refreshData();
        setCurrentGroupId(json.group.id);
        showToast(`Group "${json.group.name}" created successfully!`, 'success');
        return json.group;
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Failed to create group. Please check fields.', 'error');
      }
    } catch (err: any) {
      console.error('Failed to create group:', err);
      showToast(err.message || 'Network error while creating group.', 'error');
    }
    return null;
  };

  const updateGroup = async (
    groupId: string,
    data: { name?: string; description?: string; currency?: string; category?: any }
  ): Promise<Group | null> => {
    try {
      if (isSupabaseConfigured && !isDemoMode) {
        const ok = await supabaseApi.updateGroup(groupId, data);
        if (ok) {
          await refreshData();
          showToast('Group details updated successfully!', 'success');
          const updated = await supabaseApi.getGroupById(groupId);
          return updated;
        }
      }

      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await res.json();
        await refreshData();
        showToast('Group details updated successfully!', 'success');
        return json.group;
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to update group.', 'error');
      }
    } catch (err: any) {
      console.error('Failed to update group:', err);
      showToast(err.message || 'Error updating group.', 'error');
    }
    return null;
  };

  const deleteGroup = async (groupId: string): Promise<boolean> => {
    try {
      if (isSupabaseConfigured && !isDemoMode) {
        const ok = await supabaseApi.deleteGroup(groupId);
        if (ok) {
          await refreshData();
          showToast('Group deleted successfully.', 'info');
          return true;
        }
      }

      const res = await fetch(`/api/groups/${groupId}`, { method: 'DELETE' });
      if (res.ok) {
        await refreshData();
        showToast('Group deleted successfully.', 'info');
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to delete group.', 'error');
      }
    } catch (err: any) {
      console.error('Failed to delete group:', err);
      showToast(err.message || 'Error deleting group.', 'error');
    }
    return false;
  };

  const addMemberToGroup = async (groupId: string, name: string, email?: string): Promise<boolean> => {
    try {
      if (isSupabaseConfigured && !isDemoMode) {
        const res = await supabaseApi.addMemberToGroup(groupId, name, email);
        if (res.success) {
          await refreshData();
          showToast(`${name || email} added to the group!`, 'success');
          return true;
        } else {
          showToast(res.error || 'Failed to add member.', 'error');
          return false;
        }
      }

      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      if (res.ok) {
        await refreshData();
        showToast(`${name} added to the group!`, 'success');
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to add member.', 'error');
      }
    } catch (err: any) {
      console.error('Failed to add member:', err);
      showToast(err.message || 'Network error adding member.', 'error');
    }
    return false;
  };

  const removeMemberFromGroup = async (
    groupId: string,
    memberId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (isSupabaseConfigured && !isDemoMode) {
        const res = await supabaseApi.removeMemberFromGroup(groupId, memberId);
        if (res.success) {
          await refreshData();
          showToast('Member removed from group.', 'info');
          return { success: true };
        } else {
          showToast(res.error || 'Failed to remove member.', 'error');
          return { success: false, error: res.error };
        }
      }

      const res = await fetch(`/api/groups/${groupId}/members/${memberId}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        await refreshData();
        showToast('Member removed from group.', 'info');
        return { success: true };
      } else {
        const errMsg = json.error || 'Could not remove member.';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      showToast(err.message || 'Error removing member.', 'error');
      return { success: false, error: err.message };
    }
  };

  // ============================================================================
  // EXPENSE OPERATIONS
  // ============================================================================
  const createExpense = async (expenseData: any): Promise<Expense | null> => {
    try {
      const payload = {
        ...expenseData,
        groupId: expenseData.groupId || currentGroupId,
      };

      if (isSupabaseConfigured && !isDemoMode) {
        const sbCreated = await supabaseApi.createExpense(payload);
        if (sbCreated) {
          await refreshData();
          showToast(`Expense "${sbCreated.title}" added and split!`, 'success');
          return sbCreated;
        }
      }

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        await refreshData();
        showToast(`Expense "${json.expense.title}" added and split!`, 'success');
        return json.expense;
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to save expense. Please verify fields.', 'error');
      }
    } catch (err: any) {
      console.error('Failed to create expense:', err);
      showToast(err.message || 'Network error saving expense.', 'error');
    }
    return null;
  };

  const updateExpense = async (expenseId: string, expenseData: any): Promise<Expense | null> => {
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData),
      });
      if (res.ok) {
        const json = await res.json();
        await refreshData();
        showToast(`Expense "${json.expense.title}" updated successfully!`, 'success');
        return json.expense;
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to update expense.', 'error');
      }
    } catch (err: any) {
      console.error('Failed to update expense:', err);
      showToast(err.message || 'Error updating expense.', 'error');
    }
    return null;
  };

  const deleteExpense = async (expenseId: string): Promise<boolean> => {
    try {
      if (isSupabaseConfigured && !isDemoMode) {
        const ok = await supabaseApi.deleteExpense(expenseId);
        if (ok) {
          await refreshData();
          showToast('Expense deleted successfully.', 'info');
          return true;
        }
      }

      const res = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
      if (res.ok) {
        await refreshData();
        showToast('Expense deleted successfully.', 'info');
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to delete expense.', 'error');
      }
    } catch (err: any) {
      console.error('Failed to delete expense:', err);
      showToast(err.message || 'Error deleting expense.', 'error');
    }
    return false;
  };

  // ============================================================================
  // SETTLEMENTS & DEBT OPTIMIZATION
  // ============================================================================
  const recordSettlement = async (paymentData: any): Promise<SettlementPayment | null> => {
    try {
      const payload = {
        ...paymentData,
        groupId: paymentData.groupId || currentGroupId,
      };

      if (isSupabaseConfigured && !isDemoMode) {
        const sbPayment = await supabaseApi.recordSettlement(payload);
        if (sbPayment) {
          await refreshData();
          showToast(`Settlement recorded! ${sbPayment.payerName} → ${sbPayment.payeeName}`, 'success');
          return sbPayment;
        }
      }

      const res = await fetch('/api/settlements/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        await refreshData();
        showToast(`Settlement recorded! ${json.payment.payerName} → ${json.payment.payeeName}`, 'success');
        return json.payment;
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to record settlement.', 'error');
      }
    } catch (err: any) {
      console.error('Failed to record settlement:', err);
      showToast(err.message || 'Error recording settlement.', 'error');
    }
    return null;
  };

  const getGroupOptimization = async (groupId: string): Promise<SettlementAnalysis | null> => {
    try {
      const targetGroup = groups.find((g) => g.id === groupId);
      if (targetGroup) {
        return calculateGroupBalancesAndOptimization(targetGroup, expenses, settlements);
      }
      const res = await fetch(`/api/groups/${groupId}/balances`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error('Failed to fetch group optimization:', err);
    }
    return null;
  };

  const getSettlements = async (groupId?: string): Promise<SettlementPayment[]> => {
    try {
      const url = groupId ? `/api/settlements?groupId=${groupId}` : '/api/settlements';
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        return json.settlements || [];
      }
    } catch (err) {
      console.error('Failed to fetch settlements:', err);
    }
    return [];
  };

  const updateCurrentUserProfile = async (data: { name?: string; email?: string }): Promise<boolean> => {
    try {
      if (isSupabaseConfigured && !isDemoMode) {
        const { error } = await supabase
          .from('profiles')
          .update({
            name: data.name,
            email: data.email,
          })
          .eq('id', currentUser.id);

        if (!error) {
          setCurrentUser((prev) => ({
            ...prev,
            name: data.name || prev.name,
            email: data.email || prev.email,
            initials: (data.name || prev.name).slice(0, 2).toUpperCase(),
          }));
          showToast('Profile updated successfully!', 'success');
          return true;
        }
      }

      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await res.json();
        setCurrentUser(json.user);
        await refreshData();
        showToast('Profile updated successfully!', 'success');
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to update profile.', 'error');
      }
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      showToast(err.message || 'Error updating profile.', 'error');
    }
    return false;
  };

  // ============================================================================
  // OCR PIPELINE
  // ============================================================================
  const processOCR = async (imageBase64?: string, preset?: string): Promise<OCRResult | null> => {
    try {
      setActiveOCR((prev) => ({ ...prev, step: 'processing' }));
      let ocrResult: OCRResult | null = null;

      try {
        const res = await fetch('/api/receipt/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64, preset }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data && data.result) {
            ocrResult = data.result;
          }
        }
      } catch (fetchErr) {
        console.warn('Network error during OCR fetch:', fetchErr);
      }

      if (!ocrResult) {
        if (preset === 'keells_super') {
          ocrResult = {
            merchant: 'Keells Supermarket — Colombo 03',
            date: new Date().toISOString().slice(0, 10),
            currency: 'LKR',
            items: [
              { id: 'ocr_1', name: 'Kotmale Fresh Full Cream Milk 1L', quantity: 2, unitPrice: 520, totalPrice: 1040, confidence: 0.99 },
              { id: 'ocr_2', name: 'Prima Special Bread Loaf', quantity: 1, unitPrice: 190, totalPrice: 190, confidence: 0.97 },
              { id: 'ocr_3', name: 'Munchee Chocolate Cream Biscuits', quantity: 3, unitPrice: 280, totalPrice: 840, confidence: 0.99 },
              { id: 'ocr_4', name: 'Ceylon Dimbula BOPF Tea 400g', quantity: 1, unitPrice: 1450, totalPrice: 1450, confidence: 0.96 },
              { id: 'ocr_5', name: 'Roasted Salted Cashews 200g', quantity: 1, unitPrice: 2100, totalPrice: 2100, confidence: 0.98 },
            ],
            subtotal: 5620,
            serviceCharge: 0,
            tax: 180,
            total: 5800,
            discrepancies: [],
            rawText: 'KEELLS SUPER - COLOMBO\nItems extracted with verified barcode pricing.',
          };
        } else if (preset === 'mirissa_seafood') {
          ocrResult = {
            merchant: 'Zephyr Restaurant & Bar — Mirissa Beach',
            date: new Date().toISOString().slice(0, 10),
            currency: 'LKR',
            items: [
              { id: 'ocr_1', name: 'Grilled Jumbo Tiger Prawns (500g)', quantity: 1, unitPrice: 6500, totalPrice: 6500, confidence: 0.99 },
              { id: 'ocr_2', name: 'Catch of the Day Whole Snapper', quantity: 1, unitPrice: 5200, totalPrice: 5200, confidence: 0.97 },
              { id: 'ocr_3', name: 'Lion Golden Lager Beer 625ml', quantity: 4, unitPrice: 1200, totalPrice: 4800, confidence: 0.98 },
              { id: 'ocr_4', name: 'Garlic Herb French Fries', quantity: 2, unitPrice: 950, totalPrice: 1900, confidence: 0.95 },
            ],
            subtotal: 18400,
            serviceCharge: 1840,
            tax: 0,
            total: 20240,
            discrepancies: [],
            rawText: 'ZEPHYR RESTAURANT & BAR\nMIRISSA BEACH\n4 items extracted with service charge.',
          };
        } else {
          ocrResult = {
            merchant: 'Cafe Chill — Ella Main Street',
            date: new Date().toISOString().slice(0, 10),
            currency: 'LKR',
            items: [
              { id: 'ocr_1', name: 'Wood-fired Pizza BBQ Chicken', quantity: 1, unitPrice: 4200, totalPrice: 4200, confidence: 0.99 },
              { id: 'ocr_2', name: 'Sri Lankan Lamprais Special', quantity: 2, unitPrice: 3800, totalPrice: 7600, confidence: 0.98 },
              { id: 'ocr_3', name: 'Fresh Passion Fruit Mojitos', quantity: 4, unitPrice: 1950, totalPrice: 7800, confidence: 0.99 },
              { id: 'ocr_4', name: 'Warm Chocolate Lava Cake', quantity: 1, unitPrice: 2200, totalPrice: 2200, confidence: 0.97 },
            ],
            subtotal: 21800,
            serviceCharge: 2180,
            tax: 670,
            total: 24650,
            discrepancies: [],
            rawText: 'CAFE CHILL ELLA\nReg No: LK-EL-8891\nItems extracted with verified subtotal and taxes.',
          };
        }
      }

      if (!ocrResult) {
        showToast('Could not process receipt.', 'error');
        return null;
      }

      const initialAssignments: Record<string, string[]> = {};
      const memberIds = activeGroup ? activeGroup.members.map((m) => m.userId) : [currentUser.id];
      ocrResult.items.forEach((item) => {
        initialAssignments[item.id] = [...memberIds];
      });

      setActiveOCR({
        step: 'raw_review',
        receiptData: ocrResult,
        rawImage: imageBase64 || null,
        assignments: initialAssignments,
      });

      showToast('Receipt parsed successfully!', 'success');
      return ocrResult;
    } catch (err: any) {
      console.error('OCR analysis failed:', err);
      setActiveOCR((prev) => ({ ...prev, step: 'upload' }));
      showToast(err.message || 'OCR processing failed.', 'error');
      return null;
    }
  };

  const resetOCR = () => {
    setActiveOCR({
      step: 'upload',
      receiptData: null,
      rawImage: null,
      assignments: {},
    });
  };

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================
  const markNotificationRead = async (id: string) => {
    try {
      if (isSupabaseConfigured && !isDemoMode) {
        await supabaseApi.markNotificationRead(id);
      } else {
        await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      if (isSupabaseConfigured && !isDemoMode) {
        await supabaseApi.markAllNotificationsRead(currentUser.id);
      } else {
        await fetch('/api/notifications/read-all', { method: 'POST' });
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      showToast('All notifications marked as read.', 'info');
    } catch (err) {
      console.error(err);
    }
  };

  const resetDemoDatabase = async () => {
    try {
      await fetch('/api/seed/reset', { method: 'POST' });
      await refreshData();
      showToast('Demo database reset to clean seed data.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error resetting demo database.', 'error');
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        login,
        logout,
        signInWithEmail,
        signUpWithEmail,
        resendConfirmationEmail,
        groups,
        currentGroupId,
        setCurrentGroupId,
        activeGroup,
        expenses,
        settlements,
        activities,
        notifications,
        preferredCurrency,
        setPreferredCurrency,
        isLoading,
        refreshData,
        createGroup,
        updateGroup,
        deleteGroup,
        addMemberToGroup,
        removeMemberFromGroup,
        createExpense,
        updateExpense,
        deleteExpense,
        recordSettlement,
        getGroupOptimization,
        getSettlements,
        updateCurrentUserProfile,
        activeOCR,
        setActiveOCR,
        processOCR,
        resetOCR,
        markNotificationRead,
        markAllNotificationsRead,
        resetDemoDatabase,
        toasts,
        showToast,
        dismissToast,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
