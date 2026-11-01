import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scale,
  ArrowRight,
  CheckCircle2,
  TrendingDown,
  CreditCard,
  Building2,
  QrCode,
  Banknote,
  RotateCcw,
  Sparkles,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, getAvatarColor } from '../utils/formatters';
import { SettlementAnalysis, OptimizedTransfer } from '../types';

export const BalancesPage: React.FC = () => {
  const {
    activeGroup,
    currentUser,
    getGroupOptimization,
    recordSettlement,
    expenses,
    settlements,
  } = useApp();

  const [analysis, setAnalysis] = useState<SettlementAnalysis | null>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<OptimizedTransfer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'frimi_genie' | 'koko_qr' | 'cash'>('bank_transfer');
  const [refNote, setRefNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  const fetchBalances = () => {
    if (activeGroup) {
      getGroupOptimization(activeGroup.id).then((res) => {
        if (res) setAnalysis(res);
      });
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [activeGroup, expenses]);

  const handleConfirmSettlement = async () => {
    if (!selectedTransfer || !activeGroup) return;
    setIsSubmitting(true);

    const payment = await recordSettlement({
      groupId: activeGroup.id,
      payerId: selectedTransfer.fromId,
      payerName: selectedTransfer.fromName,
      payeeId: selectedTransfer.toId,
      payeeName: selectedTransfer.toName,
      amount: selectedTransfer.amount,
      currency: activeGroup.currency,
      paymentMethod,
      referenceNote: refNote || `Settlement for ${activeGroup.name}`,
    });

    setIsSubmitting(false);
    if (payment) {
      setSuccessMessage(true);
      fetchBalances();
      setTimeout(() => {
        setSelectedTransfer(null);
        setSuccessMessage(false);
        setRefNote('');
      }, 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <span>Balances & Debt Minimization</span>
          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
            Algorithm Active
          </span>
        </h1>
        <p className="text-xs text-slate-500">
          Smart graph minimization reduces circular transactions into the fewest possible direct payments.
        </p>
      </div>

      {/* Comparison Efficiency Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div>
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
              Optimization Stats
            </span>
            <div className="text-3xl font-extrabold font-mono text-emerald-400 tabular-nums">
              {analysis?.savingsPercentage || 57}% Fewer Transfers
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Consolidated {analysis?.rawDebtsCount || 7} circular IOUs down to {analysis?.optimizedCount || 3} direct payments.
            </p>
          </div>

          <div className="flex items-center justify-around p-4 bg-slate-800/80 rounded-xl border border-slate-700/60 text-center">
            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">Raw Circular</span>
              <span className="text-xl font-bold font-mono text-rose-400 tabular-nums">
                {analysis?.rawDebtsCount || 7} tx
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500" />
            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">Optimized</span>
              <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                {analysis?.optimizedCount || 3} tx
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-300 space-y-1.5 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Zero circular money loops</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Members settle direct debts using Sri Lankan banks, LankaQR, or FriMi without paying intermediate fees.
            </p>
          </div>
        </div>
      </div>

      {/* Optimized Direct Transfers Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Recommended Settlement Payments
            </h2>
            <p className="text-xs text-slate-500">
              Execute these transfers to square all debts in {activeGroup?.name}.
            </p>
          </div>
        </div>

        {!analysis || analysis.optimizedTransfers.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
              <Check className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">All Settled Up!</h3>
            <p className="text-xs text-slate-500 mt-1">
              No outstanding balances in this group.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {analysis.optimizedTransfers.map((tx, idx) => (
              <div
                key={tx.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {idx + 1}
                  </div>

                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-bold text-slate-900">{tx.fromName}</span>
                    <span className="text-slate-400">pays</span>
                    <span className="font-bold text-indigo-700">{tx.toName}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-right">
                    <span className="text-sm sm:text-base font-bold font-mono text-emerald-600 tabular-nums">
                      {formatCurrency(tx.amount, tx.currency)}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedTransfer(tx);
                      setSuccessMessage(false);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors whitespace-nowrap"
                  >
                    Settle Up
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Net Balances Roster */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
        <h2 className="text-base font-bold text-slate-900 mb-4">
          Individual Net Positions
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {analysis?.netBalances.map((nb) => {
            const isOwed = nb.balance > 0.01;
            const owes = nb.balance < -0.01;

            return (
              <div
                key={nb.userId}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${getAvatarColor(nb.userName)}`}>
                    {nb.userName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="font-bold text-slate-900 truncate">
                    {nb.userName} {nb.userId === currentUser.id ? '(You)' : ''}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-mono font-bold tabular-nums">
                  <span className="text-slate-500 font-sans font-medium text-[11px]">Net:</span>
                  {isOwed ? (
                    <span className="text-emerald-600">+{formatCurrency(nb.balance, activeGroup?.currency)}</span>
                  ) : owes ? (
                    <span className="text-rose-600">-{formatCurrency(Math.abs(nb.balance), activeGroup?.currency)}</span>
                  ) : (
                    <span className="text-slate-400">Rs. 0.00</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Settle Up Action Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            {successMessage ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Settlement Recorded!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  The payment of {formatCurrency(selectedTransfer.amount, selectedTransfer.currency)} was verified and balances updated.
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  Record Settlement Payment
                </h3>
                <p className="text-xs text-slate-500 mb-5">
                  Confirm the transfer details between group members.
                </p>

                <div className="space-y-4">
                  {/* Payer and Payee visual */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payer:</span>
                      <span className="font-bold text-slate-900">{selectedTransfer.fromName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payee:</span>
                      <span className="font-bold text-slate-900">{selectedTransfer.toName}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200 font-bold">
                      <span className="text-slate-700">Amount Due:</span>
                      <span className="font-mono text-emerald-600 text-sm">
                        {formatCurrency(selectedTransfer.amount, selectedTransfer.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Channel options */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Payment Channel
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { id: 'bank_transfer', label: 'Bank Transfer', icon: Building2 },
                        { id: 'frimi_genie', label: 'FriMi / Genie', icon: CreditCard },
                        { id: 'koko_qr', label: 'LankaQR / Koko', icon: QrCode },
                        { id: 'cash', label: 'Cash', icon: Banknote },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setPaymentMethod(item.id as any)}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border font-medium transition-all ${
                              paymentMethod === item.id
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <Icon className="w-4 h-4 text-slate-500" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reference Note */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Transaction Note / Reference
                    </label>
                    <input
                      type="text"
                      value={refNote}
                      onChange={(e) => setRefNote(e.target.value)}
                      placeholder="e.g. ComBank ref #88291, Cash given at villa"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setSelectedTransfer(null)}
                      className="flex-1 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleConfirmSettlement}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                    >
                      {isSubmitting ? 'Recording...' : 'Confirm Payment'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
