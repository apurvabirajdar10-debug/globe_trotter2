import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { CreateTripModal } from './components/CreateTripModal';
import { AIAssistantModal } from './components/AIAssistantModal';
import { AIOptimizerModal } from './components/AIOptimizerModal';
import { TripChatDrawer } from './components/TripChatDrawer';
import { DashboardView } from './components/DashboardView';
import { TripListView } from './components/TripListView';
import { ItineraryBuilderView } from './components/ItineraryBuilderView';
import { ItineraryDisplayView } from './components/ItineraryDisplayView';
import { CatalogSearchView } from './components/CatalogSearchView';
import { BudgetBreakdownView } from './components/BudgetBreakdownView';
import { PublicTripView } from './components/PublicTripView';
import { UserProfileView } from './components/UserProfileView';
import { LoginPage } from './components/LoginPage';
import { BookingsView } from './components/BookingsView';
import { TripMembersModal } from './components/TripMembersModal';
import { VotingBoardView } from './components/VotingBoardView';
import { OfflineTripModal } from './components/OfflineTripModal';
import { Trip, User } from './types/travel';
import { api, clearAuthToken, setAuthToken } from './lib/api';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { getAllTripSnapshots, getTripSnapshot } from './lib/offlineDb';
import { WifiOff, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [publicTrip, setPublicTrip] = useState<Trip | null>(null);

  // Network and offline synchronization status
  const { isOnline, isSyncing, queuedCount, syncSuccess } = useNetworkStatus(user?.id);

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [createTripModalOpen, setCreateTripModalOpen] = useState(false);
  const [tripToEdit, setTripToEdit] = useState<Trip | null>(null);
  const [aiAssistantModalOpen, setAiAssistantModalOpen] = useState(false);
  const [optimizerModalOpen, setOptimizerModalOpen] = useState(false);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [tripMembersModalOpen, setTripMembersModalOpen] = useState(false);
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [offlineModalTrip, setOfflineModalTrip] = useState<Trip | null>(null);

  // Discovery / Catalog search filter hint
  const [catalogSearchHint, setCatalogSearchHint] = useState<string>('');
  // Destination scope filter: 'national' (India) vs 'international'
  const [destinationScope, setDestinationScope] = useState<'national' | 'international'>('national');

  const [loadingInitial, setLoadingInitial] = useState(true);

  // Initial load
  useEffect(() => {
    async function loadData() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const shareSlug = urlParams.get('share');
        const inviteCode = urlParams.get('invite');

        if (inviteCode) {
          localStorage.setItem('gt_pending_invite', inviteCode.trim());
        }

        if (shareSlug) {
          try {
            const pubRes = await api.getTripBySlug(shareSlug);
            setPublicTrip(pubRes.trip);
            setCurrentTab('public');
          } catch (e) {
            console.warn('Could not load shared trip:', e);
          }
        }

        // Fetch authenticated user
        try {
          const userRes = await api.getCurrentUser();
          setUser(userRes.user);

          // If there is a pending invite code, auto-join now
          const pendingInvite = localStorage.getItem('gt_pending_invite');
          let joinedTripId: number | null = null;
          if (pendingInvite) {
            try {
              const joinRes = await api.joinTripByInvite(pendingInvite);
              localStorage.removeItem('gt_pending_invite');
              window.history.replaceState({}, '', window.location.pathname);
              if (joinRes && joinRes.trip) {
                joinedTripId = joinRes.trip.id;
              }
            } catch (invErr: any) {
              console.warn('Auto-join notice:', invErr.message);
              localStorage.removeItem('gt_pending_invite');
              window.history.replaceState({}, '', window.location.pathname);
            }
          }

          const tripsRes = await api.getTrips();
          setTrips(tripsRes.trips);
          if (tripsRes.trips.length > 0) {
            const targetId = joinedTripId || tripsRes.trips[0].id;
            const fullTripRes = await api.getTrip(targetId);
            setActiveTrip(fullTripRes.trip);
            if (joinedTripId) {
              setCurrentTab('itinerary');
            }
          }
        } catch (e) {
          // If network is down or login expired while offline, inspect IndexedDB snapshots
          try {
            const snapshots = await getAllTripSnapshots();
            if (snapshots.length > 0) {
              const offlineUser: User = {
                id: snapshots[0].trip.user_id || 999,
                name: 'Offline Traveler',
                email: 'offline@device.local',
                currency: 'INR',
                language: 'en',
                saved_destinations: [],
                created_at: new Date().toISOString()
              };
              setUser(offlineUser);
              const offlineTrips = snapshots.map(s => s.trip);
              setTrips(offlineTrips);
              setActiveTrip(offlineTrips[0]);
              setCurrentTab('itinerary');
            } else {
              clearAuthToken();
              setUser(null);
            }
          } catch (offlineErr) {
            clearAuthToken();
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Failed to initialize app data:', err);
      } finally {
        setLoadingInitial(false);
      }
    }

    loadData();
  }, []);

  // Redirect to login whenever an API request returns 401, but allow read-only access while offline
  useEffect(() => {
    const handleUnauthorized = async () => {
      if (!navigator.onLine) {
        try {
          const snapshots = await getAllTripSnapshots();
          if (snapshots.length > 0) return; // Keep offline read-only session
        } catch (e) {
          // Continue with logout
        }
      }
      setUser(null);
      setTrips([]);
      setActiveTrip(null);
    };
    window.addEventListener('gt:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('gt:unauthorized', handleUnauthorized);
  }, []);

  const handleSelectTrip = async (trip: Trip | null, targetTab?: string) => {
    if (!trip) {
      setActiveTrip(null);
      return;
    }
    try {
      const fullRes = await api.getTrip(trip.id);
      setActiveTrip(fullRes.trip);
      if (targetTab) {
        setCurrentTab(targetTab);
      }
    } catch (err) {
      // Offline fallback: load from IndexedDB snapshot
      try {
        const snap = await getTripSnapshot(trip.id);
        if (snap) {
          setActiveTrip(snap.trip);
        } else {
          setActiveTrip(trip);
        }
      } catch (e) {
        setActiveTrip(trip);
      }
      if (targetTab) setCurrentTab(targetTab);
    }
  };

  const handleTripUpdated = (updatedTrip: Trip) => {
    setActiveTrip(updatedTrip);
    setTrips(prev => prev.map(t => (t.id === updatedTrip.id ? updatedTrip : t)));
  };

  const handleTripCreated = (newTrip: Trip) => {
    setTrips(prev => [newTrip, ...prev]);
    setActiveTrip(newTrip);
    setCurrentTab('builder');
  };

  const handleTripDeleted = (deletedId: number) => {
    setTrips(prev => prev.filter(t => t.id !== deletedId));
    if (activeTrip?.id === deletedId) {
      const remaining = trips.filter(t => t.id !== deletedId);
      setActiveTrip(remaining[0] || null);
    }
  };

  const handleTripDuplicated = (clonedTrip: Trip) => {
    setTrips(prev => [clonedTrip, ...prev]);
    setActiveTrip(clonedTrip);
    setCurrentTab('builder');
  };

  const handleViewPublicSlug = async (slug: string) => {
    try {
      const res = await api.getTripBySlug(slug);
      setPublicTrip(res.trip);
      setCurrentTab('public');
    } catch (err: any) {
      alert(err.message || 'Could not find public trip');
    }
  };

  const handleExploreDestination = (cityName: string = '', scopeHint?: 'national' | 'international') => {
    if (scopeHint) {
      setDestinationScope(scopeHint);
    }
    setCatalogSearchHint(cityName);
    setCurrentTab('search');
  };

  const handleLogout = () => {
    clearAuthToken();
    setUser(null);
    setCurrentTab('dashboard');
  };

  const handleAuthSuccess = async (authUser: User) => {
    setUser(authUser);
    try {
      const pendingInvite = localStorage.getItem('gt_pending_invite');
      let joinedTripId: number | null = null;

      if (pendingInvite) {
        try {
          const joinRes = await api.joinTripByInvite(pendingInvite);
          localStorage.removeItem('gt_pending_invite');
          window.history.replaceState({}, '', window.location.pathname);
          if (joinRes && joinRes.trip) {
            joinedTripId = joinRes.trip.id;
          }
        } catch (invErr: any) {
          console.warn('Post-login auto-join notice:', invErr.message);
          localStorage.removeItem('gt_pending_invite');
          window.history.replaceState({}, '', window.location.pathname);
        }
      }

      const tripsRes = await api.getTrips();
      setTrips(tripsRes.trips);
      if (tripsRes.trips.length > 0) {
        const targetId = joinedTripId || tripsRes.trips[0].id;
        const fullTripRes = await api.getTrip(targetId);
        setActiveTrip(fullTripRes.trip);
        setCurrentTab(joinedTripId ? 'itinerary' : 'dashboard');
      } else {
        setCurrentTab('dashboard');
      }
    } catch (err) {
      console.error('Failed to load trips for authenticated user:', err);
      setCurrentTab('dashboard');
    }
  };

  // 5-second polling to refresh trip and group member changes while a trip is active
  useEffect(() => {
    if (!user || !activeTrip || !navigator.onLine) return;

    const intervalId = setInterval(async () => {
      try {
        if (!navigator.onLine) return;
        const refreshed = await api.getTrip(activeTrip.id);
        if (refreshed && refreshed.trip) {
          setActiveTrip(refreshed.trip);
          setTrips(prev => prev.map(t => (t.id === refreshed.trip.id ? refreshed.trip : t)));
        }
      } catch (e) {
        // Suppress background poll errors
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [user, activeTrip?.id]);

  if (loadingInitial) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 space-y-4">
        <div className="w-12 h-12 border-3 border-sky-600/20 border-t-sky-600 rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-base font-bold text-slate-800 font-serif-heading">Globe Trotter</p>
          <p className="text-xs text-slate-500">Connecting to relational database & travel routes...</p>
        </div>
      </div>
    );
  }

  // Primary entry point: if user is not logged in and not viewing a public shared itinerary
  if (!user && currentTab !== 'public') {
    return (
      <LoginPage
        onAuthSuccess={handleAuthSuccess}
        onContinueAsGuest={() => {
          setUser({
            id: 1,
            name: 'Demo Traveler',
            email: 'traveler@globetrotter.io',
            currency: 'INR',
            language: 'en',
            saved_destinations: [],
            created_at: new Date().toISOString()
          });
          setCurrentTab('dashboard');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
        onOpenCreateTrip={() => {
          setTripToEdit(null);
          setCreateTripModalOpen(true);
        }}
        onOpenAIAssistant={() => setAiAssistantModalOpen(true)}
        activeTrip={activeTrip}
        onSelectTrip={(t) => handleSelectTrip(t)}
        allTrips={trips}
        scope={destinationScope}
        onScopeChange={setDestinationScope}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* VIEW 1: DASHBOARD */}
        {currentTab === 'dashboard' && (
          <DashboardView
            user={user}
            trips={trips}
            activeScope={destinationScope}
            onScopeChange={setDestinationScope}
            onOpenCreateTrip={() => {
              setTripToEdit(null);
              setCreateTripModalOpen(true);
            }}
            onOpenAIAssistant={() => setAiAssistantModalOpen(true)}
            onSelectTrip={(t, tab) => handleSelectTrip(t, tab)}
            onExploreDestination={handleExploreDestination}
          />
        )}

        {/* VIEW 2: MY TRIPS LIST */}
        {currentTab === 'trips' && (
          <TripListView
            trips={trips}
            onSelectTrip={(t, tab) => handleSelectTrip(t, tab)}
            onOpenCreateTrip={() => {
              setTripToEdit(null);
              setCreateTripModalOpen(true);
            }}
            onEditTrip={(t) => {
              setTripToEdit(t);
              setCreateTripModalOpen(true);
            }}
            onOpenAIAssistant={() => setAiAssistantModalOpen(true)}
            onTripDeleted={handleTripDeleted}
            onTripDuplicated={handleTripDuplicated}
            onViewPublic={handleViewPublicSlug}
          />
        )}

        {/* VIEW 3: ITINERARY BUILDER (STOPS & ACTIVITIES) */}
        {currentTab === 'builder' && (
          activeTrip ? (
            <ItineraryBuilderView
              trip={activeTrip}
              onTripUpdated={handleTripUpdated}
              onOpenOptimizer={() => setOptimizerModalOpen(true)}
              onViewItinerary={() => setCurrentTab('itinerary')}
              onOpenCatalogSearch={handleExploreDestination}
              onOpenMembers={() => setTripMembersModalOpen(true)}
            />
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-3">
              <p className="text-sm font-semibold text-slate-700">No trip selected</p>
              <button
                onClick={() => {
                  setTripToEdit(null);
                  setCreateTripModalOpen(true);
                }}
                className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-semibold"
              >
                Create a Trip First
              </button>
            </div>
          )
        )}

        {/* VIEW 4: ITINERARY VIEW & CALENDAR */}
        {currentTab === 'itinerary' && (
          activeTrip ? (
            <ItineraryDisplayView
              trip={activeTrip}
              onTripUpdated={handleTripUpdated}
              onOpenOptimizer={() => setOptimizerModalOpen(true)}
              onOpenBuilder={() => setCurrentTab('builder')}
              onOpenChat={() => setChatDrawerOpen(true)}
              onOpenMembers={() => setTripMembersModalOpen(true)}
            />
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-3">
              <p className="text-sm font-semibold text-slate-700">No active trip selected</p>
              <button
                onClick={() => setCurrentTab('trips')}
                className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-semibold"
              >
                Go to My Trips
              </button>
            </div>
          )
        )}

        {/* VIEW 5: CITY & ACTIVITY SEARCH */}
        {currentTab === 'search' && (
          <CatalogSearchView
            trips={trips}
            onActivityAddedToTrip={handleTripUpdated}
            initialQuery={catalogSearchHint}
            initialScope={destinationScope}
            onScopeChange={setDestinationScope}
            onOpenCreateTrip={() => {
              setTripToEdit(null);
              setCreateTripModalOpen(true);
            }}
          />
        )}

        {/* VIEW 6: BUDGET & COST BREAKDOWN */}
        {currentTab === 'budget' && (
          activeTrip ? (
            <BudgetBreakdownView
              trip={activeTrip}
              currentUser={user}
              onTripUpdated={handleTripUpdated}
              onOpenMembersModal={() => setTripMembersModalOpen(true)}
            />
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Please select a trip to view its budget breakdown.</p>
              <button
                onClick={() => setCurrentTab('trips')}
                className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-semibold"
              >
                Go to My Trips
              </button>
            </div>
          )
        )}

        {/* VIEW 7: PUBLIC SHARED TRIP VIEW */}
        {currentTab === 'public' && publicTrip && (
          <PublicTripView
            trip={publicTrip}
            onCopySuccess={(cloned) => {
              setTrips(prev => [cloned, ...prev]);
              setActiveTrip(cloned);
              setCurrentTab('builder');
            }}
            onBackToApp={() => setCurrentTab('dashboard')}
          />
        )}

        {/* VIEW 8: USER PROFILE & SETTINGS */}
        {currentTab === 'profile' && user && (
          <UserProfileView
            user={user}
            trips={trips}
            onUserUpdated={setUser}
            onLogout={handleLogout}
            onExploreDestination={handleExploreDestination}
          />
        )}

        {/* VIEW 9: BOOKINGS CONCIERGE (TRANSIT, STAYS & ATTRACTIONS) */}
        {currentTab === 'bookings' && (
          <BookingsView
            trips={trips}
            activeTrip={activeTrip}
            onSelectTrip={(t) => handleSelectTrip(t)}
            onTripUpdated={handleTripUpdated}
          />
        )}
      </main>

      {/* Floating Conversational Trip Assistant */}
      <TripChatDrawer
        trip={activeTrip}
        isOpen={chatDrawerOpen}
        onToggle={() => setChatDrawerOpen(!chatDrawerOpen)}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Create / Edit Trip Modal */}
      <CreateTripModal
        isOpen={createTripModalOpen}
        onClose={() => {
          setCreateTripModalOpen(false);
          setTripToEdit(null);
        }}
        onTripCreated={handleTripCreated}
        tripToEdit={tripToEdit}
      />

      {/* AI Travel Assistant Generator Modal */}
      <AIAssistantModal
        isOpen={aiAssistantModalOpen}
        onClose={() => setAiAssistantModalOpen(false)}
        initialScope={destinationScope}
        onTripSaved={(savedTrip) => {
          setTrips(prev => [savedTrip, ...prev]);
          setActiveTrip(savedTrip);
          setCurrentTab('builder');
        }}
      />

      {/* AI Itinerary Optimizer Modal */}
      {optimizerModalOpen && activeTrip && (
        <AIOptimizerModal
          isOpen={optimizerModalOpen}
          onClose={() => setOptimizerModalOpen(false)}
          trip={activeTrip}
        />
      )}

      {/* Trip Members & Invite Modal */}
      {tripMembersModalOpen && activeTrip && (
        <TripMembersModal
          isOpen={tripMembersModalOpen}
          onClose={() => setTripMembersModalOpen(false)}
          trip={activeTrip}
          currentUser={user}
          onTripUpdated={handleTripUpdated}
          onTripLeft={() => {
            handleTripDeleted(activeTrip.id);
            setCurrentTab('dashboard');
          }}
        />
      )}
    </div>
  );
}
