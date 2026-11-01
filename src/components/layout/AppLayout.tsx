import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-8 p-4 lg:p-6">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
        <MobileNav />
      </div>
    </div>
  );
};
