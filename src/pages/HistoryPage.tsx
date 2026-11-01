import React, { useState } from 'react';
import { History, Search, Filter, Receipt, Scale, UserPlus, ArrowRightLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatTimeAgo, formatCurrency } from '../utils/formatters';

export const HistoryPage: React.FC = () => {
  const { activities, activeGroup, preferredCurrency } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  const filtered = activities.filter((act) => {
    const matchesSearch =
      act.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.actorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || act.type === selectedType;
    return matchesSearch && matchesType;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'expense_created':
        return Receipt;
      case 'settlement_paid':
        return Scale;
      case 'member_added':
        return UserPlus;
      default:
        return ArrowRightLeft;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Activity & Audit History
        </h1>
        <p className="text-xs text-slate-500">
          Chronological record of all expenses, settlements, and member changes.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search activities..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Events' },
            { id: 'expense_created', label: 'Expenses' },
            { id: 'settlement_paid', label: 'Settlements' },
            { id: 'member_added', label: 'Members' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedType(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedType === f.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activities Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No activities match your filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((act) => {
              const Icon = getIcon(act.type);
              const isSettlement = act.type === 'settlement_paid';

              return (
                <div
                  key={act.id}
                  className="flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all text-xs"
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isSettlement
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-indigo-50 text-indigo-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{act.actorName}</span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {formatTimeAgo(act.timestamp)}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-0.5 leading-snug">
                      {act.description}
                    </p>
                  </div>

                  {act.amount && (
                    <div className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                      {formatCurrency(act.amount, act.currency || preferredCurrency)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
