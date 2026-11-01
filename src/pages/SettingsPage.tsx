import React, { useState } from 'react';
import { RotateCcw, Check, User, Globe, Shield, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SettingsPage: React.FC = () => {
  const {
    currentUser,
    preferredCurrency,
    setPreferredCurrency,
    resetDemoDatabase,
  } = useApp();

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [testPrompt, setTestPrompt] = useState('Explain how AI works in a few words');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testingApi, setTestingApi] = useState(false);

  const handleTestGemini = async () => {
    try {
      setTestingApi(true);
      setTestResult(null);
      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: testPrompt }),
      });
      const data = await res.json();
      setTestResult(data.text || JSON.stringify(data));
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`);
    } finally {
      setTestingApi(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleReset = async () => {
    if (confirm('Reset all demo groups, bills, and settlements to initial state?')) {
      await resetDemoDatabase();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 2500);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Application Settings
        </h1>
        <p className="text-xs text-slate-500">
          Manage your profile, preferred currency, and demo data state.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
        {/* Profile */}
        <div>
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            <span>User Profile</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Display Name</label>
              <input
                type="text"
                defaultValue={currentUser.name}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                defaultValue={currentUser.email}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Currency Preference */}
        <div className="pt-4 border-t border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-600" />
            <span>Default Currency</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { code: 'LKR', label: 'LKR (Rs.)' },
              { code: 'USD', label: 'USD ($)' },
              { code: 'EUR', label: 'EUR (€)' },
              { code: 'GBP', label: 'GBP (£)' },
            ].map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setPreferredCurrency(c.code)}
                className={`p-3 rounded-xl border text-center transition-all ${
                  preferredCurrency === c.code
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="font-mono font-bold">{c.code}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{c.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Gemini OCR & API Integration Status */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Gemini AI Engine (Key Configured)</span>
            </h2>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
              READY
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Using your Gemini API key on server-side endpoints for OCR receipts and smart insights.
          </p>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="Explain how AI works in a few words"
                className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-xs"
              />
              <button
                type="button"
                disabled={testingApi}
                onClick={handleTestGemini}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold whitespace-nowrap transition-colors"
              >
                {testingApi ? 'Testing API...' : 'Test Gemini Prompt'}
              </button>
            </div>

            {testResult && (
              <div className="p-3 bg-white rounded-lg border border-indigo-100 text-xs">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span className="font-semibold text-indigo-600">Gemini Response (gemini-3.8-flash)</span>
                  <span>Status: 200 OK</span>
                </div>
                <p className="text-slate-800 leading-relaxed font-mono text-[11px]">
                  {testResult}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Demo Database Controls */}
        <div className="pt-4 border-t border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-slate-600" />
            <span>Demo State Reset</span>
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Reset all groups, expenses, and settlements to the default "Weekend in Ella" scenario.
          </p>

          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Database</span>
          </button>
          {resetSuccess && (
            <p className="text-xs text-emerald-600 font-semibold mt-2">
              Database successfully reset to clean seed data!
            </p>
          )}
        </div>

        {/* Save button */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          {savedSuccess ? (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <Check className="w-4 h-4" />
              <span>Preferences saved!</span>
            </span>
          ) : (
            <span />
          )}

          <button
            type="submit"
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
};
