import React from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const NotificationsPage: React.FC = () => {
  const { notifications, markNotificationRead } = useApp();

  const handleMarkAllRead = () => {
    notifications.forEach((n) => {
      if (!n.read) markNotificationRead(n.id);
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Notifications
          </h1>
          <p className="text-xs text-slate-500">
            Updates on settlements, added bills, and member transactions.
          </p>
        </div>

        {notifications.some((n) => !n.read) && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark All Read</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400">You are all caught up!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => markNotificationRead(n.id)}
                className={`p-4 rounded-xl border transition-all text-xs cursor-pointer flex items-start justify-between gap-3 ${
                  n.read
                    ? 'border-slate-100 bg-white text-slate-600'
                    : 'border-indigo-100 bg-indigo-50/50 text-slate-900 shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-900">{n.title}</span>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
                    )}
                  </div>
                  <p className="text-slate-600 leading-snug">{n.message}</p>
                  <span className="text-[10px] text-slate-400 mt-2 block">{n.timestamp}</span>
                </div>

                {!n.read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markNotificationRead(n.id);
                    }}
                    className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg shrink-0"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
