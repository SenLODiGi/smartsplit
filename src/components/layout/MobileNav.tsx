import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users2,
  ScanLine,
  Scale,
  History,
} from 'lucide-react';

export const MobileNav: React.FC = () => {
  const items = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Groups', path: '/groups', icon: Users2 },
    { name: 'OCR Scan', path: '/receipt/pipeline', icon: ScanLine, highlight: true },
    { name: 'Balances', path: '/balances', icon: Scale },
    { name: 'Activity', path: '/history', icon: History },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-1.5 flex items-center justify-around z-30 shadow-lg">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors ${
                isActive
                  ? 'text-indigo-600'
                  : item.highlight
                  ? 'text-indigo-600 font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`
            }
          >
            {item.highlight ? (
              <div className="w-8 h-8 -mt-3 mb-0.5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                <Icon className="w-4 h-4" />
              </div>
            ) : (
              <Icon className="w-5 h-5 mb-0.5" />
            )}
            <span>{item.name}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
