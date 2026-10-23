import React, { useState, useEffect } from 'react';
import {
  Download,
  Trash2,
  HardDrive,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  ShieldCheck,
  CheckSquare,
  Square,
  Plus,
  RefreshCw,
  Phone,
  MapPin,
  IndianRupee,
  Luggage,
  Sparkles
} from 'lucide-react';
import { Trip, Expense, Stop } from '../types/travel';
import {
  saveTripSnapshot,
  getTripSnapshot,
  deleteTripSnapshot,
  TripSnapshot,
  PackingItem,
  getTripPackingItems,
  togglePackingItem,
  queueOfflineAction,
  formatBytes,
  getDefaultPackingList,
  getDefaultSafetyInfo
} from '../lib/offlineDb';
import { api } from '../lib/api';

interface OfflineTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  isOnline: boolean;
  onSnapshotSaved?: () => void;
  onTripUpdated?: (trip: Trip) => void;
}

export const OfflineTripModal: React.FC<OfflineTripModalProps> = ({
  isOpen,
  onClose,
  trip,
  isOnline,
  onSnapshotSaved,
  onTripUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'download' | 'packing' | 'safety' | 'add-expense'>('download');
  const [snapshot, setSnapshot] = useState<TripSnapshot | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStepText, setDownloadStepText] = useState('');
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Packing list state
  const [packingItems, setPackingItems] = useState<PackingItem[]>([]);
  const [newPackingName, setNewPackingName] = useState('');
  const [newPackingCategory, setNewPackingCategory] = useState('Essentials');

  // Offline expense form
  const [offlineExpenseTitle, setOfflineExpenseTitle] = useState('');
  const [offlineExpenseAmount, setOfflineExpenseAmount] = useState<number>(250);
  const [offlineExpenseCategory, setOfflineExpenseCategory] = useState<'transport' | 'stay' | 'activities' | 'meals' | 'miscellaneous'>('meals');
  const [offlineExpenseNotes, setOfflineExpenseNotes] = useState('');
  const [offlineExpenseSuccess, setOfflineExpenseSuccess] = useState(false);

  // Storage estimation
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null);

  const loadExistingSnapshot = async () => {
    try {
      const snap = await getTripSnapshot(trip.id);
      setSnapshot(snap);
      if (snap) {
        const items = await getTripPackingItems(trip.id);
        setPackingItems(items.length > 0 ? items : snap.packing_list || getDefaultPackingList(trip));
      } else {
        setPackingItems(getDefaultPackingList(trip));
      }
    } catch (e) {
      console.warn('Could not read snapshot from IndexedDB:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadExistingSnapshot();
      if (typeof navigator !== 'undefined' && 'storage' in navigator && navigator.storage.estimate) {
        navigator.storage.estimate().then(est => {
          setStorageEstimate({ usage: est.usage || 0, quota: est.quota || 0 });
        }).catch(() => {});
      }
    }
  }, [isOpen, trip.id]);

  if (!isOpen) return null;

  const handleDownloadOffline = async () => {
    setIsDownloading(true);
    setDownloadProgress(5);
    setDownloadStepText('Connecting to local and server resources...');
    setDownloadError(null);

    try {
      // 1. Fetch full fresh trip data if online, else use current trip
      let fullTrip = trip;
      let tripBookings: any[] = [];
      let tripProposals: any[] = [];

      if (isOnline) {
        try {
          const fresh = await api.getTrip(trip.id);
          fullTrip = fresh.trip;
        } catch (e) {
          // Fallback to active trip state
        }
        try {
          const bRes = await api.getBookings(trip.id);
          tripBookings = bRes.bookings || [];
        } catch (e) {
          // Ignore
        }
        try {
          const pRes = await api.getProposals(trip.id);
          tripProposals = pRes.proposals || [];
        } catch (e) {
          // Ignore
        }
      }

      // Check quota
      if (storageEstimate && storageEstimate.quota > 0 && storageEstimate.usage / storageEstimate.quota > 0.95) {
        setDownloadError('Storage quota warning: Device storage is almost full. Snapshot will proceed with essential records.');
      }

      const savedSnapshot = await saveTripSnapshot(
        trip.id,
        {
          trip: fullTrip,
          stops: fullTrip.stops || [],
          activities: fullTrip.stops?.flatMap(s => s.activities || []) || [],
          expenses: fullTrip.expenses || [],
          bookings: tripBookings,
          members: fullTrip.members || [],
          proposals: tripProposals,
          packing_list: packingItems.length > 0 ? packingItems : getDefaultPackingList(fullTrip),
          safety_info: getDefaultSafetyInfo(fullTrip),
        },
        (pct, step) => {
          setDownloadProgress(pct);
          setDownloadStepText(step);
        }
      );

      setSnapshot(savedSnapshot);
      if (onSnapshotSaved) onSnapshotSaved();
    } catch (err: any) {
      setDownloadError(err.message || 'Download was interrupted. Please retry.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRemoveOfflineData = async () => {
    if (!window.confirm('Remove saved offline data for this trip from this device?')) return;
    try {
      await deleteTripSnapshot(trip.id);
      setSnapshot(null);
      alert('Offline snapshot removed from device storage.');
    } catch (err: any) {
      alert('Failed to delete offline snapshot: ' + err.message);
    }
  };

  const handleTogglePacking = async (item: PackingItem) => {
    try {
      const updated = await togglePackingItem(item);
      setPackingItems(prev => prev.map(p => p.id === item.id ? updated : p));

      // Queue offline sync action
      await queueOfflineAction({
        type: 'TOGGLE_PACKING',
        trip_id: trip.id,
        payload: { itemId: item.id, packed: updated.packed },
        created_at: Date.now(),
      });
    } catch (e) {
      console.warn('Packing toggle error:', e);
    }
  };

  const handleAddCustomPackingItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPackingName.trim()) return;
    const newItem: PackingItem = {
      id: `pk-custom-${Date.now()}`,
      trip_id: trip.id,
      name: newPackingName.trim(),
      category: newPackingCategory,
      packed: false,
      updated_at: Date.now(),
    };
    setPackingItems(prev => [newItem, ...prev]);
    setNewPackingName('');
  };

  const handleAddOfflineExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offlineExpenseTitle.trim() || !offlineExpenseAmount) return;

    const payload = {
      title: offlineExpenseTitle.trim(),
      amount: Number(offlineExpenseAmount),
      category: offlineExpenseCategory,
      currency: 'INR',
      date: new Date().toISOString().split('T')[0],
      notes: offlineExpenseNotes ? `${offlineExpenseNotes.trim()} (Recorded Offline)` : 'Recorded in Offline Mode',
    };

    try {
      if (isOnline) {
        // Direct save if online
        await api.addExpense(trip.id, payload);
        const fresh = await api.getTrip(trip.id);
        if (onTripUpdated) onTripUpdated(fresh.trip);
      } else {
        // Queue in IndexedDB for automatic last-write-wins sync
        await queueOfflineAction({
          type: 'ADD_EXPENSE',
          trip_id: trip.id,
          payload,
          created_at: Date.now(),
        });
      }

      setOfflineExpenseSuccess(true);
      setOfflineExpenseTitle('');
      setOfflineExpenseNotes('');
      setTimeout(() => setOfflineExpenseSuccess(false), 3000);
    } catch (err: any) {
      alert('Failed to record expense: ' + err.message);
    }
  };

  const safetyList = snapshot?.safety_info || getDefaultSafetyInfo(trip);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-400/30">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300 block">
                Offline PWA Storage Hub
              </span>
              <h3 className="text-lg font-extrabold font-serif-heading">
                {trip.name} Offline Companion
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('download')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'download'
                ? 'border-sky-600 text-sky-700 bg-white/60'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Snapshot & Storage
          </button>
          <button
            onClick={() => setActiveTab('packing')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1 ${
              activeTab === 'packing'
                ? 'border-sky-600 text-sky-700 bg-white/60'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Luggage className="w-3.5 h-3.5" />
            <span>Packing Checklist ({packingItems.filter(p => p.packed).length}/{packingItems.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('safety')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1 ${
              activeTab === 'safety'
                ? 'border-sky-600 text-sky-700 bg-white/60'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Emergency & Addresses</span>
          </button>
          <button
            onClick={() => setActiveTab('add-expense')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1 ${
              activeTab === 'add-expense'
                ? 'border-sky-600 text-sky-700 bg-white/60'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Expense (Offline)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* TAB 1: DOWNLOAD & STORAGE */}
          {activeTab === 'download' && (
            <div className="space-y-5">
              <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl flex items-start space-x-3">
                <HardDrive className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-extrabold text-sky-950 text-sm block">
                    Zero-Network Travel Readiness
                  </span>
                  <p className="text-slate-600 leading-relaxed">
                    Downloads all stops, scheduled activities, budget tallies, confirmed e-tickets, member split records, and emergency guides into local IndexedDB storage. Fully accessible anywhere without mobile network or airport Wi-Fi.
                  </p>
                </div>
              </div>

              {/* Snapshot Status Card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">IndexedDB Snapshot Status</span>
                  {snapshot ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ready for Offline Use</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                      Not Downloaded Yet
                    </span>
                  )}
                </div>

                {snapshot && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Snapshot Size</span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {formatBytes(snapshot.size_bytes)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Last Updated</span>
                      <span className="font-bold text-slate-900">
                        {new Date(snapshot.updated_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Data Captured</span>
                      <span className="font-bold text-slate-700">
                        {snapshot.stops?.length || 0} cities • {snapshot.activities?.length || 0} activities
                      </span>
                    </div>
                  </div>
                )}

                {/* Download Progress Bar */}
                {isDownloading && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs font-bold text-sky-800">
                      <span>{downloadStepText}</span>
                      <span>{downloadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-sky-600 h-full rounded-full transition-all duration-200"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {downloadError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{downloadError}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    disabled={isDownloading}
                    onClick={handleDownloadOffline}
                    className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{snapshot ? 'Update / Refresh Snapshot' : 'Download for Offline'}</span>
                  </button>

                  {snapshot && (
                    <button
                      onClick={handleRemoveOfflineData}
                      className="px-4 py-2 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Remove Offline Data</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PACKING CHECKLIST (WORKS OFFLINE & ONLINE) */}
          {activeTab === 'packing' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Trip Packing Checklist</h4>
                  <p className="text-slate-500 text-[11px]">
                    Tick items as you pack. Operates seamlessly offline and auto-syncs when online.
                  </p>
                </div>
                <span className="text-xs font-extrabold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
                  {packingItems.filter(p => p.packed).length} of {packingItems.length} packed
                </span>
              </div>

              {/* Add Custom Packing Item */}
              <form onSubmit={handleAddCustomPackingItem} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add custom packing item..."
                  value={newPackingName}
                  onChange={(e) => setNewPackingName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-sky-600"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
                >
                  Add
                </button>
              </form>

              {/* Packing list items */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {packingItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleTogglePacking(item)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      item.packed
                        ? 'bg-emerald-50/50 border-emerald-200 text-slate-500'
                        : 'bg-white border-slate-200 text-slate-900 hover:border-sky-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-emerald-600">
                        {item.packed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <span className={`text-xs font-semibold ${item.packed ? 'line-through text-slate-400' : ''}`}>
                        {item.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {item.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SAFETY ADVISORIES & ADDRESSES */}
          {activeTab === 'safety' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Emergency Numbers & Place Addresses</h4>
                <p className="text-slate-500 text-[11px]">
                  Direct contacts and verified place addresses with external Google Maps navigation links (map tiles are never cached offline).
                </p>
              </div>

              <div className="space-y-3">
                {safetyList.map((safe, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-sky-600" />
                        <span className="font-extrabold text-slate-900 text-sm">
                          {safe.city}, {safe.country}
                        </span>
                      </div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${safe.city}, ${safe.country}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-700 hover:text-sky-900 font-bold flex items-center space-x-1 text-[11px]"
                      >
                        <span>Open in Google Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center space-x-2">
                        <Phone className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Emergency Services</span>
                          <span className="font-bold text-slate-900">{safe.emergency_number}</span>
                        </div>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center space-x-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Hospital & Medical</span>
                          <span className="font-bold text-slate-900">{safe.hospital_contact}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Traveler Guidance</span>
                      {safe.local_tips.map((tip, tIdx) => (
                        <p key={tIdx} className="text-slate-600 text-[11px] flex items-center space-x-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block shrink-0" />
                          <span>{tip}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: QUICK OFFLINE EXPENSE RECORDER */}
          {activeTab === 'add-expense' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start space-x-3">
                <IndianRupee className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-emerald-950 text-sm block">Record Expense While Offline</span>
                  <p className="text-slate-600 text-xs mt-0.5">
                    No signal required. Expenses logged offline are stored in IndexedDB and automatically synchronized with the server when network connectivity is reestablished.
                  </p>
                </div>
              </div>

              {offlineExpenseSuccess && (
                <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Expense recorded and queued for synchronization!</span>
                </div>
              )}

              <form onSubmit={handleAddOfflineExpense} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Expense Title / Merchant</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tuk-tuk to Ganges Ghat or Street Food Dinner"
                    value={offlineExpenseTitle}
                    onChange={(e) => setOfflineExpenseTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Amount (₹ INR)</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={offlineExpenseAmount}
                      onChange={(e) => setOfflineExpenseAmount(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Category</label>
                    <select
                      value={offlineExpenseCategory}
                      onChange={(e) => setOfflineExpenseCategory(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                    >
                      <option value="meals">Meals & Food</option>
                      <option value="transport">Local Transit & Taxis</option>
                      <option value="stay">Stays & Lodging</option>
                      <option value="activities">Attractions & Entry</option>
                      <option value="miscellaneous">Miscellaneous</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="Paid cash, street stall, or split with companions..."
                    value={offlineExpenseNotes}
                    onChange={(e) => setOfflineExpenseNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Queue & Save Expense</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            {isOnline ? 'Online mode active' : 'Device is offline'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
