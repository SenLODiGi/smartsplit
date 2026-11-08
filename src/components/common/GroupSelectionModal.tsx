import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users2,
  X,
  Plus,
  Check,
  Search,
  ArrowRight,
  Plane,
  Home,
  Briefcase,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Group } from '../../types';

export const GroupSelectionModal: React.FC = () => {
  const {
    groups,
    currentGroupId,
    selectGroup,
    groupSelector,
    closeGroupSelector,
    showToast,
  } = useApp();

  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  if (!groupSelector.isOpen) return null;

  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectGroup = (group: Group) => {
    selectGroup(group.id);
    closeGroupSelector();
    showToast(`Active group set to "${group.name}".`, 'info');

    if (groupSelector.targetPath) {
      navigate(groupSelector.targetPath);
    }
  };

  const handleCreateNew = () => {
    closeGroupSelector();
    navigate('/groups/create');
  };

  const getCategoryIcon = (cat?: string) => {
    switch (cat) {
      case 'trip':
        return <Plane className="w-3.5 h-3.5 text-blue-600" />;
      case 'home':
        return <Home className="w-3.5 h-3.5 text-emerald-600" />;
      case 'project':
        return <Briefcase className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <Users2 className="w-3.5 h-3.5 text-indigo-600" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs shrink-0">
              <Users2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Select an Expense Group
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {groupSelector.actionTitle
                  ? `Choose a group before ${groupSelector.actionTitle}:`
                  : 'Select an active group to continue:'}
              </p>
            </div>
          </div>

          <button
            onClick={closeGroupSelector}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar (if more than 3 groups) */}
        {groups.length > 3 && (
          <div className="px-5 pt-3 pb-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your groups..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Body / Groups List */}
        <div className="p-5 overflow-y-auto space-y-2.5 flex-1">
          {groups.length === 0 ? (
            /* Empty State: No groups created yet */
            <div className="text-center py-8 px-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                No Expense Groups Yet
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mb-5 leading-relaxed">
                SmartSplit requires an active group to record shared expenses and split bills among participants.
              </p>
              <button
                onClick={handleCreateNew}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Group</span>
              </button>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No groups match "{searchQuery}".
            </div>
          ) : (
            filteredGroups.map((group) => {
              const isSelected = group.id === currentGroupId;
              return (
                <div
                  key={group.id}
                  onClick={() => handleSelectGroup(group)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-50 transition-colors">
                      {getCategoryIcon(group.category)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {group.name}
                        </span>
                        <span className="text-[10px] font-semibold font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 uppercase">
                          {group.currency}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        <span>{group.members?.length || 0} members</span>
                        {group.description && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[180px] sm:max-w-[240px]">
                              {group.description}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center shrink-0">
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-slate-400 group-hover:text-indigo-600 flex items-center gap-1 transition-colors">
                        <span>Select</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Group</span>
          </button>

          <button
            onClick={closeGroupSelector}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
