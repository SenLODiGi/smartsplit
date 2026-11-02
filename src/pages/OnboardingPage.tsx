import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Plane,
  Home,
  Users2,
  Utensils,
  PartyPopper,
  Briefcase,
  Sparkles,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const OnboardingPage: React.FC = () => {
  const { currentUser, createGroup } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [displayName, setDisplayName] = useState(currentUser.name);
  const [selectedContexts, setSelectedContexts] = useState<string[]>(['travel', 'roommates']);

  // Group creation state for step 3
  const [groupName, setGroupName] = useState('Ella Odyssey Weekend');
  const [groupCurrency, setGroupCurrency] = useState('LKR');
  const [groupMembers, setGroupMembers] = useState<string[]>(['Dilshan Silva', 'Anuki Fernando', 'Praveen Jayawardena']);
  const [newMember, setNewMember] = useState('');

  const contexts = [
    { id: 'travel', label: 'Group Trips & Travel', icon: Plane },
    { id: 'roommates', label: 'Apartment & Roommates', icon: Home },
    { id: 'dinners', label: 'Dinners & Drinks', icon: Utensils },
    { id: 'events', label: 'Events & Parties', icon: PartyPopper },
    { id: 'family', label: 'Family Expenses', icon: Users2 },
    { id: 'work', label: 'Work & Projects', icon: Briefcase },
  ];

  const toggleContext = (id: string) => {
    if (selectedContexts.includes(id)) {
      setSelectedContexts(selectedContexts.filter((c) => c !== id));
    } else {
      setSelectedContexts([...selectedContexts, id]);
    }
  };

  const handleFinish = async () => {
    await createGroup({
      name: groupName || 'My First Group',
      currency: groupCurrency,
      category: 'trip',
      memberNames: groupMembers,
    });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Progress indicator */}
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
          <span>Step {step} of 3</span>
          <span>{step === 1 ? 'Your Profile' : step === 2 ? 'Splitting Context' : 'First Group'}</span>
        </div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          {/* ================= STEP 1 ================= */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  What should your friends call you?
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  This will be shown on expense bills and settlement requests.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Your Full Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 2 ================= */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  How do you plan to split?
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Choose the common situations where you share bills.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {contexts.map((ctx) => {
                  const Icon = ctx.icon;
                  const isSelected = selectedContexts.includes(ctx.id);
                  return (
                    <button
                      key={ctx.id}
                      type="button"
                      onClick={() => toggleContext(ctx.id)}
                      className={`p-3 rounded-xl border text-left transition-all text-xs font-medium ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mb-2 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <div>{ctx.label}</div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 3 ================= */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Create your first group
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Set up a shared space and invite your fellow travelers or housemates.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Group Name
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Currency
                  </label>
                  <select
                    value={groupCurrency}
                    onChange={(e) => setGroupCurrency(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  >
                    <option value="LKR">LKR — Sri Lankan Rupee (Rs.)</option>
                    <option value="USD">USD — US Dollar ($)</option>
                    <option value="EUR">EUR — Euro (€)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Members
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newMember}
                      onChange={(e) => setNewMember(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newMember.trim() && !groupMembers.includes(newMember.trim())) {
                            setGroupMembers([...groupMembers, newMember.trim()]);
                            setNewMember('');
                          }
                        }
                      }}
                      placeholder="Add friend's name"
                      className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newMember.trim() && !groupMembers.includes(newMember.trim())) {
                          setGroupMembers([...groupMembers, newMember.trim()]);
                          setNewMember('');
                        }
                      }}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      Add
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-[11px]">
                      {displayName} (You)
                    </span>
                    {groupMembers.map((m, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px]"
                      >
                        <span>{m}</span>
                        <button
                          type="button"
                          onClick={() => setGroupMembers(groupMembers.filter((_, idx) => idx !== i))}
                          className="text-slate-400 hover:text-rose-600 transition-colors ml-0.5"
                          title="Remove member"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Launch SmartSplit</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
