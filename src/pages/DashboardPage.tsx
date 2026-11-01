import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  ScanLine,
  PlusCircle,
  Scale,
  Users2,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  DollarSign,
  PieChart,
  Calendar,
  Utensils,
  Plane,
  Home,
  Ticket,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, getAvatarColor } from '../utils/formatters';
import { SettlementAnalysis } from '../types';

export const DashboardPage: React.FC = () => {
  const {
    currentUser,
    activeGroup,
    groups,
    setCurrentGroupId,
    expenses,
    activities,
    getGroupOptimization,
    preferredCurrency,
  } = useApp();

  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<SettlementAnalysis | null>(null);

  useEffect(() => {
    if (activeGroup) {
      getGroupOptimization(activeGroup.id).then((res) => {
        if (res) setAnalysis(res);
      });
    }
  }, [activeGroup, expenses]);

  // Calculations for current user
  const totalGroupSpend = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Compute what user is owed or owes in the active group
  const userNetObj = analysis?.netBalances.find((b) => b.userId === currentUser.id);
  const userNetBalance = userNetObj ? userNetObj.balance : 0;

  const isOwed = userNetBalance > 0;
  const owes = userNetBalance < 0;

  // Category breakdown
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'food':
        return Utensils;
      case 'transport':
        return Plane;
      case 'lodging':
        return Home;
      default:
        return Ticket;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Greeting & Workspace Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {currentUser.name.split(' ')[0]} 👋
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Overview of your active group expenses and debt settlements.
          </p>
        </div>

        {/* Group Pill Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setCurrentGroupId(g.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeGroup?.id === g.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Balance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Your Net Position */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Your Net Balance</span>
            <span
              className={`p-1.5 rounded-lg ${
                isOwed
                  ? 'bg-emerald-50 text-emerald-600'
                  : owes
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-slate-50 text-slate-500'
              }`}
            >
              {isOwed ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
            </span>
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${
              isOwed ? 'text-emerald-600' : owes ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {isOwed
              ? `+${formatCurrency(userNetBalance, activeGroup?.currency)}`
              : owes
              ? `-${formatCurrency(Math.abs(userNetBalance), activeGroup?.currency)}`
              : formatCurrency(0, activeGroup?.currency)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
            {isOwed
              ? 'You are owed money by group members'
              : owes
              ? 'You have outstanding debts to settle'
              : 'You are all squared up!'}
          </p>
        </div>

        {/* Card 2: Total Group Spend */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Total Group Spend</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums tracking-tight">
            {formatCurrency(totalGroupSpend, activeGroup?.currency)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
            Across {expenses.length} recorded expenses
          </p>
        </div>

        {/* Card 3: Active Members */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Group Members</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Users2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums tracking-tight">
            {activeGroup?.members.length || 0} People
          </div>
          <div className="flex items-center -space-x-1.5 mt-2 overflow-hidden">
            {activeGroup?.members.map((m) => (
              <div
                key={m.userId}
                className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold ${getAvatarColor(
                  m.name
                )}`}
                title={m.name}
              >
                {m.initials}
              </div>
            ))}
          </div>
        </div>

        {/* Card 4: Optimized Debt Plan */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-indigo-200 mb-2">
              <span>Debt Minimization</span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 text-[10px] font-semibold">
                ACTIVE
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
              {analysis?.optimizedCount || 0} Direct Transfers
            </div>
            <p className="text-[11px] text-indigo-200/80 mt-1">
              Compressed from {analysis?.rawDebtsCount || 0} circular debts ({analysis?.savingsPercentage || 0}% savings)
            </p>
          </div>
          <button
            onClick={() => navigate('/balances')}
            className="mt-3 w-full py-1.5 text-center text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
          >
            Review Settle Plan
          </button>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => navigate('/receipt/pipeline')}
          className="p-3.5 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 hover:border-indigo-300 rounded-xl text-left transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
            <ScanLine className="w-4 h-4" />
          </div>
          <div className="text-xs font-bold text-slate-900">Scan Receipt OCR</div>
          <div className="text-[11px] text-slate-500">Auto extract & assign items</div>
        </button>

        <button
          onClick={() => navigate('/expenses/add')}
          className="p-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-left transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center mb-2 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
            <PlusCircle className="w-4 h-4" />
          </div>
          <div className="text-xs font-bold text-slate-900">Add Manual Expense</div>
          <div className="text-[11px] text-slate-500">Equal, exact, or shares split</div>
        </button>

        <button
          onClick={() => navigate('/balances')}
          className="p-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-left transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center mb-2 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
            <Scale className="w-4 h-4" />
          </div>
          <div className="text-xs font-bold text-slate-900">Settle Balances</div>
          <div className="text-[11px] text-slate-500">Record payments & clear debts</div>
        </button>

        <button
          onClick={() => navigate('/groups/create')}
          className="p-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-left transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center mb-2 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
            <Users2 className="w-4 h-4" />
          </div>
          <div className="text-xs font-bold text-slate-900">Create New Group</div>
          <div className="text-[11px] text-slate-500">For trips, homes, or events</div>
        </button>
      </div>

      {/* Main Grid: Expenses + Outstanding Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent Expenses List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent Group Expenses</h2>
              <p className="text-[11px] text-slate-500">Showing expenses in {activeGroup?.name}</p>
            </div>
            <button
              onClick={() => navigate('/expenses/add')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>+ Add New</span>
            </button>
          </div>

          {expenses.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs text-slate-400">No expenses recorded in this group yet.</p>
              <button
                onClick={() => navigate('/expenses/add')}
                className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
              >
                Add First Expense
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.slice(0, 5).map((exp) => {
                const Icon = getCategoryIcon(exp.category);
                const isUserPayer = exp.payerId === currentUser.id;
                const userSplit = exp.splits.find((s) => s.userId === currentUser.id);

                return (
                  <div
                    key={exp.id}
                    onClick={() => navigate(`/groups/${exp.groupId}`)}
                    className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/70 transition-all flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-900 truncate">{exp.title}</h3>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{exp.payerName} paid</span>
                          <span>·</span>
                          <span>{formatDate(exp.date)}</span>
                          {exp.items && exp.items.length > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-indigo-600 font-semibold">{exp.items.length} items</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold font-mono text-slate-900 tabular-nums">
                        {formatCurrency(exp.amount, exp.currency)}
                      </div>
                      <div className="text-[10px] font-medium mt-0.5">
                        {isUserPayer ? (
                          <span className="text-emerald-600 font-semibold">You paid</span>
                        ) : userSplit ? (
                          <span className="text-slate-500">
                            Your share: <span className="font-mono text-slate-700">{formatCurrency(userSplit.amount, exp.currency)}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Not involved</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Outstanding Balances & Category Breakdown */}
        <div className="space-y-6">
          {/* Outstanding Balances */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h2 className="text-sm font-bold text-slate-900">Member Balances</h2>
              <button
                onClick={() => navigate('/balances')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                View Plan
              </button>
            </div>

            <div className="space-y-2.5">
              {analysis?.netBalances.map((nb) => {
                const isPositive = nb.balance > 0.01;
                const isNegative = nb.balance < -0.01;

                return (
                  <div
                    key={nb.userId}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${getAvatarColor(
                          nb.userName
                        )}`}
                      >
                        {nb.userName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)}
                      </div>
                      <span className="font-medium text-slate-800">
                        {nb.userName} {nb.userId === currentUser.id ? '(You)' : ''}
                      </span>
                    </div>

                    <div className="font-mono font-bold tabular-nums">
                      {isPositive ? (
                        <span className="text-emerald-600">+{formatCurrency(nb.balance, activeGroup?.currency)}</span>
                      ) : isNegative ? (
                        <span className="text-rose-600">-{formatCurrency(Math.abs(nb.balance), activeGroup?.currency)}</span>
                      ) : (
                        <span className="text-slate-400">Rs. 0</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Spending by Category</h2>
            <div className="space-y-2 text-xs">
              {Object.entries(categoryTotals).map(([cat, amt]) => {
                const percent = totalGroupSpend > 0 ? Math.round((amt / totalGroupSpend) * 100) : 0;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-slate-600">
                      <span className="capitalize font-medium">{cat}</span>
                      <span className="font-mono tabular-nums text-slate-900 font-semibold">
                        {formatCurrency(amt, activeGroup?.currency)} ({percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
