import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight,
  QrCode,
  Building2,
  Camera,
  Smartphone,
  ArrowRightLeft,
  ScanLine,
  Receipt,
  Users2,
  CheckCircle2,
  Copy,
  Check,
  Zap,
  TrendingDown,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Layers,
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  // Calculator State
  const [billAmount, setBillAmount] = useState<number>(24000);
  const [groupSize, setGroupSize] = useState<number>(4);
  const [serviceChargeRate, setServiceChargeRate] = useState<number>(10);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  // Settlement Widget State
  const [activeScenario, setActiveScenario] = useState<'ella' | 'mirissa' | 'flat'>('ella');
  const [debtViewMode, setDebtViewMode] = useState<'raw' | 'optimized'>('optimized');
  const [showDemoModal, setShowDemoModal] = useState<boolean>(false);
  const [demoPaymentDone, setDemoPaymentDone] = useState<boolean>(false);

  // How it works active step
  const [activeStep, setActiveStep] = useState<number>(1);

  // Scenarios data
  const scenarios = {
    ella: {
      name: 'Weekend in Ella',
      totalSpend: 98450,
      currency: 'LKR',
      rawDebts: [
        { from: 'Dilshan Silva', to: 'Kasun Perera', amount: 12000, desc: 'Ella Villa share' },
        { from: 'Anuki Fernando', to: 'Kasun Perera', amount: 12000, desc: 'Ella Villa share' },
        { from: 'Praveen Jayawardena', to: 'Kasun Perera', amount: 12000, desc: 'Ella Villa share' },
        { from: 'Kasun Perera', to: 'Dilshan Silva', amount: 4762.5, desc: 'Cafe Chill dinner' },
        { from: 'Anuki Fernando', to: 'Dilshan Silva', amount: 7562.5, desc: 'Cafe Chill lamprais' },
        { from: 'Praveen Jayawardena', to: 'Dilshan Silva', amount: 7562.5, desc: 'Cafe Chill cocktails' },
        { from: 'Kasun Perera', to: 'Anuki Fernando', amount: 4000, desc: 'Train tickets' },
      ],
      optimizedDebts: [
        { from: 'Praveen Jayawardena', to: 'Kasun Perera', amount: 19562.5 },
        { from: 'Anuki Fernando', to: 'Kasun Perera', amount: 15562.5 },
        { from: 'Dilshan Silva', to: 'Kasun Perera', amount: 7237.5 },
      ],
    },
    mirissa: {
      name: 'Mirissa Surf & Beach',
      totalSpend: 46500,
      currency: 'LKR',
      rawDebts: [
        { from: 'Kasun Perera', to: 'Dilshan Silva', amount: 9500, desc: 'Surfboard rentals' },
        { from: 'Sanduni Wickrama', to: 'Dilshan Silva', amount: 9500, desc: 'Surf lessons' },
        { from: 'Dilshan Silva', to: 'Kasun Perera', amount: 14000, desc: 'Seafood dinner' },
        { from: 'Sanduni Wickrama', to: 'Kasun Perera', amount: 14000, desc: 'Beach cabana' },
      ],
      optimizedDebts: [
        { from: 'Sanduni Wickrama', to: 'Kasun Perera', amount: 18500 },
        { from: 'Dilshan Silva', to: 'Kasun Perera', amount: 4500 },
      ],
    },
    flat: {
      name: 'Mount Lavinia Flatshare',
      totalSpend: 135000,
      currency: 'LKR',
      rawDebts: [
        { from: 'Kasun Perera', to: 'Anuki Fernando', amount: 35000, desc: 'Monthly rent share' },
        { from: 'Praveen Jayawardena', to: 'Anuki Fernando', amount: 35000, desc: 'Monthly rent share' },
        { from: 'Anuki Fernando', to: 'Kasun Perera', amount: 12000, desc: 'Electricity & Fiber bill' },
        { from: 'Praveen Jayawardena', to: 'Kasun Perera', amount: 12000, desc: 'Water & Gas' },
      ],
      optimizedDebts: [
        { from: 'Praveen Jayawardena', to: 'Anuki Fernando', amount: 47000 },
        { from: 'Kasun Perera', to: 'Anuki Fernando', amount: 23000 },
      ],
    },
  };

  const currentScenarioData = scenarios[activeScenario];

  // Calculated values for Split Calculator
  const tipAmount = Math.round((billAmount * serviceChargeRate) / 100);
  const totalWithTip = billAmount + tipAmount;
  const perPersonShare = Math.round((totalWithTip / groupSize) * 100) / 100;

  const handleCopySummary = () => {
    const text = `🧾 SmartSplit Bill Summary:\nGroup: ${groupSize} people\nBase Bill: ${formatCurrency(billAmount, 'LKR')}\nService/Tip (${serviceChargeRate}%): ${formatCurrency(tipAmount, 'LKR')}\nTotal Bill: ${formatCurrency(totalWithTip, 'LKR')}\n\n👉 Each Person Pays: ${formatCurrency(perPersonShare, 'LKR')}\n\nSplit fairly on SmartSplit!`;
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* 1. Universal Top Bar Contract: 3 Zones */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <Link to="/" className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              SmartSplit
            </span>
          </Link>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-600">
            <a href="#how-it-works" className="hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#calculator" className="hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0">
              Split Calculator
            </a>
            <a href="#ocr-feature" className="hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0">
              OCR Engine
            </a>
            <a href="#debt-minimizer" className="hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0">
              Debt Optimization
            </a>
            <a href="#scenarios" className="hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0">
              Real Scenarios
            </a>
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('/login')}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
            >
              Log In
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="pt-8 pb-10 sm:pt-10 sm:pb-12 px-4 sm:px-6 border-b border-slate-200 bg-gradient-to-b from-white via-indigo-50/20 to-slate-50">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-4 sm:mb-5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>AI OCR Receipt Scanning + Smart Debt Minimization</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15] mb-4 max-w-3xl mx-auto" style={{ textWrap: 'balance' }}>
            Stop doing the math. Start enjoying the moment.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto mb-6 leading-relaxed">
            Snap dinner bills, train tickets, and vacation rentals. SmartSplit extracts every line item, assigns dishes to diners, and reduces 7 messy debts into 3 simple transfers.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6 sm:mb-8">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2"
            >
              <span>Start Splitting Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#calculator"
              className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <span>Try Live Calculator</span>
            </a>
          </div>

          {/* Trust Metrics Adjacency */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto pt-4 pb-2 border-t border-slate-200/80 text-left">
            <div className="p-2 bg-white/70 rounded-lg border border-slate-100">
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">99.4%</div>
              <div className="text-[11px] text-slate-500 font-medium">OCR Line Precision</div>
            </div>
            <div className="p-2 bg-white/70 rounded-lg border border-slate-100">
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">60%</div>
              <div className="text-[11px] text-slate-500 font-medium">Debt Steps Reduced</div>
            </div>
            <div className="p-2 bg-white/70 rounded-lg border border-slate-100">
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">5 Types</div>
              <div className="text-[11px] text-slate-500 font-medium">Split Calculations</div>
            </div>
            <div className="p-2 bg-white/70 rounded-lg border border-slate-100">
              <div className="text-xl sm:text-2xl font-bold font-mono text-indigo-600 tabular-nums">100% Free</div>
              <div className="text-[11px] text-slate-500 font-medium">No Ads & No Logins Req.</div>
            </div>
          </div>

          {/* Interactive Hero Visual Showcase Card */}
          <div className="mt-6 max-w-4xl mx-auto rounded-2xl bg-white border border-slate-200 shadow-lg overflow-hidden text-left">
            <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                </div>
                <span className="text-xs font-mono text-slate-400 ml-2 hidden sm:inline">
                  smartsplit.app/demo/weekend-in-ella
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live AI Engine Active
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {/* Left: Scanned Receipt Image */}
              <div className="md:col-span-5 p-3.5 sm:p-4 bg-slate-950 text-white flex flex-col justify-between relative overflow-hidden">
                <div className="relative rounded-xl overflow-hidden border border-slate-800 group">
                  <img
                    src="/images/receipt-scan.jpg"
                    alt="AI Receipt Scanner"
                    className="w-full h-44 sm:h-52 object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/15 via-transparent to-slate-950/75 pointer-events-none"></div>
                  <div className="absolute top-2.5 left-2.5 px-2 py-1 bg-black/75 backdrop-blur-md rounded-md text-[10px] font-mono text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                    <ScanLine className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>OCR: 4 items detected (99.4%)</span>
                  </div>
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 p-2 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/60 text-[11px] text-slate-200 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-white text-xs">Cafe Chill — Ella</div>
                      <div className="text-[10px] text-slate-400">Total: Rs. 24,650.00</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-semibold">
                      Extracted
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-[11px]">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    Gemini 2.5 Flash Multimodal
                  </span>
                  <span className="font-mono text-emerald-400 text-[11px]">0.8s scan time</span>
                </div>
              </div>

              {/* Right: Split Breakdown */}
              <div className="md:col-span-7 p-3.5 sm:p-4 bg-white flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Weekend in Ella Trip</h3>
                      <p className="text-[11px] text-slate-500">4 Diners · 7 debts simplified to 3 direct transfers</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                      -57% Transfers
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[9px]">
                          KP
                        </div>
                        <span className="font-semibold text-slate-800 text-xs">Kasun Perera</span>
                        <span className="text-[10px] text-slate-400">(Paid Bill)</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 text-xs">+Rs. 19,562.50</span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-[9px]">
                          DS
                        </div>
                        <span className="font-semibold text-slate-800 text-xs">Dilshan Silva</span>
                      </div>
                      <span className="font-mono font-bold text-rose-600 text-xs">-Rs. 7,237.50</span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-[9px]">
                          AF
                        </div>
                        <span className="font-semibold text-slate-800 text-xs">Anuki Fernando</span>
                      </div>
                      <span className="font-mono font-bold text-rose-600 text-xs">-Rs. 15,562.50</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                    <span>LankaQR / Bank Transfer ready</span>
                  </div>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <span>Launch Live App</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Payment & Bank Partners Strip */}
          <div className="mt-6 pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs font-semibold text-slate-400">
            <span className="text-slate-500 uppercase tracking-wider text-[10px] font-bold">
              Built for Sri Lanka:
            </span>
            <span className="flex items-center gap-1 text-slate-600 text-[11px]">
              <QrCode className="w-3.5 h-3.5 text-indigo-600" /> LankaQR
            </span>
            <span className="flex items-center gap-1 text-slate-600 text-[11px]">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Commercial Bank
            </span>
            <span className="flex items-center gap-1 text-slate-600 text-[11px]">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Sampath Bank
            </span>
            <span className="flex items-center gap-1 text-slate-600 text-[11px]">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" /> HNB
            </span>
            <span className="flex items-center gap-1 text-slate-600 text-[11px]">
              <CreditCard className="w-3.5 h-3.5 text-indigo-600" /> FriMi & Genie
            </span>
          </div>
        </div>
      </section>

      {/* 3. Interactive Hero Settlement Widget */}
      <section id="debt-minimizer" className="py-10 sm:py-12 px-4 sm:px-6 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-5">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Interactive Prototype
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              Watch circular IOUs get simplified into direct transfers
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Switch real trip scenarios and toggle between raw IOUs and optimized settlements.
            </p>
          </div>

          {/* Interactive Widget Box */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-7 shadow-xl border border-slate-800">
            {/* Scenario Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-800">
              <div className="flex items-center gap-1.5 p-1 bg-slate-800/80 rounded-xl">
                <button
                  onClick={() => setActiveScenario('ella')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeScenario === 'ella'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Weekend in Ella
                </button>
                <button
                  onClick={() => setActiveScenario('mirissa')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeScenario === 'mirissa'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Mirissa Surf
                </button>
                <button
                  onClick={() => setActiveScenario('flat')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeScenario === 'flat'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Flatshare
                </button>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-1 p-1 bg-slate-800/80 rounded-xl">
                <button
                  onClick={() => setDebtViewMode('raw')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    debtViewMode === 'raw'
                      ? 'bg-slate-700 text-rose-300 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Raw IOUs ({currentScenarioData.rawDebts.length} tx)
                </button>
                <button
                  onClick={() => setDebtViewMode('optimized')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    debtViewMode === 'optimized'
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Optimized ({currentScenarioData.optimizedDebts.length} tx)
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {currentScenarioData.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Total Group Spend: {formatCurrency(currentScenarioData.totalSpend, 'LKR')}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {debtViewMode === 'optimized' ? '✓ 57% Fewer Transfers' : '⚠️ Circular & Redundant'}
                  </span>
                </div>
              </div>

              {/* Transfers List */}
              <div className="space-y-2.5 mb-6">
                {debtViewMode === 'raw'
                  ? currentScenarioData.rawDebts.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">{item.from}</span>
                          <span className="text-slate-400">owes</span>
                          <span className="font-semibold text-indigo-300">{item.to}</span>
                          <span className="text-slate-400 hidden sm:inline">({item.desc})</span>
                        </div>
                        <span className="font-mono font-bold text-slate-100 tabular-nums">
                          {formatCurrency(item.amount, 'LKR')}
                        </span>
                      </div>
                    ))
                  : currentScenarioData.optimizedDebts.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-[10px]">
                            {idx + 1}
                          </div>
                          <div>
                            <span className="font-semibold text-white">{item.from}</span>
                            <span className="text-slate-400 mx-1.5">pays directly to</span>
                            <span className="font-semibold text-emerald-300">{item.to}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-emerald-300 tabular-nums text-sm">
                            {formatCurrency(item.amount, 'LKR')}
                          </span>
                          <button
                            onClick={() => {
                              setShowDemoModal(true);
                              setDemoPaymentDone(false);
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition-colors"
                          >
                            Settle
                          </button>
                        </div>
                      </div>
                    ))}
              </div>

              {/* Action Banner */}
              <div className="p-3 bg-slate-800/40 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-slate-400 text-center sm:text-left">
                  Ready to test with your own receipts and friends?
                </span>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                  Open Live Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Demo Settlement Modal */}
        {showDemoModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900 mb-1">
                Record Demo Settlement
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Simulating direct payment recording in Sri Lankan Rupees.
              </p>

              {demoPaymentDone ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Transfer Completed!</h4>
                  <p className="text-xs text-slate-500 mt-1 mb-5">
                    Debt successfully cleared and recorded into group activity ledger.
                  </p>
                  <button
                    onClick={() => setShowDemoModal(false)}
                    className="w-full py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
                  >
                    Close Demo
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Payer:</span>
                      <span className="font-semibold text-slate-800">Praveen Jayawardena</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Payee:</span>
                      <span className="font-semibold text-slate-800">Kasun Perera</span>
                    </div>
                    <div className="flex justify-between py-1 border-t border-slate-200 mt-1 pt-1">
                      <span className="text-slate-500 font-medium">Amount:</span>
                      <span className="font-mono font-bold text-indigo-600 text-sm">Rs. 19,562.50</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Channel
                    </label>
                    <select className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white">
                      <option>Bank Transfer (Commercial Bank / HNB)</option>
                      <option>LankaQR / FriMi / Genie</option>
                      <option>Cash in hand</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setShowDemoModal(false)}
                      className="flex-1 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setDemoPaymentDone(true)}
                      className="flex-1 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                    >
                      Confirm Payment
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 4. Interactive Live Split Calculator */}
      <section id="calculator" className="py-10 sm:py-12 px-4 sm:px-6 bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-5">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Interactive Tool
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              Live Equal Split Calculator
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Calculate quick dinner splits with custom service charge and export to WhatsApp in one click.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Controls Column */}
              <div className="space-y-6">
                {/* Bill Amount */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Bill Amount
                    </label>
                    <span className="text-base font-bold font-mono text-indigo-600 tabular-nums">
                      {formatCurrency(billAmount, 'LKR')}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="100000"
                    step="500"
                    value={billAmount}
                    onChange={(e) => setBillAmount(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
                    <span>Rs. 1,000</span>
                    <span>Rs. 50,000</span>
                    <span>Rs. 100,000</span>
                  </div>
                </div>

                {/* Group Size */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Number of People
                    </label>
                    <span className="text-base font-bold font-mono text-slate-900 tabular-nums">
                      {groupSize} diners
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {[2, 3, 4, 5, 6, 8, 10].map((num) => (
                      <button
                        key={num}
                        onClick={() => setGroupSize(num)}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                          groupSize === num
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Service Charge & Tip */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Service Charge / Tip
                    </label>
                    <span className="text-xs font-semibold text-slate-600">
                      {serviceChargeRate}% ({formatCurrency(tipAmount, 'LKR')})
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 10, 15, 20].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => setServiceChargeRate(rate)}
                        className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                          serviceChargeRate === rate
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {rate === 0 ? 'None' : `${rate}%`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Output Column */}
              <div className="bg-slate-900 text-white rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    Live Calculation
                  </span>

                  <div className="mt-4 pb-4 border-b border-slate-800">
                    <span className="text-xs text-slate-400 block mb-1">Each person pays</span>
                    <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-400 tabular-nums tracking-tight">
                      {formatCurrency(perPersonShare, 'LKR')}
                    </div>
                  </div>

                  <div className="py-4 space-y-2 text-xs border-b border-slate-800 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Base Subtotal:</span>
                      <span className="font-mono tabular-nums text-white">{formatCurrency(billAmount, 'LKR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Service Charge ({serviceChargeRate}%):</span>
                      <span className="font-mono tabular-nums text-white">{formatCurrency(tipAmount, 'LKR')}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-1 text-slate-100">
                      <span>Total Grand Bill:</span>
                      <span className="font-mono tabular-nums text-indigo-300">{formatCurrency(totalWithTip, 'LKR')}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleCopySummary}
                    className="w-full py-2.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    {copiedSummary ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>Summary Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy WhatsApp Summary</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. How It Works (3 Interactive Stages) */}
      <section id="how-it-works" className="py-10 sm:py-12 px-4 sm:px-6 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Workflow
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              Three simple steps from crumpled receipt to settled balance
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Step 1 */}
            <div
              onClick={() => setActiveStep(1)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                activeStep === 1
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div>
                <div className="relative mb-3.5 rounded-xl overflow-hidden h-32 border border-slate-200 group">
                  <img src="/images/receipt-scan.jpg" alt="Scan Bill" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-indigo-950/25"></div>
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold">
                    01
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-[10px] font-mono text-emerald-300 flex items-center justify-between">
                    <span>Gemini AI Scan</span>
                    <span className="font-bold">99.4% Accuracy</span>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1.5">
                  Scan or Upload Bill
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Take a photo of any restaurant or supermarket receipt. Gemini AI extracts items, prices, and tax with 99%+ accuracy.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div
              onClick={() => setActiveStep(2)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                activeStep === 2
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div>
                <div className="mb-3.5 rounded-xl p-2.5 bg-slate-50 border border-slate-200 h-32 flex flex-col justify-center space-y-1.5 text-xs relative">
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold">
                    02
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-200 shadow-2xs mt-4">
                    <span className="font-medium text-slate-700 text-[11px]">🍕 Wood-fired Pizza</span>
                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">2 Diners</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-200 shadow-2xs">
                    <span className="font-medium text-slate-700 text-[11px]">🍹 Passion Mojitos</span>
                    <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">4 Diners</span>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1.5">
                  Tap to Assign Items
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Select who ordered pizza, drinks, and dessert. Taxes and tips are proportionally distributed to diners automatically.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div
              onClick={() => setActiveStep(3)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                activeStep === 3
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div>
                <div className="mb-3.5 rounded-xl p-2.5 bg-emerald-950/5 border border-emerald-200 h-32 flex flex-col justify-center space-y-2 text-xs relative">
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold">
                    03
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-white rounded border border-emerald-200 shadow-2xs mt-4">
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="font-bold text-slate-800">Praveen</span>
                      <span className="text-slate-400">➔</span>
                      <span className="font-bold text-emerald-700">Kasun</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-600 text-[11px]">Rs. 19,562</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-emerald-700 px-1">
                    <span>Direct LankaQR / Bank Transfer</span>
                    <span className="font-bold">Settled ✓</span>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1.5">
                  Settle Minimized Debts
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Our graph engine resolves circular loops into the minimum direct payments. Settle with Bank Transfer, FriMi, or cash.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. OCR Engine Showcase */}
      <section id="ocr-feature" className="py-10 sm:py-12 px-4 sm:px-6 bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Gemini 2.5 Flash OCR
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1 mb-4">
                Itemized splitting without manual spreadsheet entry
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">
                Never argue about who ordered what again. The OCR pipeline extracts line item names, quantities, unit prices, service charges, and flags math discrepancies instantly.
              </p>

              <div className="space-y-3 mb-8 text-xs text-slate-300">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Automatic tax & 10% service charge detection</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Confidence scoring on detected words with inline corrections</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Proportional tax distribution to diners based on their share</span>
                </div>
              </div>

              <button
                onClick={() => navigate('/receipt/pipeline')}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2"
              >
                <ScanLine className="w-4 h-4" />
                <span>Try OCR Scanner With Sample Bills</span>
              </button>
            </div>

            {/* Receipt Visualizer Card */}
            <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80 shadow-2xl font-mono text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-700 text-slate-400">
                <span>OCR EXTRACTED RECEIPT</span>
                <span className="text-emerald-400 font-bold">99.2% CONFIDENCE</span>
              </div>
              <div className="py-3">
                <div className="font-bold text-white text-sm">CAFE CHILL — ELLA</div>
                <div className="text-[11px] text-slate-400">Date: 2026-10-25 · Reg: LK-8891</div>
              </div>
              <div className="space-y-2 py-3 border-t border-slate-700 text-slate-200">
                <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-md border border-slate-700/50">
                  <span>1x Wood-fired BBQ Pizza</span>
                  <span className="text-emerald-300 font-bold">Rs. 4,200.00</span>
                </div>
                <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-md border border-slate-700/50">
                  <span>2x Sri Lankan Lamprais</span>
                  <span className="text-emerald-300 font-bold">Rs. 7,600.00</span>
                </div>
                <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-md border border-slate-700/50">
                  <span>4x Passion Fruit Mojitos</span>
                  <span className="text-emerald-300 font-bold">Rs. 7,800.00</span>
                </div>
                <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-md border border-slate-700/50">
                  <span>1x Chocolate Lava Cake</span>
                  <span className="text-emerald-300 font-bold">Rs. 2,200.00</span>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-700 space-y-1 text-slate-400 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>Rs. 21,800.00</span>
                </div>
                <div className="flex justify-between text-indigo-300">
                  <span>10% Service Charge:</span>
                  <span>Rs. 2,180.00</span>
                </div>
                <div className="flex justify-between font-bold text-white text-xs pt-1 border-t border-slate-700">
                  <span>Total Amount:</span>
                  <span className="text-emerald-400">Rs. 24,650.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Real Scenarios */}
      <section id="scenarios" className="py-10 sm:py-12 px-4 sm:px-6 bg-slate-50 border-b border-slate-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Versatile
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              Built for every Sri Lankan group expense scenario
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Scenario 1: Ella */}
            <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="relative h-44 overflow-hidden group">
                <img
                  src="/images/ella-trip.jpg"
                  alt="Nine Arch Bridge in Ella, Sri Lanka"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-white/90 backdrop-blur-md text-[11px] font-bold text-slate-800 shadow-xs">
                  🌴 Group Trip · 4 Members
                </div>
                <div className="absolute bottom-2.5 left-3 text-white">
                  <h3 className="text-base font-bold drop-shadow-sm">Weekend in Ella</h3>
                  <p className="text-[11px] text-slate-200">Nine Arch & Hill Country</p>
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Villa bookings, Badulla train tickets, Ravana falls snacks, and dinners in town split effortlessly.
                </p>
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Total Tracked</span>
                  <span className="text-xs font-mono font-bold text-slate-900">Rs. 98,450.00</span>
                </div>
              </div>
            </div>

            {/* Scenario 2: Mirissa */}
            <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="relative h-44 overflow-hidden group">
                <img
                  src="/images/mirissa-surf.jpg"
                  alt="Mirissa Surf Beach, Sri Lanka"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-white/90 backdrop-blur-md text-[11px] font-bold text-slate-800 shadow-xs">
                  🏄 Beach Weekend · 3 Members
                </div>
                <div className="absolute bottom-2.5 left-3 text-white">
                  <h3 className="text-base font-bold drop-shadow-sm">Mirissa Surf Trip</h3>
                  <p className="text-[11px] text-slate-200">South Coast Waves</p>
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Board rentals, seafood dinners at Zephyr, and scooter petrol without keeping loose paper receipts.
                </p>
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Total Tracked</span>
                  <span className="text-xs font-mono font-bold text-slate-900">Rs. 46,500.00</span>
                </div>
              </div>
            </div>

            {/* Scenario 3: Flatshare */}
            <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="relative h-44 overflow-hidden group">
                <img
                  src="/images/flatshare.jpg"
                  alt="Mount Lavinia Flatshare Living"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-white/90 backdrop-blur-md text-[11px] font-bold text-slate-800 shadow-xs">
                  🏠 Roommates · 3 Members
                </div>
                <div className="absolute bottom-2.5 left-3 text-white">
                  <h3 className="text-base font-bold drop-shadow-sm">Mount Lavinia Flatshare</h3>
                  <p className="text-[11px] text-slate-200">Monthly Shared Living</p>
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Recurring monthly rent, SLT fiber internet, CEB electricity bills, and shared groceries balanced automatically.
                </p>
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Total Tracked</span>
                  <span className="text-xs font-mono font-bold text-slate-900">Rs. 135,000.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Final CTA */}
      <section className="py-10 sm:py-12 px-4 sm:px-6 bg-indigo-600 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            More memories. Less mental math.
          </h2>
          <p className="text-sm sm:text-base text-indigo-100 mb-6 max-w-xl mx-auto">
            Experience fair expense management. No credit card required. Instant access to all OCR and settlement features.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3.5 bg-white text-indigo-700 hover:bg-slate-100 rounded-xl text-sm font-bold shadow-lg transition-colors inline-flex items-center gap-2"
          >
            <span>Launch SmartSplit Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 sm:py-8 px-4 sm:px-6 text-xs border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-bold text-white">SmartSplit</span>
            <span className="text-slate-500 ml-2">· Sri Lanka Edition</span>
          </div>

          <div className="flex items-center gap-6 text-slate-400">
            <Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <Link to="/receipt/pipeline" className="hover:text-white transition-colors">OCR Scanner</Link>
            <Link to="/balances" className="hover:text-white transition-colors">Debt Minimizer</Link>
            <Link to="/settings" className="hover:text-white transition-colors">Settings</Link>
          </div>

          <p className="text-slate-500">
            © {new Date().getFullYear()} SmartSplit. Built for seamless group finances.
          </p>
        </div>
      </footer>
    </div>
  );
};
