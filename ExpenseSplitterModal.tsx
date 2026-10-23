import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calculator,
  Users,
  Minus,
  Plus,
  AlertCircle,
  IndianRupee,
  Share2,
  Check,
  ArrowRight,
  Sparkles,
  Edit2
} from 'lucide-react';
import { Trip } from '../types/travel';
import { SetBudgetModal } from './SetBudgetModal';

interface ExpenseSplitterModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onTripUpdated?: (updatedTrip: Trip) => void;
}

export const ExpenseSplitterModal: React.FC<ExpenseSplitterModalProps> = ({
  isOpen,
  onClose,
  trip,
  onTripUpdated,
}) => {
  const storageKey = `gt_splitter_members_${trip.id}`;

  // Member count string state for responsive typing and stepper control
  const [memberInput, setMemberInput] = useState<string>('2');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSetBudgetModal, setShowSetBudgetModal] = useState(false);

  // Initialize or reload saved member count for this specific itinerary
  useEffect(() => {
    if (!isOpen) return;

    try {
      const savedCount = localStorage.getItem(storageKey);
      if (savedCount !== null) {
        const parsed = parseInt(savedCount, 10);
        if (!isNaN(parsed) && parsed >= 1) {
          setMemberInput(String(parsed));
          setInlineError(null);
          return;
        }
      }
    } catch {
      // Ignore localStorage access errors
    }

    // Default to 2 members (or trip member count if >= 1)
    const initialDefault = trip.members && trip.members.length > 1 ? trip.members.length : 2;
    setMemberInput(String(initialDefault));
    setInlineError(null);
  }, [isOpen, trip.id, storageKey, trip.members]);

  // Handle member input changes & validation
  const handleInputChange = (value: string) => {
    setMemberInput(value);

    const trimmed = value.trim();
    if (!trimmed) {
      setInlineError('Please enter at least 1 member');
      return;
    }

    const num = Number(trimmed);
    if (isNaN(num)) {
      setInlineError('Please enter a valid number of members');
      return;
    }

    if (!Number.isInteger(num)) {
      setInlineError('Member count must be a whole number');
      return;
    }

    if (num < 1) {
      setInlineError('Minimum 1 group member required');
      return;
    }

    // Valid member count
    setInlineError(null);
    try {
      localStorage.setItem(storageKey, String(num));
    } catch {
      // Ignore localStorage errors
    }
  };

  const updateMemberCountByDelta = (delta: number) => {
    const current = parseInt(memberInput, 10);
    const base = isNaN(current) || current < 1 ? 1 : current;
    const next = Math.max(1, base + delta);
    setMemberInput(String(next));
    setInlineError(null);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {
      // Ignore localStorage errors
    }
  };

  const setPresetCount = (count: number) => {
    setMemberInput(String(count));
    setInlineError(null);
    try {
      localStorage.setItem(storageKey, String(count));
    } catch {
      // Ignore localStorage errors
    }
  };

  // Calculations
  const totalBudget = Number(trip.budget_total) || 0;
  const hasBudget = totalBudget > 0;

  const validMembers = useMemo(() => {
    const parsed = parseInt(memberInput.trim(), 10);
    if (!isNaN(parsed) && parsed >= 1 && Number.isInteger(parsed)) {
      return parsed;
    }
    return null;
  }, [memberInput]);

  // Per-person share calculation (rounded to 2 decimal places)
  const perPersonShare = useMemo(() => {
    if (!hasBudget || !validMembers) return 0;
    return Math.round((totalBudget / validMembers) * 100) / 100;
  }, [totalBudget, hasBudget, validMembers]);

  // Formatted values
  const formatCurrency = (amount: number, forceDecimals = false) => {
    const hasCents = amount % 1 !== 0;
    return amount.toLocaleString('en-IN', {
      minimumFractionDigits: forceDecimals || hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    });
  };

  const formattedTotal = formatCurrency(totalBudget);
  const formattedPerPerson = formatCurrency(perPersonShare, perPersonShare % 1 !== 0);

  // Breakdown formula text
  const breakdownText = validMembers && hasBudget
    ? `₹${formattedTotal} ÷ ${validMembers} ${validMembers === 1 ? 'member' : 'members'} = ₹${formattedPerPerson} per person`
    : null;

  const handleCopySummary = () => {
    if (!breakdownText) return;
    const summary = `📊 ${trip.name} - Expense Splitter\nTotal Budget: ₹${formattedTotal}\nMembers: ${validMembers}\n👉 Per Person Share: ₹${formattedPerPerson}\nFormula: ${breakdownText}`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
        <div
          className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-300"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-splitter-title"
        >
          {/* Mobile Bottom Sheet Pull Indicator */}
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 sm:hidden" />

          {/* Modal Header */}
          <div className="p-5 pb-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h2 id="expense-splitter-title" className="text-lg font-bold font-serif-heading text-slate-900 leading-tight">
                  Expense Splitter
                </h2>
                <p className="text-xs text-slate-500 truncate max-w-[220px] sm:max-w-[280px]">
                  {trip.name}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close Expense Splitter"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-5 overflow-y-auto">
            {/* Itinerary & Budget Overview Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Itinerary Total Budget
                </span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className="text-xl font-bold font-mono text-slate-900">
                    {hasBudget ? `₹${formattedTotal}` : '₹0'}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">
                    INR
                  </span>
                </div>
              </div>

              {onTripUpdated && (
                <button
                  type="button"
                  onClick={() => setShowSetBudgetModal(true)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 flex items-center space-x-1 transition-all cursor-pointer"
                  title="Update itinerary total budget"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>{hasBudget ? 'Edit' : 'Set Budget'}</span>
                </button>
              )}
            </div>

            {/* Edge Case: Empty or Zero Budget Notice */}
            {!hasBudget && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2 animate-in fade-in">
                <div className="flex items-center space-x-2 text-amber-800 font-semibold text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Add a budget to this itinerary to split expenses</span>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  The expense splitter calculates equal shares based on this itinerary's allocated total budget. Set a budget to calculate per-person shares.
                </p>
                {onTripUpdated && (
                  <button
                    type="button"
                    onClick={() => setShowSetBudgetModal(true)}
                    className="w-full mt-2 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Set Itinerary Budget Now</span>
                  </button>
                )}
              </div>
            )}

            {/* Group Members Stepper & Input Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="member-count-input"
                  className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center space-x-1.5"
                >
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Number of Group Members</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">Min: 1</span>
              </div>

              {/* Stepper Control */}
              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => updateMemberCountByDelta(-1)}
                  disabled={validMembers !== null && validMembers <= 1}
                  className="w-12 h-12 rounded-xl bg-white text-slate-700 shadow-2xs border border-slate-200 hover:bg-slate-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer"
                  aria-label="Decrease member count"
                >
                  <Minus className="w-5 h-5 text-slate-700" />
                </button>

                <div className="flex flex-col items-center justify-center px-4">
                  <div className="flex items-baseline space-x-1">
                    <input
                      id="member-count-input"
                      type="number"
                      min="1"
                      step="1"
                      value={memberInput}
                      onChange={(e) => handleInputChange(e.target.value)}
                      className={`w-20 text-center font-bold text-2xl bg-transparent border-b-2 outline-none pb-1 transition-colors ${
                        inlineError
                          ? 'border-rose-500 text-rose-700'
                          : 'border-slate-300 focus:border-sky-600 text-slate-900'
                      }`}
                      aria-invalid={inlineError ? 'true' : 'false'}
                    />
                    <span className="text-xs font-medium text-slate-400">
                      {validMembers === 1 ? 'person' : 'people'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => updateMemberCountByDelta(1)}
                  className="w-12 h-12 rounded-xl bg-white text-slate-700 shadow-2xs border border-slate-200 hover:bg-slate-100 active:scale-95 flex items-center justify-center transition-all cursor-pointer"
                  aria-label="Increase member count"
                >
                  <Plus className="w-5 h-5 text-slate-700" />
                </button>
              </div>

              {/* Inline Error Message */}
              {inlineError && (
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-rose-600 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{inlineError}</span>
                </div>
              )}

              {/* Quick Preset Buttons */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-medium text-slate-400">Quick set:</span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 6, 8].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPresetCount(preset)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        validMembers === preset
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Most Prominent Element: Per-Person Share Display */}
            {hasBudget && validMembers && !inlineError && (
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-700 text-white p-6 shadow-lg shadow-emerald-900/15 border border-emerald-500/30 text-center space-y-3">
                {/* Decorative highlight */}
                <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />

                <div className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-bold uppercase tracking-wider text-emerald-100">
                  <Sparkles className="w-3 h-3 text-emerald-200" />
                  <span>Per-Person Share</span>
                </div>

                {/* Extremely Prominent Per-Person Amount */}
                <div className="flex items-baseline justify-center space-x-1 my-1">
                  <span className="text-2xl sm:text-3xl font-bold text-emerald-200">₹</span>
                  <span className="text-4xl sm:text-5xl font-black tracking-tight font-serif-heading">
                    {formattedPerPerson}
                  </span>
                </div>

                {/* Breakdown Calculation Sentence */}
                <div className="pt-2 border-t border-white/15">
                  <p className="text-xs sm:text-sm font-medium text-emerald-50/90 leading-relaxed font-mono">
                    {breakdownText}
                  </p>
                </div>
              </div>
            )}

            {/* Persistence Confirmation Note */}
            <div className="text-[11px] text-slate-400 text-center">
              Member count automatically saved for <span className="font-semibold text-slate-600">{trip.name}</span>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
            {hasBudget && validMembers && !inlineError ? (
              <button
                type="button"
                onClick={handleCopySummary}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer"
                title="Copy share summary to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-slate-500" />
                    <span>Copy Share</span>
                  </>
                )}
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer ml-auto"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Optional Set Budget Modal for instant inline updates if budget is empty/edited */}
      {showSetBudgetModal && onTripUpdated && (
        <SetBudgetModal
          isOpen={showSetBudgetModal}
          onClose={() => setShowSetBudgetModal(false)}
          trip={trip}
          onTripUpdated={(updated) => {
            onTripUpdated(updated);
            setShowSetBudgetModal(false);
          }}
        />
      )}
    </>
  );
};
