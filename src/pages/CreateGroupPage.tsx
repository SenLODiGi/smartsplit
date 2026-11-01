import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users2, Plus, Trash2, ArrowLeft, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const CreateGroupPage: React.FC = () => {
  const { createGroup, currentUser } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'trip' | 'home' | 'dinner' | 'event' | 'other'>('trip');
  const [currency, setCurrency] = useState('LKR');
  const [members, setMembers] = useState<string[]>(['Dilshan Silva', 'Anuki Fernando']);
  const [newMemberInput, setNewMemberInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddMember = () => {
    if (newMemberInput.trim() && !members.includes(newMemberInput.trim())) {
      setMembers([...members, newMemberInput.trim()]);
      setNewMemberInput('');
    }
  };

  const handleRemoveMember = (idx: number) => {
    setMembers(members.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);

    const group = await createGroup({
      name: name.trim(),
      description: description.trim(),
      category,
      currency,
      memberNames: members,
    });

    setIsSubmitting(false);
    if (group) {
      navigate(`/groups/${group.id}`);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/groups')}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Groups</span>
      </button>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Create New Group
        </h1>
        <p className="text-xs text-slate-500">
          Start a new shared expense space for a trip, housemates, or a night out.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Group Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ella Odyssey Trip, Colombo Flat 4B, Kandy Perahera"
            className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Description (Optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Weekend getaway villa and dining expenses"
            className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Type / Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="trip">Trip / Vacation</option>
              <option value="home">Shared Apartment / Home</option>
              <option value="dinner">Dinner / Drinks</option>
              <option value="event">Event / Party</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
            >
              <option value="LKR">LKR — Sri Lankan Rupee (Rs.)</option>
              <option value="USD">USD — US Dollar ($)</option>
              <option value="EUR">EUR — Euro (€)</option>
              <option value="GBP">GBP — British Pound (£)</option>
            </select>
          </div>
        </div>

        {/* Member Invitation List */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Group Members
          </label>
          <p className="text-[11px] text-slate-500 mb-2.5">
            You ({currentUser.name}) are automatically added as admin.
          </p>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newMemberInput}
              onChange={(e) => setNewMemberInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddMember();
                }
              }}
              placeholder="Friend's name (e.g. Praveen Jayawardena)"
              className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
            />
            <button
              type="button"
              onClick={handleAddMember}
              className="px-3.5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl"
            >
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold flex items-center gap-1.5">
              <span>{currentUser.name} (You)</span>
            </div>
            {members.map((m, idx) => (
              <div
                key={idx}
                className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-800 text-xs font-medium flex items-center gap-2"
              >
                <span>{m}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveMember(idx)}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/groups')}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            {isSubmitting ? 'Creating Group...' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  );
};
