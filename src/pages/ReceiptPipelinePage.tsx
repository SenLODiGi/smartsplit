import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  Sparkles,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Users2,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, getAvatarColor } from '../utils/formatters';
import { ExpenseItem } from '../types';

export const ReceiptPipelinePage: React.FC = () => {
  const {
    activeOCR,
    setActiveOCR,
    processOCR,
    resetOCR,
    activeGroup,
    createExpense,
    currentUser,
  } = useApp();

  const navigate = useNavigate();

  // Local state for corrected review edits
  const [merchantName, setMerchantName] = useState<string>('');
  const [receiptDate, setReceiptDate] = useState<string>('');
  const [itemsList, setItemsList] = useState<ExpenseItem[]>([]);
  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync review state when receipt data arrives
  React.useEffect(() => {
    if (activeOCR.receiptData) {
      setMerchantName(activeOCR.receiptData.merchant);
      setReceiptDate(activeOCR.receiptData.date);
      setItemsList(activeOCR.receiptData.items);
      setServiceCharge(activeOCR.receiptData.serviceCharge);
      setTaxAmount(activeOCR.receiptData.tax);
    }
  }, [activeOCR.receiptData]);

  // Stepper definition
  const steps = [
    { id: 'upload', label: '1. Upload / Preset' },
    { id: 'raw_review', label: '2. Raw OCR Review' },
    { id: 'corrected_review', label: '3. Verify Items' },
    { id: 'assignment', label: '4. Assign to Diners' },
    { id: 'summary', label: '5. Final Split' },
  ];

  // Helper calculations
  const itemsSubtotal = itemsList.reduce((sum, item) => sum + (item.totalPrice || item.quantity * item.unitPrice), 0);
  const grandTotal = itemsSubtotal + serviceCharge + taxAmount;

  // Handle image upload with client-side canvas downscaling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          await processOCR(compressed);
        } else {
          await processOCR(reader.result as string);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Toggle item assignment for a user
  const toggleAssignment = (itemId: string, userId: string) => {
    setActiveOCR((prev: any) => {
      const current = prev.assignments[itemId] || [];
      const updated = current.includes(userId)
        ? current.filter((id: string) => id !== userId)
        : [...current, userId];

      return {
        ...prev,
        assignments: {
          ...prev.assignments,
          [itemId]: updated,
        },
      };
    });
  };

  // Calculate each member's final share including proportional tax & service charge
  const calculateParticipantShares = () => {
    const members = activeGroup?.members || [];
    const shares: Record<string, { baseAmount: number; taxAndServiceShare: number; total: number; items: string[] }> = {};

    members.forEach((m) => {
      shares[m.userId] = { baseAmount: 0, taxAndServiceShare: 0, total: 0, items: [] };
    });

    // 1. Accumulate base item shares
    itemsList.forEach((item) => {
      const assigned = activeOCR.assignments[item.id] || [];
      if (assigned.length > 0) {
        const itemTotal = item.totalPrice || item.quantity * item.unitPrice;
        const splitAmount = itemTotal / assigned.length;
        assigned.forEach((userId) => {
          if (shares[userId]) {
            shares[userId].baseAmount += splitAmount;
            shares[userId].items.push(item.name);
          }
        });
      }
    });

    // 2. Proportionally distribute service charge and tax
    const totalExtra = serviceCharge + taxAmount;
    members.forEach((m) => {
      const p = shares[m.userId];
      if (itemsSubtotal > 0 && p.baseAmount > 0) {
        const proportion = p.baseAmount / itemsSubtotal;
        p.taxAndServiceShare = proportion * totalExtra;
      }
      p.total = Math.round((p.baseAmount + p.taxAndServiceShare) * 100) / 100;
    });

    return shares;
  };

  // Save the receipt as an actual group expense
  const handleSaveAsExpense = async () => {
    if (!activeGroup) return;
    setIsSubmitting(true);

    const participantShares = calculateParticipantShares();
    const finalSplits = Object.entries(participantShares)
      .filter(([_, data]) => data.total > 0)
      .map(([userId, data]) => {
        const member = activeGroup.members.find((m) => m.userId === userId);
        return {
          userId,
          userName: member ? member.name : 'Unknown',
          amount: data.total,
          assignedItems: data.items,
        };
      });

    const newExpense = await createExpense({
      groupId: activeGroup.id,
      title: merchantName || 'Scanned Receipt',
      amount: grandTotal,
      currency: activeGroup.currency,
      category: 'food',
      payerId: currentUser.id,
      date: receiptDate || new Date().toISOString().slice(0, 10),
      splitMethod: 'items',
      splits: finalSplits,
      items: itemsList.map((item) => ({
        ...item,
        assignedTo: activeOCR.assignments[item.id] || [],
      })),
      notes: `OCR scanned bill from ${merchantName}. Includes ${itemsList.length} items.`,
    });

    setIsSubmitting(false);
    if (newExpense) {
      resetOCR();
      navigate('/dashboard');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>OCR Receipt Scanner</span>
            <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
              Gemini AI
            </span>
          </h1>
          <p className="text-xs text-slate-500">
            Auto-extract dishes, quantities, and service charges, then assign who consumed what.
          </p>
        </div>

        {activeOCR.step !== 'upload' && (
          <button
            onClick={resetOCR}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors self-start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Scan Another</span>
          </button>
        )}
      </div>

      {/* Stepper Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs overflow-x-auto">
        <div className="flex items-center min-w-[500px] justify-between">
          {steps.map((s, idx) => {
            const isCurrent = activeOCR.step === s.id;
            const isPast =
              steps.findIndex((st) => st.id === activeOCR.step) > idx;

            return (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-50'
                      : isPast
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isPast ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <span
                  className={`text-xs font-semibold whitespace-nowrap ${
                    isCurrent
                      ? 'text-indigo-600'
                      : isPast
                      ? 'text-slate-800'
                      : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
                {idx < steps.length - 1 && (
                  <div className="w-6 sm:w-10 h-0.5 bg-slate-200 mx-1" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* STEP 1: UPLOAD / PRESET SELECTION */}
      {/* ======================================================== */}
      {activeOCR.step === 'upload' && (
        <div className="space-y-6">
          {/* Upload Zone */}
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 p-8 sm:p-12 text-center transition-all">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
              <UploadCloud className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Upload Bill Photo or Camera Capture
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
              Drop your printed bill (JPG, PNG) or click to browse. The server-side Gemini 2.5 Flash model will extract items instantly.
            </p>

            <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors">
              <FileText className="w-4 h-4" />
              <span>Choose Receipt Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Quick Presets for Demo */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Or Test Instantly with Realistic Sri Lankan Bills</span>
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Click any scenario below to simulate the OCR extraction engine.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => processOCR(undefined, 'chill_ella')}
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 text-left transition-all group"
              >
                <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-600">
                  Cafe Chill — Ella Main Street
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Wood-fired pizza, lamprais, mojitos, lava cake + 10% service charge.
                </div>
                <div className="font-mono font-bold text-xs text-slate-800 mt-3">
                  Rs. 24,650.00
                </div>
              </button>

              <button
                onClick={() => processOCR(undefined, 'mirissa_seafood')}
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 text-left transition-all group"
              >
                <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-600">
                  Zephyr Seafood — Mirissa Beach
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Tiger prawns, whole snapper, Lion lager, garlic fries.
                </div>
                <div className="font-mono font-bold text-xs text-slate-800 mt-3">
                  Rs. 20,240.00
                </div>
              </button>

              <button
                onClick={() => processOCR(undefined, 'keells_super')}
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 text-left transition-all group"
              >
                <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-600">
                  Keells Supermarket — Colombo
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Fresh milk, bread, Munchee biscuits, Ceylon tea, cashews.
                </div>
                <div className="font-mono font-bold text-xs text-slate-800 mt-3">
                  Rs. 5,800.00
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PROCESSING STATE */}
      {/* ======================================================== */}
      {activeOCR.step === 'processing' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin mx-auto mb-4" />
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Analyzing Receipt with Gemini 2.5 Flash...
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Extracting line items, item quantities, prices, taxes, and service charges.
          </p>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 2: RAW REVIEW */}
      {/* ======================================================== */}
      {activeOCR.step === 'raw_review' && activeOCR.receiptData && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  OCR Status: Verified
                </span>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">
                  Extracted Bill Details
                </h2>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                {activeOCR.receiptData.items.length} items detected
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Merchant</span>
                <span className="text-xs font-bold text-slate-900">
                  {activeOCR.receiptData.merchant}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Date</span>
                <span className="text-xs font-bold text-slate-900">
                  {activeOCR.receiptData.date}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Total Amount</span>
                <span className="text-xs font-bold font-mono text-indigo-600">
                  {formatCurrency(activeOCR.receiptData.total, activeOCR.receiptData.currency)}
                </span>
              </div>
            </div>

            {/* Extracted items table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3">Item Description</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {activeOCR.receiptData.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="p-3">{item.name}</td>
                      <td className="p-3 text-center font-mono">{item.quantity}</td>
                      <td className="p-3 text-right font-mono tabular-nums">
                        {formatCurrency(item.unitPrice, activeOCR.receiptData?.currency)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold tabular-nums">
                        {formatCurrency(item.totalPrice, activeOCR.receiptData?.currency)}
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-600 text-[11px]">
                        {Math.round((item.confidence || 0.98) * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={resetOCR}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Scan Different Bill
              </button>
              <button
                onClick={() => setActiveOCR((prev: any) => ({ ...prev, step: 'corrected_review' }))}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <span>Confirm & Edit Items</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 3: CORRECTED REVIEW (EDITABLE ITEMS) */}
      {/* ======================================================== */}
      {activeOCR.step === 'corrected_review' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Verify & Edit Line Items
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Fix any misread items or adjust tax and service charges before assigning them to group members.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Merchant Name
                </label>
                <input
                  type="text"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bill Date
                </label>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Editable Items List */}
            <div className="space-y-3 mb-6">
              <label className="block text-xs font-bold text-slate-700">
                Receipt Line Items
              </label>

              {itemsList.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-3 text-xs"
                >
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => {
                      const updated = [...itemsList];
                      updated[idx].name = e.target.value;
                      setItemsList(updated);
                    }}
                    placeholder="Item name"
                    className="flex-1 w-full sm:w-auto p-2 bg-white rounded-lg border border-slate-200"
                  />
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...itemsList];
                          updated[idx].quantity = Number(e.target.value) || 1;
                          updated[idx].totalPrice = updated[idx].quantity * updated[idx].unitPrice;
                          setItemsList(updated);
                        }}
                        className="w-14 p-2 bg-white rounded-lg border border-slate-200 font-mono text-center"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500">Price:</span>
                      <input
                        type="number"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => {
                          const updated = [...itemsList];
                          updated[idx].unitPrice = Number(e.target.value) || 0;
                          updated[idx].totalPrice = updated[idx].quantity * updated[idx].unitPrice;
                          setItemsList(updated);
                        }}
                        className="w-24 p-2 bg-white rounded-lg border border-slate-200 font-mono text-right"
                      />
                    </div>
                    <div className="w-24 font-mono font-bold text-right text-slate-900 tabular-nums">
                      {formatCurrency(item.totalPrice, 'LKR')}
                    </div>
                    <button
                      onClick={() => setItemsList(itemsList.filter((_, i) => i !== idx))}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={() => {
                  const newItem: ExpenseItem = {
                    id: `item_${Date.now()}`,
                    name: 'Extra Dish / Drink',
                    quantity: 1,
                    unitPrice: 1500,
                    totalPrice: 1500,
                    assignedTo: [],
                  };
                  setItemsList([...itemsList, newItem]);
                }}
                className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl text-xs font-semibold text-indigo-600 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Missing Item</span>
              </button>
            </div>

            {/* Service Charge & Tax Adjustment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  10% Service Charge
                </label>
                <input
                  type="number"
                  value={serviceCharge}
                  onChange={(e) => setServiceCharge(Number(e.target.value) || 0)}
                  className="w-full text-xs p-2 bg-white rounded-lg border border-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Government Tax / VAT
                </label>
                <input
                  type="number"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(Number(e.target.value) || 0)}
                  className="w-full text-xs p-2 bg-white rounded-lg border border-slate-200 font-mono"
                />
              </div>
            </div>

            {/* Total Math Strip */}
            <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-xl mb-6">
              <div>
                <span className="text-xs text-slate-400 block">Calculated Grand Total</span>
                <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                  {formatCurrency(grandTotal, 'LKR')}
                </span>
              </div>
              <div className="text-right text-xs text-slate-300">
                <div>Subtotal: {formatCurrency(itemsSubtotal, 'LKR')}</div>
                <div>Extra Fees: {formatCurrency(serviceCharge + taxAmount, 'LKR')}</div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={() => setActiveOCR((prev: any) => ({ ...prev, step: 'raw_review' }))}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Back
              </button>
              <button
                onClick={() => setActiveOCR((prev: any) => ({ ...prev, step: 'assignment' }))}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <span>Proceed to Member Assignment</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 4: ITEM ASSIGNMENT TO MEMBERS */}
      {/* ======================================================== */}
      {activeOCR.step === 'assignment' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Assign Items to Diners in {activeGroup?.name}
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Click member chips on each line item to assign who consumed it. Unselected members pay Rs. 0 for that dish!
            </p>

            <div className="space-y-4 mb-6">
              {itemsList.map((item) => {
                const assigned = activeOCR.assignments[item.id] || [];

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <span className="font-bold text-xs text-slate-900 block">
                          {item.name}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {item.quantity}x @ {formatCurrency(item.unitPrice, 'LKR')}
                        </span>
                      </div>
                      <div className="font-mono font-bold text-xs text-indigo-600 tabular-nums">
                        {formatCurrency(item.totalPrice, 'LKR')}
                      </div>
                    </div>

                    {/* Member Avatars / Chips */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-slate-500 mr-1">Shared by:</span>
                      {activeGroup?.members.map((m) => {
                        const isAssigned = assigned.includes(m.userId);
                        return (
                          <button
                            key={m.userId}
                            onClick={() => toggleAssignment(item.id, m.userId)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                              isAssigned
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                isAssigned ? 'bg-white text-indigo-600' : getAvatarColor(m.name)
                              }`}
                            >
                              {m.initials}
                            </span>
                            <span>{m.name.split(' ')[0]}</span>
                          </button>
                        );
                      })}

                      {/* Select All shortcut */}
                      <button
                        onClick={() => {
                          const allIds = activeGroup?.members.map((m) => m.userId) || [];
                          setActiveOCR((prev: any) => ({
                            ...prev,
                            assignments: {
                              ...prev.assignments,
                              [item.id]: allIds,
                            },
                          }));
                        }}
                        className="text-[10px] text-indigo-600 hover:underline font-semibold ml-2"
                      >
                        Split All
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={() => setActiveOCR((prev: any) => ({ ...prev, step: 'corrected_review' }))}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Back
              </button>
              <button
                onClick={() => setActiveOCR((prev: any) => ({ ...prev, step: 'summary' }))}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <span>View Final Split Summary</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 5: FINAL SPLIT SUMMARY & CREATE EXPENSE */}
      {/* ======================================================== */}
      {activeOCR.step === 'summary' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Final Split Breakdown
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Service charges and taxes were distributed proportionally to each person's order share.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {activeGroup?.members.map((m) => {
                const shares = calculateParticipantShares();
                const person = shares[m.userId] || { baseAmount: 0, taxAndServiceShare: 0, total: 0, items: [] };

                return (
                  <div
                    key={m.userId}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${getAvatarColor(m.name)}`}>
                        {m.initials}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 truncate">{m.name}</div>
                        <div className="text-[10px] text-slate-400">{person.items.length} items allocated</div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-200 text-slate-600 text-[11px]">
                      <div className="flex justify-between">
                        <span>Items share:</span>
                        <span className="font-mono tabular-nums">{formatCurrency(person.baseAmount, 'LKR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax & Svc share:</span>
                        <span className="font-mono tabular-nums">{formatCurrency(person.taxAndServiceShare, 'LKR')}</span>
                      </div>
                      <div className="flex justify-between pt-1 font-bold text-slate-900 text-xs border-t border-slate-200">
                        <span>Total Due:</span>
                        <span className="font-mono tabular-nums text-indigo-600">{formatCurrency(person.total, 'LKR')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bill Summary Banner */}
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs mb-6">
              <div>
                <span className="font-bold text-indigo-950 block">Ready to record this expense?</span>
                <span className="text-indigo-800 text-[11px]">
                  Will be saved under "{activeGroup?.name}" with {currentUser.name} as payer.
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-indigo-600 uppercase font-bold tracking-wider block">Total Bill</span>
                <span className="text-base font-bold font-mono text-indigo-950 tabular-nums">
                  {formatCurrency(grandTotal, 'LKR')}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={() => setActiveOCR((prev: any) => ({ ...prev, step: 'assignment' }))}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Back to Assignment
              </button>
              <button
                onClick={handleSaveAsExpense}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Recording Expense...' : 'Save & Add to Group'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
