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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, getAvatarColor } from '../utils/formatters';
import { Group, Expense, SettlementAnalysis } from '../types';

export const GroupDetailsPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const {
    groups,
    currentUser,
    deleteExpense,
    addMemberToGroup,
    getGroupOptimization,
    setCurrentGroupId,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'members' | 'history'>('expenses');
  const [group, setGroup] = useState<Group | undefined>(undefined);
  const [groupExpenses, setGroupExpenses] = useState<Expense[]>([]);
  const [analysis, setAnalysis] = useState<SettlementAnalysis | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    if (groupId) {
      setCurrentGroupId(groupId);
      const found = groups.find((g) => g.id === groupId);
      setGroup(found);

      // Fetch expenses
      fetch(`/api/groups/${groupId}/expenses`)
        .then((r) => (r.ok ? r.json() : { expenses: [] }))
        .then((res) => {
          if (res.expenses) setGroupExpenses(res.expenses);
        });

      // Fetch analysis
      getGroupOptimization(groupId).then((res) => {
        if (res) setAnalysis(res);
      });
    }
  }, [groupId, groups]);

  if (!group) {
    return (
      <div className="text-center py-16">
        <h2 className="text-base font-bold text-slate-800">Group Not Found</h2>
        <button
          onClick={() => navigate('/groups')}
          className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
        >
          Back to Groups
        </button>
      </div>
    );
  }

  const totalSpend = groupExpenses.reduce((sum, e) => sum + e.amount, 0);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    const ok = await addMemberToGroup(group.id, newMemberName.trim(), newMemberEmail.trim());
    if (ok) {
      setShowInviteModal(false);
      setNewMemberName('');
      setNewMemberEmail('');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      await deleteExpense(id);
      setGroupExpenses(groupExpenses.filter((e) => e.id !== id));
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
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              {group.description || 'Shared expense tracking.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
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
            groupExpenses.map((exp) => (
              <div
                key={exp.id}
                className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-900">{exp.title}</h3>
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {exp.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Paid by <span className="font-semibold text-slate-800">{exp.payerName}</span> on {formatDate(exp.date)} · Split: {exp.splitMethod}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                      {formatCurrency(exp.amount, exp.currency)}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeleteExpense(exp.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete expense"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: BALANCES & SETTLEMENTS */}
      {/* ========================================================= */}
      {activeTab === 'balances' && (
        <div className="space-y-6">
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
                        onClick={() => navigate('/balances')}
                        className="px-3 py-1 bg-indigo-600 text-white rounded-lg font-semibold text-[11px]"
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
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {group.members.map((m) => (
              <div
                key={m.userId}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${getAvatarColor(m.name)}`}>
                    {m.initials}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">{m.name}</span>
                    <span className="text-[10px] text-slate-400">{m.email}</span>
                  </div>
                </div>

                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-600 capitalize">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
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
    </div>
  );
};
