import React, { useState } from 'react';
import { Users, X, Copy, Check, UserMinus, LogOut, Shield, Crown, User, Link as LinkIcon, AlertCircle, Loader2 } from 'lucide-react';
import { Trip, TripMember, User as UserType } from '../types/travel';
import { api } from '../lib/api';

interface TripMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  currentUser: UserType | null;
  onTripUpdated: (updatedTrip: Trip) => void;
  onTripLeft?: () => void;
}

export const TripMembersModal: React.FC<TripMembersModalProps> = ({
  isOpen,
  onClose,
  trip,
  currentUser,
  onTripUpdated,
  onTripLeft,
}) => {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const members: TripMember[] = trip.members || [
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

  const isOwner = trip.current_user_role === 'owner' || (currentUser && trip.user_id === currentUser.id);

  const handleGenerateInvite = async () => {
    setGeneratingInvite(true);
    setActionError(null);
    try {
      const res = await api.createTripInvite(trip.id);
      setInviteUrl(res.join_url);
      setInviteCode(res.code);
      navigator.clipboard.writeText(res.join_url);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 3000);
      setSuccessNotice('Invite link generated and copied to clipboard! Valid for 7 days.');
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate invite link');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleCopyExistingInvite = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  const handleRemoveMember = async (memberUserId: number, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this trip?`)) return;
    setRemovingMemberId(memberUserId);
    setActionError(null);
    try {
      const res = await api.removeTripMember(trip.id, memberUserId);
      onTripUpdated(res.trip);
      setSuccessNotice(`${memberName} has been removed from the trip.`);
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleLeaveTrip = async () => {
    if (!currentUser) return;
    if (!confirm(`Are you sure you want to leave "${trip.name}"? You will lose access to its itinerary and shared expenses.`)) return;

    setActionError(null);
    try {
      await api.removeTripMember(trip.id, currentUser.id);
      onClose();
      if (onTripLeft) {
        onTripLeft();
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to leave trip');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 font-serif-heading">
                Trip Travel Party & Members
              </h3>
              <p className="text-[11px] text-slate-500">
                {trip.name} • {members.length} {members.length === 1 ? 'traveler' : 'travelers'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notices */}
        {actionError && (
          <div className="m-4 mb-0 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {successNotice && (
          <div className="m-4 mb-0 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
        )}

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Invite Section (Owner Only) */}
          {isOwner ? (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-50 to-indigo-50/60 border border-sky-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-sky-600" />
                    <span>Invite Co-Travelers</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Share a secure invite link to let friends view, add activities, and split costs.
                  </p>
                </div>
                <button
                  onClick={handleGenerateInvite}
                  disabled={generatingInvite}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer shrink-0"
                >
                  {generatingInvite ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : copiedInvite ? (
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedInvite ? 'Copied!' : 'Copy Invite Link'}</span>
                </button>
              </div>

              {inviteUrl && (
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={inviteUrl}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-sky-200 text-slate-700 text-xs font-mono select-all focus:outline-none"
                  />
                  <button
                    onClick={handleCopyExistingInvite}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-sky-200 text-sky-700 rounded-xl text-xs font-semibold flex items-center space-x-1"
                  >
                    {copiedInvite ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedInvite ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-700">You are a member of this trip</p>
                <p className="text-[11px] text-slate-500">Only the trip owner can create new invite links.</p>
              </div>
              <button
                onClick={handleLeaveTrip}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave Trip</span>
              </button>
            </div>
          )}

          {/* Members List */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
              Current Members ({members.length})
            </h4>

            <div className="space-y-2.5">
              {members.map((m) => {
                const isMemberSelf = currentUser && m.user_id === currentUser.id;
                const isMemberOwner = m.role === 'owner';

                return (
                  <div
                    key={m.user_id}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <img
                        src={m.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80'}
                        alt={m.name}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {m.name}
                          </span>
                          {isMemberSelf && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-semibold">
                              You
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="truncate">{m.email}</span>
                          {m.upi_id && (
                            <>
                              <span>•</span>
                              <span className="text-purple-600 font-mono text-[10px] font-semibold">
                                UPI: {m.upi_id}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {isMemberOwner ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                          <Crown className="w-3 h-3 text-amber-600" />
                          <span>Owner</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold uppercase tracking-wider">
                          <User className="w-3 h-3 text-slate-500" />
                          <span>Member</span>
                        </span>
                      )}

                      {/* Owner can remove non-owner members */}
                      {isOwner && !isMemberOwner && (
                        <button
                          onClick={() => handleRemoveMember(m.user_id, m.name)}
                          disabled={removingMemberId === m.user_id}
                          title="Remove member from trip"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Changes synchronize across all party members automatically.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
