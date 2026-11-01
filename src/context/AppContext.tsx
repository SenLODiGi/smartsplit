import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

interface AppContextType {
  currentUser: User;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
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
  createGroup: (data: { name: string; description?: string; currency?: string; category?: any; memberNames?: string[] }) => Promise<Group | null>;
  addMemberToGroup: (groupId: string, name: string, email?: string) => Promise<boolean>;
  createExpense: (expenseData: any) => Promise<Expense | null>;
  deleteExpense: (expenseId: string) => Promise<boolean>;
  recordSettlement: (paymentData: any) => Promise<SettlementPayment | null>;
  getGroupOptimization: (groupId: string) => Promise<SettlementAnalysis | null>;
  // OCR Receipt pipeline state & actions
  activeOCR: {
    step: 'upload' | 'processing' | 'raw_review' | 'corrected_review' | 'assignment' | 'summary';
    receiptData: OCRResult | null;
    rawImage: string | null;
    assignments: Record<string, string[]>; // itemId -> userIds
  };
  setActiveOCR: React.Dispatch<React.SetStateAction<any>>;
  processOCR: (imageBase64?: string, preset?: string) => Promise<OCRResult | null>;
  resetOCR: () => void;
  markNotificationRead: (id: string) => Promise<void>;
  resetDemoDatabase: () => Promise<void>;
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<string>('grp_ella_weekend');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<SettlementPayment[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [preferredCurrency, setPreferredCurrency] = useState<string>('LKR');
  const [isLoading, setIsLoading] = useState<boolean>(true);

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

  const refreshData = async () => {
    try {
      setIsLoading(true);
      const [groupsRes, historyRes, notifsRes] = await Promise.all([
        fetch('/api/groups').then((r) => r.ok ? r.json() : { groups: [] }),
        fetch('/api/history').then((r) => r.ok ? r.json() : { activities: [] }),
        fetch('/api/notifications').then((r) => r.ok ? r.json() : { notifications: [] }),
      ]);

      if (groupsRes.groups && groupsRes.groups.length > 0) {
        setGroups(groupsRes.groups);
        if (!groupsRes.groups.some((g: Group) => g.id === currentGroupId)) {
          setCurrentGroupId(groupsRes.groups[0].id);
        }
      }

      if (historyRes.activities) {
        setActivities(historyRes.activities);
      }

      if (notifsRes.notifications) {
        setNotifications(notifsRes.notifications);
      }

      // Fetch expenses for the current active group
      const targetGroupId = currentGroupId || (groupsRes.groups?.[0]?.id ?? 'grp_ella_weekend');
      if (targetGroupId) {
        const expRes = await fetch(`/api/groups/${targetGroupId}/expenses`).then((r) => r.ok ? r.json() : { expenses: [] });
        if (expRes.expenses) {
          setExpenses(expRes.expenses);
        }
      }
    } catch (err) {
      console.warn('API sync warning (using cached/fallback state):', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (currentGroupId) {
      fetch(`/api/groups/${currentGroupId}/expenses`)
        .then((r) => (r.ok ? r.json() : { expenses: [] }))
        .then((res) => {
          if (res.expenses) setExpenses(res.expenses);
        })
        .catch(console.error);
    }
  }, [currentGroupId]);

  const login = () => setIsAuthenticated(true);
  const logout = () => setIsAuthenticated(false);

  const createGroup = async (data: {
    name: string;
    description?: string;
    currency?: string;
    category?: any;
    memberNames?: string[];
  }): Promise<Group | null> => {
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await res.json();
        await refreshData();
        setCurrentGroupId(json.group.id);
        return json.group;
      }
    } catch (err) {
      console.error('Failed to create group:', err);
    }
    return null;
  };

  const addMemberToGroup = async (groupId: string, name: string, email?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      if (res.ok) {
        await refreshData();
        return true;
      }
    } catch (err) {
      console.error('Failed to add member:', err);
    }
    return false;
  };

  const createExpense = async (expenseData: any): Promise<Expense | null> => {
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expenseData,
          groupId: expenseData.groupId || currentGroupId,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        await refreshData();
        return json.expense;
      }
    } catch (err) {
      console.error('Failed to create expense:', err);
    }
    return null;
  };

  const deleteExpense = async (expenseId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
      if (res.ok) {
        await refreshData();
        return true;
      }
    } catch (err) {
      console.error('Failed to delete expense:', err);
    }
    return false;
  };

  const recordSettlement = async (paymentData: any): Promise<SettlementPayment | null> => {
    try {
      const res = await fetch('/api/settlements/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...paymentData,
          groupId: paymentData.groupId || currentGroupId,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        await refreshData();
        return json.payment;
      }
    } catch (err) {
      console.error('Failed to record settlement:', err);
    }
    return null;
  };

  const getGroupOptimization = async (groupId: string): Promise<SettlementAnalysis | null> => {
    try {
      const res = await fetch(`/api/groups/${groupId}/balances`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error('Failed to fetch group optimization:', err);
    }
    return null;
  };

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

      // If backend was unreachable or returned non-JSON, provide client-side fallback receipt
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

      if (!ocrResult) return null;

      // Auto-assign items equally across all current group members initially
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

      return ocrResult;
    } catch (err) {
      console.error('OCR analysis failed:', err);
      setActiveOCR((prev) => ({ ...prev, step: 'upload' }));
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

  const markNotificationRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const resetDemoDatabase = async () => {
    try {
      await fetch('/api/seed/reset', { method: 'POST' });
      await refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        login,
        logout,
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
        addMemberToGroup,
        createExpense,
        deleteExpense,
        recordSettlement,
        getGroupOptimization,
        activeOCR,
        setActiveOCR,
        processOCR,
        resetOCR,
        markNotificationRead,
        resetDemoDatabase,
      }}
    >
      {children}
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
