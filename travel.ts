export interface User {
  id: number;
  name: string;
  email: string;
  photo_url?: string;
  language: string;
  currency: string;
  saved_destinations: string[]; // array of destination names or IDs
  upi_id?: string;
  created_at: string;
}

export interface TripMember {
  trip_id: number;
  user_id: number;
  role: 'owner' | 'member';
  joined_at: string;
  name: string;
  email: string;
  photo_url?: string;
  upi_id?: string;
}

export interface ExpenseSplit {
  user_id: number;
  share_amount: number;
  user_name?: string;
}

export interface Settlement {
  id: number;
  trip_id: number;
  from_user_id: number;
  to_user_id: number;
  amount: number;
  created_at: string;
  from_user_name?: string;
  to_user_name?: string;
  to_user_upi_id?: string;
}

export interface Activity {
  id: number;
  stop_id: number;
  trip_id: number;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time_slot: 'morning' | 'afternoon' | 'evening';
  cost: number;
  category: 'sightseeing' | 'food' | 'culture' | 'adventure' | 'relaxation' | 'shopping' | 'transport';
  duration_hours: number;
  location?: string;
  booking_status: 'planned' | 'booked' | 'optional';
  order_index: number;
  created_at?: string;
}

export interface Stop {
  id: number;
  trip_id: number;
  city_name: string;
  country: string;
  order_index: number;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  transport_mode: 'flight' | 'train' | 'car' | 'bus' | 'ferry' | 'none';
  transport_notes?: string;
  notes?: string;
  created_at?: string;
  activities?: Activity[];
}

export interface Expense {
  id: number;
  trip_id: number;
  stop_id?: number | null;
  title: string;
  category: 'transport' | 'stay' | 'activities' | 'meals' | 'miscellaneous';
  amount: number;
  currency: string;
  date: string; // YYYY-MM-DD
  paid_by?: string;
  paid_by_user_id?: number | null;
  paid_by_user_name?: string;
  notes?: string;
  splits?: ExpenseSplit[];
  created_at?: string;
}

export interface Trip {
  id: number;
  user_id: number;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  description?: string;
  cover_image: string;
  budget_total: number;
  is_public: boolean;
  public_slug: string;
  created_at?: string;
  updated_at?: string;
  stops?: Stop[];
  expenses?: Expense[];
  members?: TripMember[];
  settlements?: Settlement[];
  current_user_role?: 'owner' | 'member';
  // Aggregated summary fields
  total_spent?: number;
  destinations_count?: number;
  user_name?: string;
}

export interface CatalogItem {
  id: string;
  city_name: string;
  country: string;
  title: string;
  description: string;
  category: 'sightseeing' | 'food' | 'culture' | 'adventure' | 'relaxation';
  cost: number;
  cost_index: 'budget' | 'moderate' | 'luxury'; // $, $$, $$$
  duration_hours: number;
  popularity: number; // 1-100
  image_url: string;
  recommended_time: 'morning' | 'afternoon' | 'evening';
}

export interface OptimizationSuggestion {
  category: 'sequence' | 'budget' | 'pacing' | 'logistics';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable_tip?: string;
}

export interface OptimizationResult {
  score: number; // 0 - 100
  summary: string;
  suggestions: OptimizationSuggestion[];
  savings_potential?: number;
}

export interface AIItineraryPlan {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  estimated_budget: number;
  cover_image?: string;
  stops: {
    city_name: string;
    country: string;
    start_date: string;
    end_date: string;
    transport_mode: 'flight' | 'train' | 'car' | 'bus' | 'ferry' | 'none';
    transport_notes?: string;
    activities: {
      title: string;
      description: string;
      date: string;
      time_slot: 'morning' | 'afternoon' | 'evening';
      category: 'sightseeing' | 'food' | 'culture' | 'adventure' | 'relaxation' | 'shopping' | 'transport';
      cost: number;
      duration_hours: number;
      location?: string;
    }[];
  }[];
}

export interface Vote {
  id: number;
  proposal_id: number;
  user_id: number;
  choice: 'yes' | 'no' | 'maybe';
  created_at: string;
  user_name?: string;
  user_photo?: string;
}

export interface Proposal {
  id: number;
  trip_id: number;
  stop_id?: number | null;
  title: string;
  location?: string;
  category: string;
  cost_per_person: number;
  notes?: string;
  created_by: number;
  creator_name?: string;
  creator_photo?: string;
  status: 'open' | 'accepted' | 'rejected';
  deadline?: string | null;
  created_at: string;
  updated_at: string;
  votes?: Vote[];
  yes_count?: number;
  no_count?: number;
  maybe_count?: number;
  net_score?: number; // yes minus no
  current_user_vote?: 'yes' | 'no' | 'maybe' | null;
  total_voters?: number;
}

export interface Booking {
  id: number | string;
  trip_id: number | null;
  stop_id?: number | null;
  type: 'flight' | 'train' | 'bus' | 'stay' | 'cab' | 'vehicle' | 'activity' | 'attraction';
  provider: string;
  reference_number: string;
  pnr_number?: string;
  origin?: string;
  destination: string;
  start_datetime: string;
  end_datetime?: string;
  passengers?: string;
  amount: number;
  currency: string;
  source: 'mock' | 'imported';
  status: 'Confirmed' | 'Completed' | 'Pending';
  category_label?: string;
  details?: Record<string, string>;
  qr_data?: string;
  notes?: string;
  expense_id?: number | null;
  created_at?: string;
}

export interface ExtractedBookingField<T> {
  value: T;
  confidence: number; // 0 to 1
}

export interface ExtractedBookingItem {
  type: ExtractedBookingField<'flight' | 'train' | 'bus' | 'stay' | 'cab' | 'activity'>;
  provider: ExtractedBookingField<string>;
  reference_number: ExtractedBookingField<string>;
  origin: ExtractedBookingField<string>;
  destination: ExtractedBookingField<string>;
  start_datetime: ExtractedBookingField<string>;
  end_datetime: ExtractedBookingField<string>;
  passenger_names: ExtractedBookingField<string[]>;
  amount: ExtractedBookingField<number>;
  currency: ExtractedBookingField<string>;
  notes?: ExtractedBookingField<string>;
}
