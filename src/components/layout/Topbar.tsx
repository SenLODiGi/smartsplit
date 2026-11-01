import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bell,
  Plus,
  ScanLine,
  RotateCcw,
  ExternalLink,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Topbar: React.FC = () => {
  const {
    activeGroup,
    notifications,
    preferredCurrency,
    setPreferredCurrency,
    markNotificationRead,
    resetDemoDatabase,
  } = useApp();

  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const navigate = useNavigate();

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Left: Active Group Title & Context */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm lg:text-base font-bold text-slate-900 truncate">
              {activeGroup ? activeGroup.name : 'SmartSplit'}
            </h1>
            {activeGroup && (
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 uppercase">
                {activeGroup.currency}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 hidden sm:block truncate">
            {activeGroup?.description || 'Collaborative Expense Management'}
          </p>
        </div>
      </div>

      {/* Right: Currency Selector, Action Buttons, Notifications */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Currency Switcher */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-medium text-slate-600">
          {['LKR', 'USD', 'EUR'].map((cur) => (
            <button
              key={cur}
              onClick={() => setPreferredCurrency(cur)}
              className={`px-2 py-1 rounded-md transition-all ${
                preferredCurrency === cur
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              {cur}
            </button>
          ))}
        </div>

        {/* Scan Receipt Quick CTA */}
        <button
          onClick={() => navigate('/receipt/pipeline')}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
        >
          <ScanLine className="w-3.5 h-3.5" />
          <span>Scan Receipt</span>
        </button>

        {/* Add Expense Primary CTA */}
        <button
          onClick={() => navigate('/expenses/add')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Expense</span>
          <span className="sm:hidden">Expense</span>
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 p-3 z-30">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900">Notifications</span>
                <span className="text-[11px] text-slate-500">{unreadCount} unread</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">No notifications yet.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      className={`p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        n.read ? 'bg-slate-50/70 text-slate-600' : 'bg-indigo-50/70 text-slate-900 font-medium'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-slate-800">{n.title}</span>
                        <span className="text-[10px] text-slate-400">{n.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-snug">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Reset Demo DB Helper */}
        <button
          onClick={resetDemoDatabase}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Reset Demo Data"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Public Showcase Landing Page Link */}
        <Link
          to="/"
          className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 pl-1"
          title="View Landing Page"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </header>
  );
};
