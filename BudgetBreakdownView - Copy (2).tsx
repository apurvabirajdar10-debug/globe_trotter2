import React, { useState, useMemo } from 'react';
import {
  IndianRupee,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  Users,
  ArrowRight,
  Send,
  Check,
  ExternalLink,
  History,
  AlertCircle,
  X,
  CreditCard,
  QrCode,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Trip, Expense, Stop, TripMember, User as UserType } from '../types/travel';
import { api } from '../lib/api';
import { BudgetMeter } from './BudgetMeter';
import { SetBudgetModal } from './SetBudgetModal';
import { TripMembersModal } from './TripMembersModal';

interface BudgetBreakdownViewProps {
  trip: Trip;
  currentUser?: UserType | null;
  onTripUpdated: (updatedTrip: Trip) => void;
  onOpenMembersModal?: () => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; fill: string }> = {
  transport: { bg: 'bg-sky-100', text: 'text-sky-800', fill: '#0284c7' },
  stay: { bg: 'bg-indigo-100', text: 'text-indigo-800', fill: '#4f46e5' },
  activities: { bg: 'bg-amber-100', text: 'text-amber-800', fill: '#d97706' },
  meals: { bg: 'bg-emerald-100', text: 'text-emerald-800', fill: '#059669' },
  miscellaneous: { bg: 'bg-purple-100', text: 'text-purple-800', fill: '#9333ea' },
};

export interface BalanceRecord {
  userId: number;
  name: string;
  email?: string;
  photoUrl?: string;
  upiId?: string;
  role?: string;
  isFormerMember?: boolean;
  totalPaid: number;
  totalOwed: number;
  settledSent: number;
  settledReceived: number;
  net: number;
}

export interface SuggestedSettlement {
  fromUserId: number;
  fromName: string;
  toUserId: number;
  toName: string;
  toUpiId?: string;
  amount: number;
}

export const BudgetBreakdownView: React.FC<BudgetBreakdownViewProps> = ({
  trip,
  currentUser,
  onTripUpdated,
  onOpenMembersModal,
}) => {
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showSetBudgetModal, setShowSetBudgetModal] = useState(false);
  const [showTripMembersModal, setShowTripMembersModal] = useState(false);
  const [showSettlementHistory, setShowSettlementHistory] = useState(false);
  const [settlingPayment, setSettlingPayment] = useState<SuggestedSettlement | null>(null);
  const [recordingSettlement, setRecordingSettlement] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'transport' | 'stay' | 'activities' | 'meals' | 'miscellaneous'>('meals');
  const [amount, setAmount] = useState<number | string>('');
  const [date, setDate] = useState(trip.start_date || new Date().toISOString().split('T')[0]);
  const [stopId, setStopId] = useState<number | ''>('');
  const [paidByUserId, setPaidByUserId] = useState<number>(trip.user_id);
  const [notes, setNotes] = useState('');

  // Group split form state
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage'>('equal');
  const [selectedSplitMemberIds, setSelectedSplitMemberIds] = useState<number[]>([]);
  const [exactShares, setExactShares] = useState<Record<number, string | number>>({});
  const [percentageShares, setPercentageShares] = useState<Record<number, string | number>>({});

  const [titleError, setTitleError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Category filter for table
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const expenses = trip.expenses || [];
  const stops = trip.stops || [];
  const totalBudget = trip.budget_total || 0;
  const totalSpent = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const remainingBudget = totalBudget - totalSpent;
  const spentPercent = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;
  const isOverBudget = totalSpent > totalBudget && totalBudget > 0;

  // Active trip members list with robust fallback
  const tripMembers: TripMember[] = useMemo(() => {
    if (trip.members && trip.members.length > 0) {
      return trip.members;
    }
    return [
      {
        trip_id: trip.id,
        user_id: trip.user_id,
        role: 'owner',
        joined_at: trip.created_at || new Date().toISOString(),
        name: trip.user_name || 'Trip Owner',
        email: 'owner@globetrotter.io',
        photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      },
    ];
  }, [trip.members, trip.id, trip.user_id, trip.created_at, trip.user_name]);

  // Compute category breakdown
  const categoryTotals: Record<string, number> = {
    transport: 0,
    stay: 0,
    activities: 0,
    meals: 0,
    miscellaneous: 0,
  };

  expenses.forEach(e => {
    const cat = e.category || 'miscellaneous';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (e.amount || 0);
  });

  // Calculate day difference for daily average budget
  const startDate = new Date(trip.start_date);
  const endDate = new Date(trip.end_date);
  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1);
  const dailyAverageBudget = totalBudget > 0 ? Math.round(totalBudget / totalDays) : 250;

  // Daily totals for overbudget day detection
  const dailyTotals: Record<string, number> = {};
  expenses.forEach(e => {
    dailyTotals[e.date] = (dailyTotals[e.date] || 0) + e.amount;
  });
  const overbudgetDays = Object.entries(dailyTotals).filter(([d, amt]) => amt > dailyAverageBudget * 1.3);

  /* ==========================================================================
     BALANCES & GREEDY SETTLEMENT ALGORITHM
     ========================================================================== */
  const { balances, suggestedSettlements } = useMemo(() => {
    // Collect all participants: current members + any historical user who paid or has a split
    const memberMap = new Map<number, BalanceRecord>();

    tripMembers.forEach(m => {
      memberMap.set(m.user_id, {
        userId: m.user_id,
        name: m.name,
        email: m.email,
        photoUrl: m.photo_url,
        upiId: m.upi_id,
        role: m.role,
        isFormerMember: false,
        totalPaid: 0,
        totalOwed: 0,
        settledSent: 0,
        settledReceived: 0,
        net: 0,
      });
    });

    // Also include any users referenced in expenses or settlements that may have left
    expenses.forEach(exp => {
      if (exp.paid_by_user_id && !memberMap.has(exp.paid_by_user_id)) {
        memberMap.set(exp.paid_by_user_id, {
          userId: exp.paid_by_user_id,
          name: exp.paid_by_user_name || exp.paid_by || `Traveler #${exp.paid_by_user_id}`,
          isFormerMember: true,
          totalPaid: 0,
          totalOwed: 0,
          settledSent: 0,
          settledReceived: 0,
          net: 0,
        });
      }
      exp.splits?.forEach(s => {
        if (!memberMap.has(s.user_id)) {
          memberMap.set(s.user_id, {
            userId: s.user_id,
            name: s.user_name || `Traveler #${s.user_id}`,
            isFormerMember: true,
            totalPaid: 0,
            totalOwed: 0,
            settledSent: 0,
            settledReceived: 0,
            net: 0,
          });
        }
      });
    });

    (trip.settlements || []).forEach(st => {
      if (!memberMap.has(st.from_user_id)) {
        memberMap.set(st.from_user_id, {
          userId: st.from_user_id,
          name: st.from_user_name || `Traveler #${st.from_user_id}`,
          isFormerMember: true,
          totalPaid: 0,
          totalOwed: 0,
          settledSent: 0,
          settledReceived: 0,
          net: 0,
        });
      }
      if (!memberMap.has(st.to_user_id)) {
        memberMap.set(st.to_user_id, {
          userId: st.to_user_id,
          name: st.to_user_name || `Traveler #${st.to_user_id}`,
          isFormerMember: true,
          totalPaid: 0,
          totalOwed: 0,
          settledSent: 0,
          settledReceived: 0,
          net: 0,
        });
      }
    });

    // 1. Accumulate Expenses & Splits
    expenses.forEach(exp => {
      const amt = Number(exp.amount) || 0;
      if (amt <= 0) return;

      const splits = exp.splits || [];
      if (splits.length > 0) {
        // Group split expense
        if (exp.paid_by_user_id && memberMap.has(exp.paid_by_user_id)) {
          const payer = memberMap.get(exp.paid_by_user_id)!;
          payer.totalPaid += amt;
        }

        splits.forEach(s => {
          const share = Number(s.share_amount) || 0;
          if (memberMap.has(s.user_id)) {
            const member = memberMap.get(s.user_id)!;
            member.totalOwed += share;
          }
        });
      }
      // Note: Legacy expenses without splits are treated as unsplit (paid by user for themselves)
    });

    // 2. Accumulate Settlements
    (trip.settlements || []).forEach(st => {
      const stAmt = Number(st.amount) || 0;
      if (memberMap.has(st.from_user_id)) {
        memberMap.get(st.from_user_id)!.settledSent += stAmt;
      }
      if (memberMap.has(st.to_user_id)) {
        memberMap.get(st.to_user_id)!.settledReceived += stAmt;
      }
    });

    // 3. Compute Net Balance per participant:
    // Net = (Total Paid - Total Owed) + (Settled Sent - Settled Received)
    const balList: BalanceRecord[] = [];
    memberMap.forEach(rec => {
      rec.totalPaid = Math.round(rec.totalPaid * 100) / 100;
      rec.totalOwed = Math.round(rec.totalOwed * 100) / 100;
      rec.settledSent = Math.round(rec.settledSent * 100) / 100;
      rec.settledReceived = Math.round(rec.settledReceived * 100) / 100;
      rec.net = Math.round((rec.totalPaid - rec.totalOwed + rec.settledSent - rec.settledReceived) * 100) / 100;
      balList.push(rec);
    });

    // 4. Greedy Settle Algorithm (Fewest Transactions)
    // Debtors (net < -0.009) and Creditors (net > 0.009)
    const debtors = balList
      .filter(b => b.net < -0.009)
      .map(b => ({ ...b, balance: Math.round(-b.net * 100) / 100 }))
      .sort((a, b) => b.balance - a.balance);

    const creditors = balList
      .filter(b => b.net > 0.009)
      .map(b => ({ ...b, balance: Math.round(b.net * 100) / 100 }))
      .sort((a, b) => b.balance - a.balance);

    const settlements: SuggestedSettlement[] = [];
    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];
      const settleAmt = Math.min(debtor.balance, creditor.balance);
      const roundedSettle = Math.round(settleAmt * 100) / 100;

      if (roundedSettle > 0.009) {
        settlements.push({
          fromUserId: debtor.userId,
          fromName: debtor.name,
          toUserId: creditor.userId,
          toName: creditor.name,
          toUpiId: creditor.upiId,
          amount: roundedSettle,
        });
      }

      debtor.balance = Math.round((debtor.balance - roundedSettle) * 100) / 100;
      creditor.balance = Math.round((creditor.balance - roundedSettle) * 100) / 100;

      if (debtor.balance <= 0.009) dIdx++;
      if (creditor.balance <= 0.009) cIdx++;
    }

    return { balances: balList, suggestedSettlements: settlements };
  }, [tripMembers, expenses, trip.settlements]);

  /* ==========================================================================
     ROUNDING REMAINDER DISTRIBUTION & LIVE SHARES
     ========================================================================== */
  const parsedTotalAmount = Number(amount) || 0;

  // Calculates exact shares for each selected member distributed to the paisa (0.01 INR)
  const computedShares = useMemo(() => {
    const selectedCount = selectedSplitMemberIds.length;
    if (selectedCount === 0 || parsedTotalAmount <= 0) return {};

    if (splitType === 'equal') {
      const totalCents = Math.round(parsedTotalAmount * 100);
      const baseCents = Math.floor(totalCents / selectedCount);
      const remainderCents = totalCents - baseCents * selectedCount;

      const result: Record<number, number> = {};
      selectedSplitMemberIds.forEach((uid, idx) => {
        const cents = baseCents + (idx < remainderCents ? 1 : 0);
        result[uid] = cents / 100;
      });
      return result;
    }

    if (splitType === 'exact') {
      const result: Record<number, number> = {};
      selectedSplitMemberIds.forEach(uid => {
        result[uid] = Number(exactShares[uid]) || 0;
      });
      return result;
    }

    if (splitType === 'percentage') {
      const totalCents = Math.round(parsedTotalAmount * 100);
      let allocatedCents = 0;
      const result: Record<number, number> = {};

      selectedSplitMemberIds.forEach(uid => {
        const pct = Number(percentageShares[uid]) || 0;
        const cents = Math.round((totalCents * pct) / 100);
        result[uid] = cents / 100;
        allocatedCents += cents;
      });

      // Distribute any rounding difference so sum equals total to the paisa
      let diff = totalCents - allocatedCents;
      if (diff !== 0 && selectedSplitMemberIds.length > 0) {
        const step = diff > 0 ? 1 : -1;
        let i = 0;
        while (diff !== 0 && i < selectedSplitMemberIds.length * 4) {
          const uid = selectedSplitMemberIds[i % selectedSplitMemberIds.length];
          const curCents = Math.round((result[uid] || 0) * 100);
          if (curCents + step >= 0) {
            result[uid] = (curCents + step) / 100;
            diff -= step;
          }
          i++;
        }
      }
      return result;
    }

    return {};
  }, [splitType, parsedTotalAmount, selectedSplitMemberIds, exactShares, percentageShares]);

  // Sum of computed shares
  const currentSharesSum = useMemo(() => {
    return Object.values(computedShares).reduce((acc, val) => acc + (val || 0), 0);
  }, [computedShares]);

  // Open modal with fresh state or existing expense
  const openAddModal = (existing?: Expense) => {
    setError(null);
    setTitleError(null);
    setAmountError(null);
    setDateError(null);
    setSplitError(null);

    const allMemberIds = tripMembers.map(m => m.user_id);

    if (existing) {
      setExpenseToEdit(existing);
      setTitle(existing.title);
      setCategory(existing.category);
      setAmount(existing.amount);
      setDate(existing.date);
      setStopId(existing.stop_id ?? '');
      setPaidByUserId(existing.paid_by_user_id || tripMembers[0]?.user_id || trip.user_id);
      setNotes(existing.notes || '');

      if (existing.splits && existing.splits.length > 0) {
        const splitUids = existing.splits.map(s => s.user_id);
        setSelectedSplitMemberIds(splitUids);

        // Check if equal, exact, or percentage
        const exactMap: Record<number, number> = {};
        const pctMap: Record<number, number> = {};
        existing.splits.forEach(s => {
          exactMap[s.user_id] = s.share_amount;
          pctMap[s.user_id] = existing.amount > 0 ? Math.round((s.share_amount / existing.amount) * 100) : 0;
        });
        setExactShares(exactMap);
        setPercentageShares(pctMap);
        setSplitType('equal');
      } else {
        setSelectedSplitMemberIds(allMemberIds);
        setSplitType('equal');
      }
    } else {
      setExpenseToEdit(null);
      setTitle('');
      setCategory('meals');
      setAmount('');
      setDate(trip.start_date || new Date().toISOString().split('T')[0]);
      setStopId(stops.length > 0 ? stops[0].id : '');
      const defaultPayerId = currentUser?.id && tripMembers.some(m => m.user_id === currentUser.id)
        ? currentUser.id
        : tripMembers[0]?.user_id || trip.user_id;
      setPaidByUserId(defaultPayerId);
      setNotes('');
      setSelectedSplitMemberIds(allMemberIds);
      setSplitType('equal');
      setExactShares({});
      setPercentageShares({});
    }
    setShowAddExpenseModal(true);
  };

  const handleToggleMember = (uid: number) => {
    setSelectedSplitMemberIds(prev => {
      if (prev.includes(uid)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(id => id !== uid);
      } else {
        return [...prev, uid];
      }
    });
  };

  const validateExpense = (): boolean => {
    let valid = true;
    setTitleError(null);
    setAmountError(null);
    setDateError(null);
    setSplitError(null);
    setError(null);

    if (!title.trim()) {
      setTitleError('Expense title cannot be left blank.');
      valid = false;
    }

    const numAmount = Number(amount);
    if (amount === '' || isNaN(numAmount) || numAmount <= 0) {
      setAmountError('Please enter a valid amount greater than 0.');
      valid = false;
    }

    if (!date) {
      setDateError('Date cannot be left blank.');
      valid = false;
    }

    if (selectedSplitMemberIds.length === 0) {
      setSplitError('Please select at least one member to split this expense with.');
      valid = false;
    }

    if (splitType === 'exact') {
      const sumExact = selectedSplitMemberIds.reduce((acc, uid) => acc + (Number(exactShares[uid]) || 0), 0);
      const diff = Math.abs(sumExact - numAmount);
      if (diff > 0.01) {
        setSplitError(`Exact shares sum to ₹${sumExact.toFixed(2)}, which must equal total ₹${numAmount.toFixed(2)} (diff: ₹${(numAmount - sumExact).toFixed(2)}).`);
        valid = false;
      }
    }

    if (splitType === 'percentage') {
      const sumPct = selectedSplitMemberIds.reduce((acc, uid) => acc + (Number(percentageShares[uid]) || 0), 0);
      if (Math.abs(sumPct - 100) > 0.1) {
        setSplitError(`Percentages sum to ${sumPct}%, which must equal exactly 100%.`);
        valid = false;
      }
    }

    return valid;
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateExpense()) return;

    setLoading(true);
    try {
      const payerObj = tripMembers.find(m => m.user_id === paidByUserId);
      const payerName = payerObj?.name || 'Traveler';

      // Build splits array
      const splitsPayload = selectedSplitMemberIds.map(uid => ({
        user_id: uid,
        share_amount: computedShares[uid] !== undefined ? computedShares[uid] : 0,
      }));

      const payload = {
        title: title.trim(),
        category,
        amount: Number(amount) || 0,
        currency: 'INR',
        date,
        stop_id: stopId !== '' ? Number(stopId) : null,
        paid_by: payerName,
        paid_by_user_id: paidByUserId,
        notes: notes.trim(),
        splits: splitsPayload,
      };

      if (expenseToEdit) {
        await api.updateExpense(expenseToEdit.id, payload);
      } else {
        await api.addExpense(trip.id, payload);
      }

      const refreshed = await api.getTrip(trip.id);
      onTripUpdated(refreshed.trip);
      setShowAddExpenseModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (!confirm('Are you sure you want to remove this expense entry?')) return;
    try {
      await api.deleteExpense(expenseId);
      const refreshed = await api.getTrip(trip.id);
      onTripUpdated(refreshed.trip);
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense');
    }
  };

  // Record settlement between members
  const handleConfirmSettlement = async (settlement: SuggestedSettlement) => {
    setSettlingPayment(settlement);
    setRecordingSettlement(true);
    try {
      const res = await api.recordSettlement(trip.id, {
        from_user_id: settlement.fromUserId,
        to_user_id: settlement.toUserId,
        amount: settlement.amount,
      });
      onTripUpdated(res.trip);
    } catch (err: any) {
      alert(err.message || 'Failed to record settlement');
    } finally {
      setRecordingSettlement(false);
      setSettlingPayment(null);
    }
  };

  const filteredExpenses = expenses.filter(e => {
    if (categoryFilter === 'all') return true;
    return e.category === categoryFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wide">
              Financial Summary & Cost Splitting
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {trip.name} • {expenses.length} Expenses • {tripMembers.length} Members
            </span>
          </div>
          <h1 className="text-2xl font-bold font-serif-heading text-slate-900 mt-1">
            Trip Budget & Group Balances
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time financial tracking, multi-way group splitting with paisa rounding, and instant UPI settlement links.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => onOpenMembersModal ? onOpenMembersModal() : setShowTripMembersModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold shadow-2xs flex items-center space-x-1.5 transition-all cursor-pointer border border-sky-200"
          >
            <Users className="w-4 h-4 text-sky-600" />
            <span>Members ({tripMembers.length})</span>
          </button>
          <button
            onClick={() => setShowSetBudgetModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer border border-slate-200"
          >
            <IndianRupee className="w-4 h-4 text-emerald-600" />
            <span>Set Budget</span>
          </button>
          <button
            onClick={() => openAddModal()}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* PROMINENT REAL-TIME BUDGET METER */}
      <BudgetMeter
        trip={trip}
        onOpenSetBudget={() => setShowSetBudgetModal(true)}
      />

      {/* Top 3 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Target Budget */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs relative group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Allocated Budget
            </span>
            <button
              onClick={() => setShowSetBudgetModal(true)}
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center space-x-0.5 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
              <span>Change</span>
            </button>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            ₹{totalBudget.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Daily target: ~₹{dailyAverageBudget.toLocaleString('en-IN')}/day ({totalDays} days)
          </p>
        </div>

        {/* Total Spent */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Spent
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isOverBudget ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {spentPercent}% utilized
            </span>
          </div>
          <p className={`text-2xl font-bold mt-1 ${isOverBudget ? 'text-rose-600' : 'text-slate-900'}`}>
            ₹{totalSpent.toLocaleString('en-IN')}
          </p>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOverBudget ? 'bg-rose-500' : (spentPercent > 85 ? 'bg-amber-500' : 'bg-emerald-500')
              }`}
              style={{ width: `${spentPercent}%` }}
            />
          </div>
        </div>

        {/* Remaining Budget */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {remainingBudget >= 0 ? 'Remaining Balance' : 'Overbudget Amount'}
          </span>
          <p className={`text-2xl font-bold mt-1 ${remainingBudget < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            ₹{Math.abs(remainingBudget).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {remainingBudget >= 0 ? 'Within target parameters' : 'Review expenses below for optimization'}
          </p>
        </div>
      </div>

      {/* SECTION: GROUP BALANCES & WHO PAYS WHOM (GREEDY SETTLEMENT) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold font-serif-heading text-slate-900">
              Group Balances & Settlements
            </h2>
          </div>
          {(trip.settlements && trip.settlements.length > 0) && (
            <button
              onClick={() => setShowSettlementHistory(!showSettlementHistory)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center space-x-1 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-indigo-500" />
              <span>Settlement History ({trip.settlements.length})</span>
              {showSettlementHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Member Balances Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {balances.map(b => {
            const isOwed = b.net > 0.009;
            const owes = b.net < -0.009;
            const isSettled = !isOwed && !owes;

            return (
              <div
                key={b.userId}
                className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2 relative"
              >
                <div className="flex items-center space-x-2.5">
                  <img
                    src={b.photoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80'}
                    alt={b.name}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate flex items-center space-x-1">
                      <span>{b.name}</span>
                      {b.isFormerMember && (
                        <span className="text-[9px] px-1 bg-slate-100 text-slate-500 rounded font-normal">Former</span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      Paid: ₹{b.totalPaid.toLocaleString('en-IN')} • Share: ₹{b.totalOwed.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    Net Balance:
                  </span>
                  <span className={`text-xs font-bold ${
                    isOwed
                      ? 'text-emerald-600'
                      : owes
                      ? 'text-rose-600'
                      : 'text-slate-500'
                  }`}>
                    {isOwed && `+₹${b.net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                    {owes && `-₹${Math.abs(b.net).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                    {isSettled && 'Settled up (₹0.00)'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* "Who Pays Whom" Simplified Greedy Settlement List */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Suggested Debt Clearances (Fewest Transactions)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Our greedy settle algorithm pairs the largest debtors with creditors to minimize cross-person bank transactions.
              </p>
            </div>
            {suggestedSettlements.length === 0 && (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>All balances are settled!</span>
              </span>
            )}
          </div>

          {suggestedSettlements.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl">
              No outstanding balances between group members. Everyone is settled up!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {suggestedSettlements.map((st, i) => {
                const upiLink = st.toUpiId
                  ? `upi://pay?pa=${encodeURIComponent(st.toUpiId)}&pn=${encodeURIComponent(st.toName)}&am=${st.amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`GlobeTrotter settlement for ${trip.name}`)}`
                  : null;

                const isCurrentlySettling = recordingSettlement && settlingPayment?.fromUserId === st.fromUserId && settlingPayment?.toUserId === st.toUserId;

                return (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="text-xs font-bold text-slate-900 truncate">{st.fromName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-xs font-bold text-emerald-800 truncate">{st.toName}</span>
                      </div>
                      <span className="text-base font-extrabold text-slate-900 shrink-0">
                        ₹{st.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      {st.toUpiId ? (
                        <div className="flex items-center space-x-1.5 text-[11px] text-purple-700 font-mono">
                          <QrCode className="w-3.5 h-3.5" />
                          <span className="truncate">UPI: {st.toUpiId}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">Cash / Direct Bank Transfer</span>
                      )}

                      <div className="flex items-center space-x-2 shrink-0">
                        {upiLink && (
                          <a
                            href={upiLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold shadow-2xs flex items-center space-x-1 transition-colors"
                            title="Open Google Pay / PhonePe / Paytm with amount prefilled"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Pay via UPI</span>
                          </a>
                        )}

                        <button
                          onClick={() => handleConfirmSettlement(st)}
                          disabled={isCurrentlySettling}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold shadow-2xs flex items-center space-x-1 transition-colors cursor-pointer"
                        >
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>{isCurrentlySettling ? 'Recording...' : 'Mark Settled'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Collapsible Settlement History */}
          {showSettlementHistory && trip.settlements && trip.settlements.length > 0 && (
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Recorded Settlement Payments
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {trip.settlements.map(st => (
                  <div
                    key={st.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs text-slate-600"
                  >
                    <div className="flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-slate-800">{st.from_user_name || `Member #${st.from_user_id}`}</span>
                      <span>paid</span>
                      <span className="font-semibold text-slate-800">{st.to_user_name || `Member #${st.to_user_id}`}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-emerald-700">₹{st.amount.toLocaleString('en-IN')}</span>
                      <span className="text-[10px] text-slate-400">{st.created_at?.split('T')[0]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overbudget Day Alerts Banner */}
      {overbudgetDays.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <h4 className="font-bold text-xs uppercase tracking-wider">
              Overbudget Day Alert ({overbudgetDays.length} {overbudgetDays.length === 1 ? 'day' : 'days'})
            </h4>
          </div>
          <p className="text-xs leading-relaxed text-amber-800">
            Spending on these dates exceeded 130% of your daily average (₹{dailyAverageBudget.toLocaleString('en-IN')}/day). Consider adjusting fine-dining or booking tickets in advance:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {overbudgetDays.map(([d, amt]) => (
              <span key={d} className="px-2.5 py-1 rounded-xl bg-white border border-amber-300 text-xs font-semibold text-amber-900 shadow-2xs">
                {d}: ₹{amt.toLocaleString('en-IN')} (+₹{Math.round(amt - dailyAverageBudget).toLocaleString('en-IN')})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Visual Charts & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVG Donut Chart */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-4">
          <div className="flex items-center space-x-2 self-start">
            <PieChart className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-sm text-slate-900">Spending by Category</h3>
          </div>

          <div className="relative w-44 h-44 flex items-center justify-center">
            {totalSpent === 0 ? (
              <div className="w-full h-full rounded-full border-4 border-slate-100 flex items-center justify-center text-xs text-slate-400">
                No Expenses
              </div>
            ) : (
              <svg className="w-full h-full -rotate-90" viewBox="0 0 42 42">
                {(() => {
                  let accumulatedPercent = 0;
                  return Object.entries(categoryTotals).map(([cat, amt]) => {
                    if (amt === 0) return null;
                    const slicePercent = (amt / totalSpent) * 100;
                    const strokeDasharray = `${slicePercent} ${100 - slicePercent}`;
                    const strokeDashoffset = -accumulatedPercent;
                    accumulatedPercent += slicePercent;

                    return (
                      <circle
                        key={cat}
                        cx="21"
                        cy="21"
                        r="15.9155"
                        fill="transparent"
                        stroke={CATEGORY_COLORS[cat]?.fill || '#94a3b8'}
                        strokeWidth="4"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                      />
                    );
                  });
                })()}
              </svg>
            )}
            <div className="absolute flex flex-col items-center">
              <span className="text-xl font-black text-slate-900">₹{totalSpent.toLocaleString('en-IN')}</span>
              <span className="text-[10px] uppercase font-bold text-slate-600">Total Spent</span>
            </div>
          </div>

          {/* Donut Legend */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs w-full pt-2">
            {Object.entries(categoryTotals).map(([cat, amt]) => {
              const p = totalSpent > 0 ? Math.round((amt / totalSpent) * 100) : 0;
              return (
                <div key={cat} className="flex items-center space-x-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[cat]?.fill || '#94a3b8' }}
                  />
                  <span className="capitalize text-slate-600 truncate">{cat}</span>
                  <span className="text-slate-800 font-semibold ml-auto">{p}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Category Progress Bars */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 font-serif-heading">
            Category Breakdown & Allowances
          </h3>

          <div className="space-y-4">
            {Object.entries(categoryTotals).map(([cat, amt]) => {
              const p = totalSpent > 0 ? Math.round((amt / totalSpent) * 100) : 0;
              const colorInfo = CATEGORY_COLORS[cat] || { bg: 'bg-slate-100', text: 'text-slate-800', fill: '#94a3b8' };

              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="capitalize font-bold text-slate-800 flex items-center space-x-1.5">
                      <span className={`px-2 py-0.5 rounded-md ${colorInfo.bg} ${colorInfo.text} text-[10px]`}>
                        {cat}
                      </span>
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500">{p}% of spent</span>
                      <span className="font-bold text-slate-900">₹{amt.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${p}%`, backgroundColor: colorInfo.fill }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-4">
        {/* Table Filter Tabs */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center space-x-1 overflow-x-auto">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mr-1">
              Category:
            </span>
            {(['all', 'transport', 'stay', 'activities', 'meals', 'miscellaneous'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-colors shrink-0 ${
                  categoryFilter === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredExpenses.length} entries
          </span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No expenses found matching the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Expense Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Paid By</th>
                  <th className="py-3 px-4">Split Details</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map(exp => {
                  const splitsCount = exp.splits?.length || 0;
                  const isSplit = splitsCount > 0;

                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-600">{exp.date}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {exp.title}
                        {exp.notes && (
                          <span className="block text-[10px] font-normal text-slate-500">{exp.notes}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${
                          CATEGORY_COLORS[exp.category]?.bg || 'bg-slate-100'
                        } ${CATEGORY_COLORS[exp.category]?.text || 'text-slate-800'}`}>
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-semibold">
                        {exp.paid_by_user_name || exp.paid_by || 'Alex'}
                      </td>
                      <td className="py-3 px-4">
                        {isSplit ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                            <Users className="w-3 h-3 text-indigo-500" />
                            <span>Split among {splitsCount} members</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Unsplit (Personal)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        ₹{exp.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => openAddModal(exp)}
                            className="p-1 text-slate-400 hover:text-sky-600 rounded cursor-pointer"
                            title="Edit Expense"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Expense Modal with Group Splitting */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="font-bold text-sm text-slate-900 font-serif-heading">
                {expenseToEdit ? 'Edit Expense & Splits' : 'Record & Split Trip Expense'}
              </h3>
              <button
                onClick={() => setShowAddExpenseModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} noValidate className="p-5 space-y-4 overflow-y-auto">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expense Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (e.target.value.trim()) setTitleError(null);
                  }}
                  placeholder="e.g. Group Dinner at Fort Kochi / Train Tickets"
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:outline-none transition-all font-medium ${
                    titleError
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20 text-rose-900 bg-rose-50/20'
                      : 'border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800'
                  }`}
                />
                {titleError && (
                  <p className="text-xs text-rose-600 font-medium mt-1 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{titleError}</span>
                  </p>
                )}
              </div>

              {/* Category & Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold"
                  >
                    <option value="transport">Transport (Flights / Trains)</option>
                    <option value="stay">Stay & Accommodation</option>
                    <option value="activities">Activities & Sightseeing</option>
                    <option value="meals">Meals & Dining</option>
                    <option value="miscellaneous">Miscellaneous / Shopping</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Total Amount (INR - ₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        if (e.target.value && !isNaN(Number(e.target.value)) && Number(e.target.value) > 0) {
                          setAmountError(null);
                        }
                      }}
                      placeholder="2500"
                      className={`w-full pl-6 pr-3 py-2 bg-slate-50 border rounded-xl text-xs focus:outline-none transition-all font-bold ${
                        amountError
                          ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20 text-rose-900 bg-rose-50/20'
                          : 'border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800'
                      }`}
                    />
                  </div>
                  {amountError && (
                    <p className="text-xs text-rose-600 font-medium mt-1 flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{amountError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Date & City/Stop */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      if (e.target.value) setDateError(null);
                    }}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:outline-none transition-all ${
                      dateError
                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20 text-rose-900 bg-rose-50/20'
                        : 'border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800'
                    }`}
                  />
                  {dateError && (
                    <p className="text-xs text-rose-600 font-medium mt-1 flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{dateError}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    City / Stop (Optional)
                  </label>
                  <select
                    value={stopId}
                    onChange={(e) => setStopId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  >
                    <option value="">General / Across Trip</option>
                    {stops.map(s => (
                      <option key={s.id} value={s.id}>{s.city_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Paid By: Trip Member Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Paid By (Who fronted the money?) *
                </label>
                <select
                  value={paidByUserId}
                  onChange={(e) => setPaidByUserId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold"
                >
                  {tripMembers.map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name} {m.user_id === currentUser?.id ? '(You)' : ''} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Group Splitting Section */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Split Among Party Members</span>
                  </span>

                  {/* Split Type Selector */}
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5">
                    <button
                      type="button"
                      onClick={() => setSplitType('equal')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                        splitType === 'equal' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Equal
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitType('exact')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                        splitType === 'exact' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Exact (₹)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitType('percentage')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                        splitType === 'percentage' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      % Percent
                    </button>
                  </div>
                </div>

                {splitError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{splitError}</span>
                  </div>
                )}

                {/* Member Checkbox List with Dynamic Inputs */}
                <div className="space-y-2 pt-1">
                  {tripMembers.map(m => {
                    const isChecked = selectedSplitMemberIds.includes(m.user_id);
                    const calculatedShare = computedShares[m.user_id] || 0;

                    return (
                      <div
                        key={m.user_id}
                        className={`p-2.5 rounded-xl border transition-colors flex items-center justify-between gap-2 ${
                          isChecked ? 'bg-white border-indigo-200' : 'bg-slate-100/50 border-slate-200 opacity-60'
                        }`}
                      >
                        <label className="flex items-center space-x-2.5 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleMember(m.user_id)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 rounded-sm"
                          />
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {m.name}
                          </span>
                        </label>

                        {/* Split values */}
                        {isChecked && (
                          <div className="flex items-center space-x-2 shrink-0">
                            {splitType === 'equal' && (
                              <span className="text-xs font-bold text-slate-700">
                                ₹{calculatedShare.toFixed(2)}
                              </span>
                            )}

                            {splitType === 'exact' && (
                              <div className="relative w-24">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={exactShares[m.user_id] ?? ''}
                                  onChange={(e) => {
                                    setExactShares(prev => ({
                                      ...prev,
                                      [m.user_id]: e.target.value,
                                    }));
                                  }}
                                  placeholder="0.00"
                                  className="w-full pl-5 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-right focus:outline-none"
                                />
                              </div>
                            )}

                            {splitType === 'percentage' && (
                              <div className="flex items-center space-x-1.5">
                                <div className="relative w-16">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={percentageShares[m.user_id] ?? ''}
                                    onChange={(e) => {
                                      setPercentageShares(prev => ({
                                        ...prev,
                                        [m.user_id]: e.target.value,
                                      }));
                                    }}
                                    placeholder="0"
                                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-right focus:outline-none"
                                  />
                                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">%</span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-600 min-w-14 text-right">
                                  ₹{calculatedShare.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Live Split Total Reconciliation */}
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-500">
                    Allocated ({selectedSplitMemberIds.length} members):
                  </span>
                  <span className={`${
                    Math.abs(currentSharesSum - parsedTotalAmount) < 0.01 && parsedTotalAmount > 0
                      ? 'text-emerald-600 font-bold'
                      : 'text-amber-600 font-bold'
                  }`}>
                    ₹{currentSharesSum.toFixed(2)} / ₹{parsedTotalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes / Receipt Info
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Paid online, receipt in group chat"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  {expenseToEdit ? 'Update Expense' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set / Adjust Trip Budget Modal */}
      <SetBudgetModal
        isOpen={showSetBudgetModal}
        onClose={() => setShowSetBudgetModal(false)}
        trip={trip}
        onTripUpdated={onTripUpdated}
      />

      {/* Trip Members Modal */}
      <TripMembersModal
        isOpen={showTripMembersModal}
        onClose={() => setShowTripMembersModal(false)}
        trip={trip}
        currentUser={currentUser || null}
        onTripUpdated={onTripUpdated}
      />
    </div>
  );
};
