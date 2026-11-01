import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users2,
  PlusCircle,
  ScanLine,
  Scale,
  History,
  Bell,
  Settings,
  Sparkles,
  ArrowRightLeft,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Sidebar: React.FC = () => {
  const { groups, currentGroupId, setCurrentGroupId, activeGroup, currentUser } = useApp();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Groups', path: '/groups', icon: Users2 },
    { name: 'Add Expense', path: '/expenses/add', icon: PlusCircle },
    { name: 'OCR Receipt Scanner', path: '/receipt/pipeline', icon: ScanLine, highlight: true },
    { name: 'Balances & Settle', path: '/balances', icon: Scale },
    { name: 'Activity History', path: '/history', icon: History },
    { name: 'Notifications', path: '/notifications', icon: Bell },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 bg-slate-900 text-slate-300 border-r border-slate-800 shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <NavLink to="/dashboard" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              SmartSplit
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Smart Expense Splitter</p>
          </div>
        </NavLink>
      </div>

      {/* Active Group Quick Selector */}
      <div className="px-3 pt-4 pb-2">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
          Active Workspace
        </div>
        <div className="relative">
          <select
            value={currentGroupId}
            onChange={(e) => setCurrentGroupId(e.target.value)}
            className="w-full appearance-none bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-medium text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.currency})
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : item.highlight
                    ? 'text-indigo-300 hover:bg-indigo-950/50 hover:text-indigo-200'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.name}</span>
              {item.highlight && (
                <span className="ml-auto text-[10px] bg-indigo-400/20 text-indigo-300 px-1.5 py-0.2 rounded font-semibold">
                  OCR
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* OCR Quick Action Banner */}
      <div className="p-3 mx-3 mb-3 rounded-xl bg-gradient-to-br from-indigo-900/60 to-purple-900/40 border border-indigo-700/40">
        <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-white">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Receipt OCR AI</span>
        </div>
        <p className="text-[11px] text-slate-300 leading-snug mb-2.5">
          Scan paper receipts or bills to automatically extract line items & tax.
        </p>
        <button
          onClick={() => navigate('/receipt/pipeline')}
          className="w-full text-center py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-sm"
        >
          Scan Bill Now
        </button>
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-slate-800 flex items-center gap-3 bg-slate-900/50">
        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-indigo-500/30">
          {currentUser.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white truncate">{currentUser.name}</p>
          <p className="text-[10px] text-slate-400 truncate">{currentUser.email}</p>
        </div>
      </div>
    </aside>
  );
};
