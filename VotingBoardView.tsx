import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Vote as VoteIcon,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Plus,
  Clock,
  Calendar,
  MapPin,
  IndianRupee,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Sparkles,
  Award,
  Users,
  Timer,
  ChevronRight,
  Edit2,
  Trash2,
  Check,
  X,
  RefreshCw,
  Compass,
  ArrowRight
} from 'lucide-react';
import { Trip, Proposal, Vote, User, Stop, CatalogItem } from '../types/travel';
import { api } from '../lib/api';

interface VotingBoardViewProps {
  trip: Trip;
  currentUser: User | null;
  onTripUpdated?: (trip: Trip) => void;
  onOpenMembers?: () => void;
}

export const VotingBoardView: React.FC<VotingBoardViewProps> = ({
  trip,
  currentUser,
  onTripUpdated,
  onOpenMembers,
}) => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'accepted' | 'rejected'>('open');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Propose modal states
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);

  // Proposal form fields
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('sightseeing');
  const [costPerPerson, setCostPerPerson] = useState<number>(500);
  const [notes, setNotes] = useState('');
  const [stopId, setStopId] = useState<number | ''>('');
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Owner close voting modal states
  const [isCloseVotingModalOpen, setIsCloseVotingModalOpen] = useState(false);
  const [targetStopId, setTargetStopId] = useState<number>(trip.stops?.[0]?.id || 0);
  const [targetDate, setTargetDate] = useState<string>(trip.stops?.[0]?.start_date || trip.start_date);
  const [targetTimeSlot, setTargetTimeSlot] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [selectedWinnerIds, setSelectedWinnerIds] = useState<number[]>([]);
  const [isClosingVoting, setIsClosingVoting] = useState(false);

  // Owner deadline setting modal
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
  const [globalDeadline, setGlobalDeadline] = useState<string>('');

  // Catalog search state
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const isOwner = trip.current_user_role === 'owner' || trip.user_id === currentUser?.id;
  const memberCount = Math.max(1, trip.members?.length || 1);
  const budgetRemaining = Math.max(0, (trip.budget_total || 0) - (trip.total_spent || 0));

  const fetchProposals = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await api.getProposals(trip.id);
      setProposals(res.proposals || []);
    } catch (err) {
      console.warn('Failed to fetch proposals:', err);
    } finally {
      setLoading(false);
      if (!silent) setIsRefreshing(false);
    }
  };

  // 1. Initial load
  useEffect(() => {
    fetchProposals(false);
  }, [trip.id]);

  // 2. 5-Second polling interval for live real-time group voting updates
  useEffect(() => {
    const timer = setInterval(() => {
      fetchProposals(true);
    }, 5000);

    return () => clearInterval(timer);
  }, [trip.id]);

  // Catalog search
  useEffect(() => {
    if (!isCatalogModalOpen) return;
    const delayDebounce = setTimeout(async () => {
      setLoadingCatalog(true);
      try {
        const dest = trip.stops?.[0]?.city_name || '';
        const res = await api.searchCatalog({
          query: catalogQuery || dest,
        });
        setCatalogItems(res.items || []);
      } catch (err) {
        console.warn('Catalog search error:', err);
      } finally {
        setLoadingCatalog(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [catalogQuery, isCatalogModalOpen, trip.stops]);

  const handleOpenCreateModal = () => {
    setEditingProposal(null);
    setTitle('');
    setLocation('');
    setCategory('sightseeing');
    setCostPerPerson(500);
    setNotes('');
    setStopId(trip.stops?.[0]?.id || '');
    setDeadline('');
    setIsProposeModalOpen(true);
  };

  const handleOpenEditModal = (p: Proposal) => {
    setEditingProposal(p);
    setTitle(p.title);
    setLocation(p.location || '');
    setCategory(p.category || 'sightseeing');
    setCostPerPerson(p.cost_per_person || 0);
    setNotes(p.notes || '');
    setStopId(p.stop_id || '');
    setDeadline(p.deadline ? p.deadline.substring(0, 16) : '');
    setIsProposeModalOpen(true);
  };

  const handleSaveProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingProposal) {
        // Check if votes exist
        const hasVotes = (editingProposal.votes?.length || 0) > 0;
        let confirmReset = false;
        if (hasVotes) {
          const proceed = window.confirm(
            `This proposal already has ${editingProposal.votes?.length} active votes. Editing it will reset all cast votes so the group can revote. Do you wish to continue?`
          );
          if (!proceed) {
            setIsSubmitting(false);
            return;
          }
          confirmReset = true;
        }

        await api.updateProposal(
          editingProposal.id,
          {
            title: title.trim(),
            location: location.trim(),
            category,
            cost_per_person: costPerPerson,
            notes: notes.trim(),
            stop_id: stopId || null,
            deadline: deadline || null,
          },
          confirmReset
        );
      } else {
        await api.createProposal(trip.id, {
          title: title.trim(),
          location: location.trim(),
          category,
          cost_per_person: costPerPerson,
          notes: notes.trim(),
          stop_id: stopId || null,
          deadline: deadline || null,
        });
      }

      setIsProposeModalOpen(false);
      fetchProposals(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save proposal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProposal = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this proposal?')) return;
    try {
      await api.deleteProposal(id);
      setProposals(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete proposal');
    }
  };

  const handleVote = async (proposalId: number, choice: 'yes' | 'no' | 'maybe') => {
    try {
      // Optimistic update
      setProposals(prev =>
        prev.map(p => {
          if (p.id !== proposalId) return p;
          const oldVote = p.current_user_vote;
          let y = p.yes_count || 0;
          let n = p.no_count || 0;
          let m = p.maybe_count || 0;

          if (oldVote === 'yes') y = Math.max(0, y - 1);
          if (oldVote === 'no') n = Math.max(0, n - 1);
          if (oldVote === 'maybe') m = Math.max(0, m - 1);

          if (choice === 'yes') y++;
          if (choice === 'no') n++;
          if (choice === 'maybe') m++;

          return {
            ...p,
            current_user_vote: choice,
            yes_count: y,
            no_count: n,
            maybe_count: m,
            total_voters: y + n + m,
            net_score: y - n,
          };
        })
      );

      await api.castVote(proposalId, choice);
      fetchProposals(true);
    } catch (err: any) {
      alert(err.message || 'Could not record vote');
      fetchProposals(false);
    }
  };

  // Close Voting and Add Winners logic
  const handleOpenCloseVotingModal = () => {
    const openProposals = proposals.filter(p => p.status === 'open');
    if (openProposals.length === 0) {
      alert('There are no open proposals available to close.');
      return;
    }

    // Sort proposals by net score (yes - no) descending
    const sorted = [...openProposals].sort((a, b) => (b.net_score || 0) - (a.net_score || 0));

    // Pre-select top proposals with net_score > 0
    const topScore = sorted[0]?.net_score || 0;
    const defaultWinners = sorted.filter(p => (p.net_score || 0) > 0).map(p => p.id);

    setSelectedWinnerIds(defaultWinners.length > 0 ? defaultWinners : [sorted[0].id]);
    setTargetStopId(trip.stops?.[0]?.id || 0);
    setTargetDate(trip.stops?.[0]?.start_date || trip.start_date);
    setTargetTimeSlot('morning');
    setIsCloseVotingModalOpen(true);
  };

  const handleConfirmCloseVoting = async () => {
    if (!targetStopId || !targetDate) {
      alert('Please select a destination stop and schedule date.');
      return;
    }
    if (selectedWinnerIds.length === 0) {
      alert('Please select at least one winning proposal to add to the itinerary.');
      return;
    }

    setIsClosingVoting(true);
    try {
      const res = await api.closeVoting(trip.id, {
        target_stop_id: targetStopId,
        target_date: targetDate,
        target_time_slot: targetTimeSlot,
        winner_proposal_ids: selectedWinnerIds,
      });

      if (onTripUpdated && res.trip) {
        onTripUpdated(res.trip);
      }
      setIsCloseVotingModalOpen(false);
      fetchProposals(false);
      alert(res.message || 'Winning proposals added to your itinerary schedule!');
    } catch (err: any) {
      alert(err.message || 'Failed to close voting');
    } finally {
      setIsClosingVoting(false);
    }
  };

  const handleSetGlobalDeadline = async () => {
    try {
      await api.setProposalDeadline(trip.id, globalDeadline || null);
      setIsDeadlineModalOpen(false);
      fetchProposals(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update deadline');
    }
  };

  const handleSelectFromCatalog = (item: CatalogItem) => {
    setTitle(item.title);
    setLocation(`${item.city_name}, ${item.country}`);
    setCategory(item.category || 'sightseeing');
    setCostPerPerson(item.cost || 500);
    setNotes(item.description || '');
    setIsCatalogModalOpen(false);
    setIsProposeModalOpen(true);
  };

  // Filtered proposals
  const filteredProposals = useMemo(() => {
    return proposals.filter(p => {
      if (filterStatus === 'all') return true;
      return p.status === filterStatus;
    });
  }, [proposals, filterStatus]);

  // Check for ties in top rankings
  const openProposalsSorted = useMemo(() => {
    return proposals
      .filter(p => p.status === 'open')
      .sort((a, b) => (b.net_score || 0) - (a.net_score || 0));
  }, [proposals]);

  const hasTopTie = useMemo(() => {
    if (openProposalsSorted.length < 2) return false;
    const topScore = openProposalsSorted[0].net_score || 0;
    const secondScore = openProposalsSorted[1].net_score || 0;
    return topScore === secondScore;
  }, [openProposalsSorted]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-400/30">
              <VoteIcon className="w-3.5 h-3.5" />
              <span>Collaborative Itinerary Decision Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-serif-heading tracking-tight text-white">
              Group Voting Board
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Every trip member can propose activities, cast live Yes/No/Maybe votes, monitor budget impact, and shape the journey together. Top-voted winners are scheduled directly into your stops.
            </p>
          </div>

          {/* Quick Metrics Badge */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 shrink-0 min-w-[240px] space-y-2">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-300 font-bold">
              <span>Trip Decision Hub</span>
              <span className="flex items-center space-x-1 text-emerald-400 text-[10px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live 5s Sync</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Group Members</span>
                <span className="font-bold text-white text-sm">{memberCount} travelers</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Budget Available</span>
                <span className="font-bold text-emerald-400 text-sm">₹{budgetRemaining.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filters */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterStatus('open')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'open'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Open Proposals ({proposals.filter(p => p.status === 'open').length})
          </button>
          <button
            onClick={() => setFilterStatus('accepted')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'accepted'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Accepted Winners ({proposals.filter(p => p.status === 'accepted').length})
          </button>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({proposals.length})
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Propose from Catalog */}
          <button
            onClick={() => {
              setCatalogQuery('');
              setIsCatalogModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 shadow-2xs flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Propose from Catalog</span>
          </button>

          {/* New Custom Proposal */}
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Propose Activity</span>
          </button>

          {/* Owner Controls */}
          {isOwner && (
            <>
              <button
                onClick={() => setIsDeadlineModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 flex items-center space-x-1 transition-all cursor-pointer"
                title="Set or update voting deadline for open proposals"
              >
                <Timer className="w-3.5 h-3.5 text-slate-500" />
                <span>Deadline</span>
              </button>

              <button
                onClick={handleOpenCloseVotingModal}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Close Voting & Add Winners</span>
              </button>
            </>
          )}

          <button
            onClick={() => fetchProposals(false)}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Refresh votes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tie Banner for Owner */}
      {isOwner && hasTopTie && filterStatus === 'open' && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-center justify-between text-xs text-amber-900 shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-extrabold">Tie Detected in Top-Voted Activities!</p>
              <p className="text-amber-700 text-[11px]">
                Multiple proposals currently share the highest score. Use "Close Voting & Add Winners" to choose which ones to accept.
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenCloseVotingModal}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shrink-0 cursor-pointer text-xs"
          >
            Resolve Tie →
          </button>
        </div>
      )}

      {/* Proposals Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3 bg-white rounded-3xl border border-slate-200">
          <div className="w-10 h-10 border-3 border-sky-600/20 border-t-sky-600 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-semibold">Loading live proposals & cast tallies...</p>
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="py-16 text-center space-y-4 bg-white rounded-3xl border border-dashed border-slate-300 p-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <VoteIcon className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">No proposals found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Be the first to pitch a museum tour, sunset cruise, cooking class, or historic walk to your fellow travelers!
            </p>
          </div>
          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              onClick={() => setIsCatalogModalOpen(true)}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
            >
              Browse Global Catalog
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 cursor-pointer"
            >
              Propose New Activity
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredProposals.map((proposal) => {
            const totalGroupCost = (proposal.cost_per_person || 0) * memberCount;
            const remainingAfterProposal = budgetRemaining - totalGroupCost;
            const isDeadlinePassed = proposal.deadline && new Date(proposal.deadline).getTime() < Date.now();
            const voters = proposal.votes || [];
            const voterIds = new Set(voters.map(v => v.user_id));
            const nonVoterCount = Math.max(0, memberCount - voterIds.size);

            const totalVotes = proposal.total_voters || 0;
            const yesPct = totalVotes > 0 ? Math.round(((proposal.yes_count || 0) / totalVotes) * 100) : 0;
            const noPct = totalVotes > 0 ? Math.round(((proposal.no_count || 0) / totalVotes) * 100) : 0;
            const maybePct = totalVotes > 0 ? Math.round(((proposal.maybe_count || 0) / totalVotes) * 100) : 0;

            const canEditOrDelete = isOwner || proposal.created_by === currentUser?.id;

            return (
              <div
                key={proposal.id}
                className={`bg-white rounded-3xl border transition-all p-5 sm:p-6 flex flex-col justify-between shadow-2xs relative overflow-hidden ${
                  proposal.status === 'accepted'
                    ? 'border-emerald-300 ring-2 ring-emerald-500/10'
                    : proposal.status === 'rejected'
                    ? 'border-slate-200 opacity-70 bg-slate-50/50'
                    : 'border-slate-200/90 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                {/* Status banner ribbon */}
                {proposal.status !== 'open' && (
                  <div className={`text-[10px] uppercase tracking-wider font-extrabold px-3 py-1 rounded-full w-fit mb-3 flex items-center space-x-1 ${
                    proposal.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {proposal.status === 'accepted' ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Accepted Winner & Scheduled</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 text-slate-500" />
                        <span>Voting Closed</span>
                      </>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  {/* Top Creator and Tag Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      {proposal.creator_photo ? (
                        <img src={proposal.creator_photo} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                          {proposal.creator_name?.[0] || 'U'}
                        </div>
                      )}
                      <div>
                        <span className="text-[11px] font-bold text-slate-800 block leading-tight">
                          {proposal.creator_name || 'Trip Member'}
                        </span>
                        <span className="text-[10px] text-slate-600">Proposed an experience</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wide">
                        {proposal.category}
                      </span>
                      {canEditOrDelete && proposal.status === 'open' && (
                        <div className="flex items-center space-x-1 ml-1">
                          <button
                            onClick={() => handleOpenEditModal(proposal)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 cursor-pointer"
                            title="Edit proposal (will reset votes with warning)"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteProposal(proposal.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 cursor-pointer"
                            title="Delete proposal"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Location */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {proposal.title}
                    </h3>
                    {proposal.location && (
                      <p className="text-xs text-slate-500 flex items-center space-x-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{proposal.location}</span>
                      </p>
                    )}
                  </div>

                  {proposal.notes && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      "{proposal.notes}"
                    </p>
                  )}

                  {/* Per-Person Cost and Budget Impact */}
                  <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-sky-800 block">Cost Per Person</span>
                      <span className="text-sm font-extrabold text-slate-900">
                        ₹{(proposal.cost_per_person || 0).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-600 block">
                        +₹{totalGroupCost.toLocaleString('en-IN')} total ({memberCount} travelers)
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-sky-800 block">Budget Impact</span>
                      <span className={`text-sm font-extrabold ${remainingAfterProposal >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        ₹{Math.max(0, remainingAfterProposal).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-600 block">
                        remaining in trip pool
                      </span>
                    </div>
                  </div>

                  {/* Deadline Notice */}
                  {proposal.deadline && (
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-slate-600 flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>Deadline: {new Date(proposal.deadline).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                      {isDeadlinePassed ? (
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-extrabold text-[10px]">
                          Deadline Passed
                        </span>
                      ) : (
                        <span className="text-indigo-600 font-semibold text-[10px]">
                          Voting Active
                        </span>
                      )}
                    </div>
                  )}

                  {/* Live Tally Bars */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Live Tally</span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        Net Score: <strong className={proposal.net_score! > 0 ? 'text-emerald-600' : proposal.net_score! < 0 ? 'text-rose-600' : 'text-slate-700'}>
                          {proposal.net_score! > 0 ? `+${proposal.net_score}` : proposal.net_score}
                        </strong> ({proposal.total_voters || 0} cast)
                      </span>
                    </div>

                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${yesPct}%` }}
                        className="bg-emerald-500 h-full transition-all duration-300"
                        title={`Yes: ${proposal.yes_count || 0} (${yesPct}%)`}
                      />
                      <div
                        style={{ width: `${maybePct}%` }}
                        className="bg-amber-400 h-full transition-all duration-300"
                        title={`Maybe: ${proposal.maybe_count || 0} (${maybePct}%)`}
                      />
                      <div
                        style={{ width: `${noPct}%` }}
                        className="bg-rose-400 h-full transition-all duration-300"
                        title={`No: ${proposal.no_count || 0} (${noPct}%)`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                      <span className="text-emerald-700 font-bold">Yes: {proposal.yes_count || 0}</span>
                      <span className="text-amber-700 font-bold">Maybe: {proposal.maybe_count || 0}</span>
                      <span className="text-rose-700 font-bold">No: {proposal.no_count || 0}</span>
                    </div>
                  </div>

                  {/* Voter Breakdown Avatars */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">Who Voted</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {voters.map((v) => (
                        <div
                          key={v.id}
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            v.choice === 'yes'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : v.choice === 'no'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          <span>{v.user_name || 'Member'}</span>
                          <span className="uppercase text-[9px] font-black">
                            {v.choice === 'yes' ? '✓' : v.choice === 'no' ? '✕' : '?'}
                          </span>
                        </div>
                      ))}
                      {nonVoterCount > 0 && (
                        <span className="text-[10px] text-slate-600 italic">
                          ({nonVoterCount} {nonVoterCount === 1 ? 'member' : 'members'} pending)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Vote Action Buttons */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold text-slate-700">
                    {proposal.current_user_vote ? (
                      <span>Your vote: <strong className="capitalize text-indigo-700">{proposal.current_user_vote}</strong></span>
                    ) : (
                      <span className="text-slate-600">Cast your choice:</span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      disabled={proposal.status !== 'open' || !!isDeadlinePassed}
                      onClick={() => handleVote(proposal.id, 'yes')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                        proposal.current_user_vote === 'yes'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      } ${proposal.status !== 'open' || isDeadlinePassed ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>Yes</span>
                    </button>

                    <button
                      disabled={proposal.status !== 'open' || !!isDeadlinePassed}
                      onClick={() => handleVote(proposal.id, 'maybe')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                        proposal.current_user_vote === 'maybe'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                      } ${proposal.status !== 'open' || isDeadlinePassed ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>Maybe</span>
                    </button>

                    <button
                      disabled={proposal.status !== 'open' || !!isDeadlinePassed}
                      onClick={() => handleVote(proposal.id, 'no')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                        proposal.current_user_vote === 'no'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                      } ${proposal.status !== 'open' || isDeadlinePassed ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <ThumbsDown className="w-3 h-3" />
                      <span>No</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          PROPOSE / EDIT ACTIVITY MODAL
          ========================================================================= */}
      {isProposeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400 block">
                  Group Voting Proposal
                </span>
                <h3 className="text-lg font-bold">
                  {editingProposal ? 'Edit Activity Proposal' : 'Pitch a New Activity'}
                </h3>
              </div>
              <button
                onClick={() => setIsProposeModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProposal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Activity Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Sunrise Boat Ride on the Ganges"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-sky-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Location / Venue</label>
                  <input
                    type="text"
                    placeholder="e.g., Dashashwamedh Ghat"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                  >
                    <option value="sightseeing">Sightseeing</option>
                    <option value="food">Food & Dining</option>
                    <option value="culture">Culture & Heritage</option>
                    <option value="adventure">Adventure & Outdoors</option>
                    <option value="relaxation">Relaxation & Spa</option>
                    <option value="shopping">Shopping</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Cost Per Person (₹ INR)</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={costPerPerson}
                    onChange={(e) => setCostPerPerson(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-600 mt-0.5 block">
                    Total: ₹{((costPerPerson || 0) * memberCount).toLocaleString('en-IN')} for {memberCount} members
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Associate with Stop</label>
                  <select
                    value={stopId}
                    onChange={(e) => setStopId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                  >
                    <option value="">Any Stop / General</option>
                    {trip.stops?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.city_name} ({s.start_date})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Voting Deadline (Optional)</label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Why should we do this? (Pitch & Notes)</label>
                <textarea
                  rows={2}
                  placeholder="Share details, why it's worth visiting, reviews, or recommended timing..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 resize-none"
                />
              </div>

              {editingProposal && (editingProposal.votes?.length || 0) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px]">
                    <strong>Notice:</strong> This proposal has existing votes. Saving edits will reset all votes to keep the decision fair for everyone.
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsProposeModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {isSubmitting ? 'Submitting...' : editingProposal ? 'Update & Reset Votes' : 'Publish Proposal →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          PROPOSE FROM CATALOG SEARCH MODAL
          ========================================================================= */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400 block">
                  Global Sightseeing Catalog
                </span>
                <h3 className="text-lg font-bold">Pick an Activity to Propose to the Group</h3>
              </div>
              <button
                onClick={() => setIsCatalogModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search popular sights, temple walks, museums, food trails..."
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-sky-600"
                />
              </div>
            </div>

            {/* Catalog Items List */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {loadingCatalog ? (
                <div className="py-12 text-center text-xs text-slate-500 font-semibold">
                  Searching destination catalog...
                </div>
              ) : catalogItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 font-semibold">
                  No catalog items found. Try a different city or term.
                </div>
              ) : (
                catalogItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase">
                          {item.city_name}, {item.country}
                        </span>
                        <span className="text-[10px] text-slate-600 uppercase font-bold">
                          {item.category}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                      <p className="text-xs text-slate-500 line-clamp-1">{item.description}</p>
                      <div className="text-xs text-slate-700 font-bold">
                        ₹{item.cost.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-slate-500">/ person</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelectFromCatalog(item)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer shadow-xs"
                    >
                      Propose This →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          OWNER CLOSE VOTING & ADD WINNERS MODAL
          ========================================================================= */}
      {isCloseVotingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block">
                  Trip Owner Action
                </span>
                <h3 className="text-lg font-bold">Close Voting & Schedule Winning Activities</h3>
              </div>
              <button
                onClick={() => setIsCloseVotingModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {hasTopTie && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 flex items-start space-x-2 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Tie Detected:</span> Multiple top proposals have equal net scores. Please check or uncheck which specific activities you wish to schedule into the itinerary.
                  </div>
                </div>
              )}

              {/* Proposals Ranked List */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-900">
                  Select Winning Proposals to Schedule (Ranked by Yes - No Score)
                </label>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {openProposalsSorted.map((p, idx) => {
                    const isChecked = selectedWinnerIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-emerald-50/70 border-emerald-300'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedWinnerIds(prev => [...prev, p.id]);
                              } else {
                                setSelectedWinnerIds(prev => prev.filter(id => id !== p.id));
                              }
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-extrabold text-slate-900">#{idx + 1} {p.title}</span>
                              {idx === 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-black uppercase">
                                  Top Pick
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500">
                              ₹{(p.cost_per_person || 0).toLocaleString('en-IN')}/person • Proposed by {p.creator_name}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`text-xs font-black block ${p.net_score! > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                            Score: {p.net_score! > 0 ? `+${p.net_score}` : p.net_score}
                          </span>
                          <span className="text-[10px] text-slate-600">
                            {p.yes_count || 0} Yes • {p.no_count || 0} No
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Destination stop and slot selection */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-[11px] font-bold text-slate-800 block">
                  Schedule Details for Selected Activities
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Destination Stop</label>
                    <select
                      value={targetStopId}
                      onChange={(e) => {
                        const sId = Number(e.target.value);
                        setTargetStopId(sId);
                        const s = trip.stops?.find(stop => stop.id === sId);
                        if (s) setTargetDate(s.start_date);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                    >
                      {trip.stops?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.city_name} ({s.start_date})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Scheduled Date</label>
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Time Slot</label>
                    <select
                      value={targetTimeSlot}
                      onChange={(e) => setTargetTimeSlot(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                    >
                      <option value="morning">Morning Slot</option>
                      <option value="afternoon">Afternoon Slot</option>
                      <option value="evening">Evening Slot</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <span className="text-xs text-slate-500">
                {selectedWinnerIds.length} activities will be added to your schedule.
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setIsCloseVotingModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={isClosingVoting || selectedWinnerIds.length === 0}
                  onClick={handleConfirmCloseVoting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
                >
                  {isClosingVoting ? 'Scheduling...' : 'Confirm & Add Winners →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          OWNER DEADLINE SETTER MODAL
          ========================================================================= */}
      {isDeadlineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-indigo-600 block">Owner Control</span>
              <h3 className="text-base font-bold text-slate-900">Set Group Voting Deadline</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Apply a cutoff date and time for all open proposals so travelers vote on time.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Cutoff Date & Time</label>
              <input
                type="datetime-local"
                value={globalDeadline}
                onChange={(e) => setGlobalDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsDeadlineModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSetGlobalDeadline}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                Apply Deadline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
