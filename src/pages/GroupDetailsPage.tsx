import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users2,
  Receipt,
  PlusCircle,
  ScanLine,
  Scale,
  Trash2,
  UserPlus,
  ArrowRight,
  TrendingUp,
  History,
  Check,
  Edit2,
  Settings as SettingsIcon,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, getAvatarColor } from '../utils/formatters';
import { Group, Expense, SettlementAnalysis } from '../types';
import { supabaseApi } from '../lib/supabaseService';
import { supabaseStorage } from '../lib/supabaseStorage';
import { isSupabaseConfigured } from '../lib/supabase';

export const GroupDetailsPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const {
    groups,
    currentUser,
    isLoading,
    deleteExpense,
    updateExpense,
    addMemberToGroup,
    removeMemberFromGroup,
    updateGroup,
    deleteGroup,
    getGroupOptimization,
    setCurrentGroupId,
    expenses,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'members'>('expenses');
  const [group, setGroup] = useState<Group | undefined>(undefined);
  const [groupExpenses, setGroupExpenses] = useState<Expense[]>([]);
  const [analysis, setAnalysis] = useState<SettlementAnalysis | null>(null);

  // Modals state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');

  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [editGroupCategory, setEditGroupCategory] = useState<'trip' | 'home' | 'dinner' | 'event' | 'other'>('trip');
  const [editGroupCurrency, setEditGroupCurrency] = useState('LKR');

  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);

  // Edit Expense modal state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editExpenseTitle, setEditExpenseTitle] = useState('');
  const [editExpenseAmount, setEditExpenseAmount] = useState<number>(0);
  const [editExpenseCategory, setEditExpenseCategory] = useState<any>('food');
  const [editExpensePayerId, setEditExpensePayerId] = useState('');
  const [editExpenseDate, setEditExpenseDate] = useState('');

  // Delete Expense confirm modal state
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState<boolean>(false);

  const handleOpenReceipt = async (receiptUrl: string) => {
    setIsLoadingReceipt(true);
    try {
      const signedUrl = await supabaseStorage.getReceiptSignedUrl(receiptUrl);
      if (signedUrl) {
        setViewingReceiptUrl(signedUrl);
      } else {
        showToast('Receipt image could not be loaded.', 'error');
      }
    } catch {
      showToast('Error loading receipt image.', 'error');
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  useEffect(() => {
    if (groupId) {
      setCurrentGroupId(groupId);
      const found = groups.find((g) => g.id === groupId);
      if (found) {
        setGroup(found);
        setEditGroupName(found.name);
        setEditGroupDesc(found.description || '');
        setEditGroupCategory(found.category || 'trip');
        setEditGroupCurrency(found.currency || 'LKR');
      } else if (isSupabaseConfigured) {
        supabaseApi.getGroupById(groupId).then((g) => {
          if (g) {
            setGroup(g);
            setEditGroupName(g.name);
            setEditGroupDesc(g.description || '');
            setEditGroupCategory(g.category || 'trip');
            setEditGroupCurrency(g.currency || 'LKR');
          }
        });
      }

      // Sync expenses
      const groupSpecific = expenses.filter((e) => e.groupId === groupId);
      if (isSupabaseConfigured) {
        setGroupExpenses(groupSpecific);
      } else {
        if (groupSpecific.length > 0) {
          setGroupExpenses(groupSpecific);
        } else {
          fetch(`/api/groups/${groupId}/expenses`)
            .then((r) => (r.ok ? r.json() : { expenses: [] }))
            .then((res) => {
              if (res.expenses) setGroupExpenses(res.expenses);
            })
            .catch(() => {});
        }
      }

      // Fetch analysis
      getGroupOptimization(groupId).then((res) => {
        if (res) setAnalysis(res);
      });
    }
  }, [groupId, groups, expenses]);

  if (isLoading && !group) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading group details...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
        <h2 className="text-base font-bold text-slate-800">Group Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">This group may have been deleted or does not exist.</p>
        <button
          onClick={() => navigate('/groups')}
          className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
        >
          Back to Groups
        </button>
      </div>
    );
  }

  const totalSpend = groupExpenses.reduce((sum, e) => sum + e.amount, 0);

  const isCreatorOrAdmin = Boolean(
    group.createdBy === currentUser.id ||
      group.members.some((m) => m.userId === currentUser.id && m.role === 'admin')
  );

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      showToast('Please enter member name.', 'error');
      return;
    }
    const ok = await addMemberToGroup(group.id, newMemberName.trim(), newMemberEmail.trim());
    if (ok) {
      setShowInviteModal(false);
      setNewMemberName('');
      setNewMemberEmail('');
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (window.confirm(`Are you sure you want to remove ${memberName} from this group?`)) {
      await removeMemberFromGroup(group.id, memberId);
    }
  };

  const handleEditGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroupName.trim()) {
      showToast('Group name is required.', 'error');
      return;
    }
    const updated = await updateGroup(group.id, {
      name: editGroupName.trim(),
      description: editGroupDesc.trim(),
      category: editGroupCategory,
      currency: editGroupCurrency,
    });
    if (updated) {
      setShowEditGroupModal(false);
    }
  };

  const handleDeleteGroupConfirm = async () => {
    const success = await deleteGroup(group.id);
    if (success) {
      setShowDeleteGroupModal(false);
      navigate('/groups');
    }
  };

  const openEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    setEditExpenseTitle(exp.title);
    setEditExpenseAmount(exp.amount);
    setEditExpenseCategory(exp.category);
    setEditExpensePayerId(exp.payerId);
    setEditExpenseDate(exp.date);
  };

  const handleSaveExpenseEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    if (!editExpenseTitle.trim() || editExpenseAmount <= 0) {
      showToast('Please provide a valid title and positive amount.', 'error');
      return;
    }

    // Recompute equal splits if splitMethod was equal using exact cents
    let updatedSplits = editingExpense.splits;
    if (editingExpense.splitMethod === 'equal' && group.members.length > 0) {
      const totalCents = Math.round(editExpenseAmount * 100);
      const count = group.members.length;
      const baseCents = Math.floor(totalCents / count);
      let remCents = totalCents - baseCents * count;
      updatedSplits = group.members.map((m) => {
        let cents = baseCents;
        if (remCents > 0) {
          cents += 1;
          remCents -= 1;
        }
        return {
          userId: m.userId,
          userName: m.name,
          amount: cents / 100,
        };
      });
    }

    const updated = await updateExpense(editingExpense.id, {
      title: editExpenseTitle.trim(),
      amount: editExpenseAmount,
      category: editExpenseCategory,
      payerId: editExpensePayerId,
      date: editExpenseDate,
      splits: updatedSplits,
    });

    if (updated) {
      setEditingExpense(null);
      if (isSupabaseConfigured) {
        const fresh = await supabaseApi.getExpenses(group.id);
        if (fresh) setGroupExpenses(fresh);
      } else {
        fetch(`/api/groups/${group.id}/expenses`)
          .then((r) => (r.ok ? r.json() : { expenses: [] }))
          .then((res) => {
            if (res.expenses) setGroupExpenses(res.expenses);
          });
      }
      getGroupOptimization(group.id).then((res) => {
        if (res) setAnalysis(res);
      });
    }
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    const ok = await deleteExpense(expenseToDelete);
    if (ok) {
      setGroupExpenses((prev) => prev.filter((e) => e.id !== expenseToDelete));
      setExpenseToDelete(null);
      getGroupOptimization(group.id).then((res) => {
        if (res) setAnalysis(res);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Group Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
        <div className={`h-2.5 w-full rounded-full bg-gradient-to-r ${group.coverGradient} mb-4`} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {group.name}
              </h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                {group.currency}
              </span>
              <button
                onClick={() => setShowEditGroupModal(true)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors ml-1"
                title="Edit Group Settings"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              {group.description || 'Shared expense tracking.'}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1.5 flex-wrap">
              <span>
                Created by <strong className="text-slate-600 font-semibold">{group.creatorName || 'Admin'}</strong>
              </span>
              <span>•</span>
              <span>{formatDate(group.createdAt)}</span>
              <span>•</span>
              <span className="capitalize">{group.category || 'trip'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowEditGroupModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>Edit Group</span>
            </button>
            <button
              onClick={() => navigate('/receipt/pipeline')}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition-colors"
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>Scan Bill</span>
            </button>
            <button
              onClick={() => navigate('/expenses/add')}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Expense</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 mt-6 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Total Group Spending</span>
            <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              {formatCurrency(totalSpend, group.currency)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Recorded Expenses</span>
            <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              {groupExpenses.length} transactions
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Active Members</span>
            <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              {group.members.length} people
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-semibold">
        {[
          { id: 'expenses', label: `Expenses (${groupExpenses.length})` },
          { id: 'balances', label: 'Balances & Settle' },
          { id: 'members', label: `Members (${group.members.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-2 border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: EXPENSES */}
      {/* ========================================================= */}
      {activeTab === 'expenses' && (
        <div className="space-y-3">
          {groupExpenses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
              <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900">No Expenses Recorded Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                Scan your first paper bill or add a manual expense to calculate fair splits.
              </p>
              <button
                onClick={() => navigate('/expenses/add')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
              >
                + Add Expense
              </button>
            </div>
          ) : (
            groupExpenses.map((exp) => {
              const isExpanded = expandedExpenseId === exp.id;
              return (
                <div
                  key={exp.id}
                  className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all shadow-2xs overflow-hidden"
                >
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div
                      className="cursor-pointer flex-1"
                      onClick={() => setExpandedExpenseId(isExpanded ? null : exp.id)}
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-900">{exp.title}</h3>
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {exp.category}
                        </span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 capitalize">
                          {exp.splitMethod} split
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                        <span>
                          Paid by <strong className="text-slate-800">{exp.payerName}</strong> on{' '}
                          {formatDate(exp.date)}
                        </span>
                        <span>·</span>
                        <span className="text-indigo-600 font-medium">
                          {exp.splits?.length || 0} participants
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-right">
                        <span className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                          {formatCurrency(exp.amount, exp.currency)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setExpandedExpenseId(isExpanded ? null : exp.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title={isExpanded ? 'Collapse breakdown' : 'View participants'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => openEditExpense(exp)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit expense"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setExpenseToDelete(exp.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Split Participants Breakdown */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 bg-slate-50/70 border-t border-slate-100 text-xs space-y-3">
                      {exp.notes && (
                        <p className="text-[11px] text-slate-600 italic">
                          "{exp.notes}"
                        </p>
                      )}

                      {/* Receipt Photo Action */}
                      {exp.receiptUrl && (
                        <div>
                          <button
                            type="button"
                            onClick={() => handleOpenReceipt(exp.receiptUrl!)}
                            disabled={isLoadingReceipt}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors border border-indigo-200"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>View Scanned Receipt</span>
                          </button>
                        </div>
                      )}

                      {/* Itemized Line Items (if split by items) */}
                      {exp.items && exp.items.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Itemized Dishes & Purchases ({exp.items.length} items)
                          </h4>
                          <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200 divide-y divide-slate-100">
                            {exp.items.map((it) => (
                              <div key={it.id} className="flex items-center justify-between text-[11px] pt-1 first:pt-0">
                                <div>
                                  <span className="font-semibold text-slate-800">{it.name}</span>
                                  <span className="text-slate-400 font-mono ml-1.5">
                                    ({it.quantity}x @ {formatCurrency(it.unitPrice, exp.currency)})
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-slate-900 tabular-nums">
                                  {formatCurrency(it.totalPrice, exp.currency)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Split Breakdown
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(exp.splits || []).map((s, sIdx) => (
                            <div
                              key={s.userId || sIdx}
                              className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200"
                            >
                              <span className="font-medium text-slate-700 truncate">
                                {s.userName || 'Member'}
                                {s.percentage ? ` (${s.percentage}%)` : ''}
                                {s.shares ? ` (${s.shares} shares)` : ''}
                              </span>
                              <span className="font-mono font-bold text-slate-900 tabular-nums">
                                {formatCurrency(s.amount, exp.currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: BALANCES & SETTLEMENTS */}
      {/* ========================================================= */}
      {activeTab === 'balances' && (
        <div className="space-y-6">
          {/* Member Net Balances */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900 mb-4">
              Individual Member Balances
            </h2>

            {analysis && analysis.netBalances.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {analysis.netBalances.map((nb) => {
                  const isPositive = nb.balance > 0.01;
                  const isNegative = nb.balance < -0.01;
                  return (
                    <div
                      key={nb.userId}
                      className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${getAvatarColor(
                            nb.userName
                          )}`}
                        >
                          {nb.userName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 block truncate">
                            {nb.userName} {nb.userId === currentUser.id ? '(You)' : ''}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {isPositive ? 'Gets back' : isNegative ? 'Owes group' : 'Settled up'}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          isPositive
                            ? 'text-emerald-600'
                            : isNegative
                            ? 'text-rose-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {formatCurrency(nb.balance, group.currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">
                No balance calculations available yet.
              </p>
            )}
          </div>

          {/* Optimized Direct Transfers */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900 mb-4">
              Optimized Direct Transfers
            </h2>

            {analysis && analysis.optimizedTransfers.length > 0 ? (
              <div className="space-y-3">
                {analysis.optimizedTransfers.map((tx, idx) => (
                  <div
                    key={tx.id}
                    className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                        {idx + 1}
                      </div>
                      <span className="font-bold text-slate-900">{tx.fromName}</span>
                      <span className="text-slate-400">pays</span>
                      <span className="font-bold text-indigo-700">{tx.toName}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-emerald-600 tabular-nums">
                        {formatCurrency(tx.amount, tx.currency)}
                      </span>
                      <button
                        onClick={() => navigate('/balances', { state: { transfer: tx } })}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-[11px] transition-colors"
                      >
                        Settle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">
                All balances squared up!
              </p>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: MEMBERS */}
      {/* ========================================================= */}
      {activeTab === 'members' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Group Members</h2>
              <p className="text-[11px] text-slate-500">People involved in splitting expenses</p>
            </div>
            {isCreatorOrAdmin && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Member</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {group.members.map((m) => {
              const isCurrentUser = m.userId === currentUser.id;
              const canRemove = isCreatorOrAdmin ? (!isCurrentUser || group.members.length === 1) : isCurrentUser;

              return (
                <div
                  key={m.id || m.userId}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${getAvatarColor(m.name)}`}>
                      {m.initials}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        {m.name} {isCurrentUser ? '(You)' : ''}
                      </span>
                      <span className="text-[10px] text-slate-400">{m.email}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-600 capitalize">
                      {m.role}
                    </span>
                    {canRemove && (
                      <button
                        onClick={() => handleRemoveMember(m.id || m.userId, m.name)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        title={isCurrentUser ? 'Leave group' : 'Remove member'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EDIT GROUP */}
      {/* ========================================================= */}
      {showEditGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Edit Group Details</h3>
              <button
                onClick={() => setShowEditGroupModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditGroupSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Description</label>
                <input
                  type="text"
                  value={editGroupDesc}
                  onChange={(e) => setEditGroupDesc(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Category</label>
                  <select
                    value={editGroupCategory}
                    onChange={(e) => setEditGroupCategory(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="trip">Trip / Vacation</option>
                    <option value="home">Apartment / Home</option>
                    <option value="dinner">Dinner / Drinks</option>
                    <option value="event">Event / Party</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Currency</label>
                  <select
                    value={editGroupCurrency}
                    onChange={(e) => setEditGroupCurrency(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  >
                    <option value="LKR">LKR (Rs.)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                {isCreatorOrAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditGroupModal(false);
                      setShowDeleteGroupModal(true);
                    }}
                    className="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                  >
                    Delete Group
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">Admin only: Delete Group</span>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditGroupModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DELETE GROUP CONFIRMATION */}
      {/* ========================================================= */}
      {showDeleteGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Delete Group?</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-800">"{group.name}"</span>? All recorded expenses and settlements in this group will be permanently removed.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteGroupModal(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteGroupConfirm}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Delete Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DELETE EXPENSE CONFIRMATION */}
      {/* ========================================================= */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Delete Expense?</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              This expense will be permanently deleted and group balances will recalculate immediately.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteExpense}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EDIT EXPENSE */}
      {/* ========================================================= */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Edit Expense</h3>
              <button
                onClick={() => setEditingExpense(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpenseEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Expense Title *</label>
                <input
                  type="text"
                  required
                  value={editExpenseTitle}
                  onChange={(e) => setEditExpenseTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Amount ({group.currency}) *</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={editExpenseAmount}
                    onChange={(e) => setEditExpenseAmount(Number(e.target.value) || 0)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Category</label>
                  <select
                    value={editExpenseCategory}
                    onChange={(e) => setEditExpenseCategory(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl capitalize"
                  >
                    <option value="food">Food & Drinks</option>
                    <option value="transport">Transport</option>
                    <option value="lodging">Accommodation</option>
                    <option value="entertainment">Entertainment</option>
                    <option value="utilities">Utilities</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Paid By</label>
                  <select
                    value={editExpensePayerId}
                    onChange={(e) => setEditExpensePayerId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    {group.members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name} {m.userId === currentUser.id ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Date</label>
                  <input
                    type="date"
                    value={editExpenseDate}
                    onChange={(e) => setEditExpenseDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Update Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: INVITE MEMBER */}
      {/* ========================================================= */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Add Member to {group.name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter their name to include them in upcoming bill splits.
            </p>

            <form onSubmit={handleAddMember} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Roshane Dias"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="roshane@example.com"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: VIEW RECEIPT PHOTO */}
      {/* ========================================================= */}
      {viewingReceiptUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600" />
                <span>Original Bill / Receipt</span>
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={viewingReceiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Full</span>
                </a>
                <button
                  onClick={() => setViewingReceiptUrl(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-xl bg-slate-50 flex items-center justify-center p-2">
              <img
                src={viewingReceiptUrl}
                alt="Receipt"
                className="max-h-[65vh] w-auto object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
