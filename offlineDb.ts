import { Trip, Stop, Activity, Expense, Booking, Proposal, TripMember } from '../types/travel';

export interface TripSnapshot {
  trip_id: number;
  trip: Trip;
  stops: Stop[];
  activities: Activity[];
  expenses: Expense[];
  bookings: Booking[];
  members: TripMember[];
  proposals: Proposal[];
  packing_list: PackingItem[];
  safety_info: SafetyAdvisory[];
  updated_at: string;
  size_bytes: number;
}

export interface PackingItem {
  id: string;
  trip_id: number;
  name: string;
  category: string;
  packed: boolean;
  notes?: string;
  updated_at: number;
}

export interface SafetyAdvisory {
  city: string;
  country: string;
  emergency_number: string;
  hospital_contact: string;
  embassy_helpline: string;
  local_tips: string[];
}

export interface QueuedOfflineAction {
  id?: number;
  type: 'ADD_EXPENSE' | 'TOGGLE_PACKING';
  trip_id: number;
  payload: any;
  created_at: number;
}

const DB_NAME = 'globetrotter_offline_store';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'trip_id' });
      }
      if (!db.objectStoreNames.contains('offline_queue')) {
        db.createObjectStore('offline_queue', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('packing_items')) {
        const packingStore = db.createObjectStore('packing_items', { keyPath: 'id' });
        packingStore.createIndex('trip_id', 'trip_id', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

// Generate rich default packing items for a trip
export function getDefaultPackingList(trip: Trip): PackingItem[] {
  const destList = trip.stops?.map(s => s.city_name).join(', ') || 'Global';
  return [
    { id: `pk-${trip.id}-1`, trip_id: trip.id, name: 'Passport, Visas & Physical ID Photocopies', category: 'Documents', packed: true, updated_at: Date.now() },
    { id: `pk-${trip.id}-2`, trip_id: trip.id, name: 'International Travel Adapter & Multi-Pin Plug', category: 'Electronics', packed: true, updated_at: Date.now() },
    { id: `pk-${trip.id}-3`, trip_id: trip.id, name: 'Printed IRCTC ERS / Flight Boarding Passes', category: 'Documents', packed: false, updated_at: Date.now() },
    { id: `pk-${trip.id}-4`, trip_id: trip.id, name: 'First Aid Kit (Antihistamines, ORS Electrolytes, Pain Relief)', category: 'Health', packed: false, updated_at: Date.now() },
    { id: `pk-${trip.id}-5`, trip_id: trip.id, name: 'High-Capacity Power Bank (10,000mAh+)', category: 'Electronics', packed: false, updated_at: Date.now() },
    { id: `pk-${trip.id}-6`, trip_id: trip.id, name: 'Comfortable Walking Shoes for City Explorations', category: 'Clothing', packed: false, updated_at: Date.now() },
    { id: `pk-${trip.id}-7`, trip_id: trip.id, name: 'UPI-enabled Phone with Offline Payment Backup', category: 'Finance', packed: true, updated_at: Date.now() },
    { id: `pk-${trip.id}-8`, trip_id: trip.id, name: `Weather-Appropriate Clothing for ${destList}`, category: 'Clothing', packed: false, updated_at: Date.now() },
  ];
}

// Generate safety info for stops
export function getDefaultSafetyInfo(trip: Trip): SafetyAdvisory[] {
  const stops = trip.stops || [];
  if (stops.length === 0) {
    return [
      {
        city: 'Destination',
        country: 'India',
        emergency_number: '112 (National Emergency)',
        hospital_contact: 'Local Emergency Medical Services: 102 / 108',
        embassy_helpline: '+91 11 2419 8000',
        local_tips: [
          'Keep copies of travel documents in cloud and on your phone.',
          'Save local police helpline numbers before transit.',
          'Stay hydrated and keep an emergency cash reserve.'
        ]
      }
    ];
  }

  return stops.map(s => ({
    city: s.city_name,
    country: s.country,
    emergency_number: s.country.toLowerCase() === 'india' ? '112 (National Emergency), 100 (Police)' : '112 (European Emergency) / 911',
    hospital_contact: s.country.toLowerCase() === 'india' ? 'Ambulance: 108, Tourist Helpline: 1363' : 'Central Medical Response: 112',
    embassy_helpline: 'Emergency Traveler Liaison: +91 11 2419 8000',
    local_tips: [
      `Keep physical and offline address cards of your hotel in ${s.city_name}.`,
      'Pre-download offline city maps and Google Maps offline area before departure.',
      'Only use verified prepaid taxi hubs or ride-hailing services from transit stations.'
    ]
  }));
}

export async function saveTripSnapshot(
  tripId: number,
  data: {
    trip: Trip;
    stops: Stop[];
    activities: Activity[];
    expenses: Expense[];
    bookings: Booking[];
    members: TripMember[];
    proposals: Proposal[];
    packing_list?: PackingItem[];
    safety_info?: SafetyAdvisory[];
  },
  onProgress?: (percent: number, stepText: string) => void
): Promise<TripSnapshot> {
  const db = await getDb();

  if (onProgress) onProgress(15, 'Packaging itinerary, stops, and schedules...');
  await new Promise(r => setTimeout(r, 60));

  if (onProgress) onProgress(40, 'Compiling expenses, split balances, and settlements...');
  await new Promise(r => setTimeout(r, 60));

  if (onProgress) onProgress(65, 'Gathering confirmed e-tickets, bookings, and voting proposals...');
  await new Promise(r => setTimeout(r, 60));

  const packingList = data.packing_list || getDefaultPackingList(data.trip);
  const safetyInfo = data.safety_info || getDefaultSafetyInfo(data.trip);

  if (onProgress) onProgress(85, 'Calculating snapshot bundle and saving to IndexedDB...');

  // Compute snapshot data & rough size in bytes
  const serialized = JSON.stringify({
    trip: data.trip,
    stops: data.stops,
    activities: data.activities,
    expenses: data.expenses,
    bookings: data.bookings,
    members: data.members,
    proposals: data.proposals,
    packing_list: packingList,
    safety_info: safetyInfo,
  });

  const sizeBytes = new Blob([serialized]).size;
  const snapshot: TripSnapshot = {
    trip_id: tripId,
    trip: data.trip,
    stops: data.stops,
    activities: data.activities,
    expenses: data.expenses,
    bookings: data.bookings,
    members: data.members,
    proposals: data.proposals,
    packing_list: packingList,
    safety_info: safetyInfo,
    updated_at: new Date().toISOString(),
    size_bytes: sizeBytes,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['snapshots', 'packing_items'], 'readwrite');
    const snapshotStore = tx.objectStore('snapshots');
    const packingStore = tx.objectStore('packing_items');

    snapshotStore.put(snapshot);

    for (const item of packingList) {
      packingStore.put(item);
    }

    tx.oncomplete = () => {
      if (onProgress) onProgress(100, 'Offline snapshot saved successfully!');
      resolve(snapshot);
    };

    tx.onerror = () => {
      reject(tx.error);
    };
  });
}

export async function getTripSnapshot(tripId: number): Promise<TripSnapshot | null> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readonly');
      const store = tx.objectStore('snapshots');
      const req = store.get(tripId);

      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => {
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('Error reading snapshot from IndexedDB:', err);
    return null;
  }
}

export async function getAllTripSnapshots(): Promise<TripSnapshot[]> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readonly');
      const store = tx.objectStore('snapshots');
      const req = store.getAll();

      req.onsuccess = () => {
        resolve(req.result || []);
      };
      req.onerror = () => {
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('Error getting all snapshots from IndexedDB:', err);
    return [];
  }
}

export async function deleteTripSnapshot(tripId: number): Promise<boolean> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['snapshots', 'packing_items'], 'readwrite');
    const snapStore = tx.objectStore('snapshots');
    const packingStore = tx.objectStore('packing_items');

    snapStore.delete(tripId);

    // Delete packing items for this trip
    const index = packingStore.index('trip_id');
    const req = index.openCursor(IDBKeyRange.only(tripId));

    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// Offline queue management
export async function queueOfflineAction(action: Omit<QueuedOfflineAction, 'id'>): Promise<number> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_queue', 'readwrite');
    const store = tx.objectStore('offline_queue');
    const req = store.add(action);

    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getQueuedOfflineActions(): Promise<QueuedOfflineAction[]> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_queue', 'readonly');
      const store = tx.objectStore('offline_queue');
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return [];
  }
}

export async function clearQueuedOfflineAction(id: number): Promise<boolean> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_queue', 'readwrite');
    const store = tx.objectStore('offline_queue');
    const req = store.delete(id);

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getTripPackingItems(tripId: number): Promise<PackingItem[]> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('packing_items', 'readonly');
      const store = tx.objectStore('packing_items');
      const index = store.index('trip_id');
      const req = index.getAll(IDBKeyRange.only(tripId));

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return [];
  }
}

export async function togglePackingItem(item: PackingItem): Promise<PackingItem> {
  const db = await getDb();
  const updated = { ...item, packed: !item.packed, updated_at: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('packing_items', 'readwrite');
    const store = tx.objectStore('packing_items');
    const req = store.put(updated);

    req.onsuccess = () => resolve(updated);
    req.onerror = () => reject(req.error);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
