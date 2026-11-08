import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users2, ArrowRight, DollarSign, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/formatters';

export const GroupsListPage: React.FC = () => {
  const { groups, setCurrentGroupId, currentUser, isLoading } = useApp();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Your Expense Groups
          </h1>
          <p className="text-xs text-slate-500">
            Manage your shared trips, apartments, and events.
          </p>
        </div>

        <button
          onClick={() => navigate('/groups/create')}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Group</span>
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoading && groups.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs animate-pulse space-y-4">
              <div className="h-2.5 w-full rounded-full bg-slate-200" />
              <div className="h-4 w-2/3 bg-slate-200 rounded" />
              <div className="h-3 w-full bg-slate-100 rounded" />
              <div className="h-3 w-1/2 bg-slate-100 rounded" />
              <div className="pt-4 border-t border-slate-100 flex justify-between">
                <div className="h-4 w-16 bg-slate-200 rounded" />
                <div className="h-4 w-12 bg-slate-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && groups.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <Users2 className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1">No Expense Groups Yet</h2>
          <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto leading-relaxed">
            Create your first group for a shared trip, apartment flatmates, dinner night, or party to split expenses fairly.
          </p>
          <button
            onClick={() => navigate('/groups/create')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Group</span>
          </button>
        </div>
      )}

      {/* Groups Grid */}
      {groups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {groups.map((group) => {
            const userBal = group.userNetBalance || 0;
            const isOwed = userBal > 0.01;
            const owes = userBal < -0.01;

            const myMember = group.members.find((m) => m.userId === currentUser.id);
            const myRole = myMember?.role || (group.createdBy === currentUser.id ? 'admin' : 'member');

            return (
              <div
                key={group.id}
                onClick={() => {
                  setCurrentGroupId(group.id);
                  navigate(`/groups/${group.id}`);
                }}
                className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-400 p-5 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Cover Gradient Strip */}
                  <div
                    className={`h-2.5 w-full rounded-full bg-gradient-to-r ${group.coverGradient} mb-4`}
                  />

                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {group.name}
                    </h2>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded capitalize ${
                          myRole === 'admin'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {myRole}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                        {group.currency}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                    {group.description || 'No description provided.'}
                  </p>

                  {/* Member Avatars */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center -space-x-1.5 overflow-hidden">
                      {group.members.slice(0, 4).map((m) => (
                        <div
                          key={m.id || m.userId}
                          className="w-6 h-6 rounded-full bg-indigo-600 text-white border-2 border-white flex items-center justify-center font-bold text-[10px]"
                          title={m.name}
                        >
                          {m.initials}
                        </div>
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {group.members.length} members
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Your Balance
                    </span>
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        isOwed ? 'text-emerald-600' : owes ? 'text-rose-600' : 'text-slate-500'
                      }`}
                    >
                      {isOwed
                        ? `+${formatCurrency(userBal, group.currency)}`
                        : owes
                        ? `-${formatCurrency(Math.abs(userBal), group.currency)}`
                        : 'Settled'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-indigo-600 font-semibold group-hover:translate-x-1 transition-transform">
                    <span>Open</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
