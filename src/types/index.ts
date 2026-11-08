export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  initials: string;
}

export interface GroupMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar: string;
  initials: string;
  role: 'admin' | 'member';
}

export interface Group {
  id: string;
  name: string;
  description: string;
  currency: string;
  category: 'trip' | 'home' | 'dinner' | 'event' | 'other';
  coverGradient: string;
  members: GroupMember[];
  createdAt: string;
  totalSpend?: number;
  expensesCount?: number;
  userNetBalance?: number;
  createdBy?: string;
  creatorName?: string;
}

export interface ExpenseSplit {
  userId: string;
  userName: string;
  amount: number;
  percentage?: number;
  shares?: number;
  assignedItems?: string[];
}

export interface ExpenseItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  assignedTo?: string[]; // userIds
  confidence?: number;
  isUncertain?: boolean;
  rawLine?: string;
}

export interface ExpensePayment {
  id?: string;
  userId: string;
  userName: string;
  amount: number;
}

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  currency: string;
  category: 'food' | 'transport' | 'lodging' | 'entertainment' | 'utilities' | 'other';
  payerId: string;
  payerName: string;
  payers?: ExpensePayment[];
  date: string;
  splitMethod: 'equal' | 'exact' | 'percentage' | 'shares' | 'items';
  splits: ExpenseSplit[];
  items?: ExpenseItem[];
  receiptUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface SettlementPayment {
  id: string;
  groupId: string;
  payerId: string;
  payerName: string;
  payeeId: string;
  payeeName: string;
  amount: number;
  currency: string;
  paymentMethod: 'bank_transfer' | 'cash' | 'frimi_genie' | 'koko_qr';
  referenceNote?: string;
  date: string;
  status: 'completed' | 'pending';
}

export interface ActivityItem {
  id: string;
  groupId: string;
  type: 'expense_created' | 'settlement_paid' | 'member_added' | 'group_created';
  actorName: string;
  description: string;
  amount?: number;
  currency?: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'payment' | 'expense' | 'group';
}

export interface OptimizedTransfer {
  id: string;
  fromId: string;
  fromName: string;
  fromAvatar?: string;
  toId: string;
  toName: string;
  toAvatar?: string;
  amount: number;
  currency: string;
}

export interface SettlementAnalysis {
  netBalances: {
    userId: string;
    userName: string;
    balance: number;
  }[];
  rawDebtsCount: number;
  optimizedTransfers: OptimizedTransfer[];
  optimizedCount: number;
  savingsPercentage: number;
}

export interface ReceiptMetadata {
  businessName?: string;
  address?: string;
  city?: string;
  phone?: string;
  dateTime?: string;
  tableNo?: string;
  receiptNo?: string;
  taxNo?: string;
  serverName?: string;
  cashierName?: string;
}

export interface OCRResult {
  merchant: string;
  date: string;
  currency: string;
  items: ExpenseItem[];
  subtotal: number;
  serviceCharge: number;
  tax: number;
  total: number;
  discrepancies: string[];
  rawText?: string;
  metadata?: ReceiptMetadata;
}
