import React, { useState, useMemo, useEffect } from 'react';
import {
  Train,
  Bus,
  Plane,
  Car,
  Hotel,
  Ticket,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  Star,
  Users,
  CreditCard,
  Luggage,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  Compass,
  AlertTriangle,
  QrCode,
  Download,
  Share2,
  Check,
  Landmark,
  Building2,
  Trees,
  FerrisWheel,
  Bike,
  Phone,
  Mail,
  Award,
  Info,
  RefreshCw,
  Zap,
  Fuel,
  Gauge,
  SlidersHorizontal,
  Upload,
  FileText,
  FileUp,
} from 'lucide-react';
import { Trip, Activity, Stop } from '../types/travel';
import { api } from '../lib/api';
import {
  IRCTCClassOption,
  IRCTCTrain,
  IRCTC_STATIONS,
  findStationForCity,
  generateIRCTCTrains,
  FlightFareTier,
  FlightRouteOption,
  generateFlightRoutes,
  BusClassOption,
  BusRouteOption,
  generateBusRoutes,
  RegionalVehicle,
  getRegionalVehicles
} from '../data/bookingData';

interface BookingsViewProps {
  trips: Trip[];
  activeTrip: Trip | null;
  onSelectTrip: (trip: Trip) => void;
  onTripUpdated?: (trip: Trip) => void;
}

export interface ConfirmedBooking {
  id: string;
  type: 'train' | 'bus' | 'flight' | 'vehicle' | 'stay' | 'attraction';
  title: string;
  subtitle: string;
  bookingRef: string;
  pnrNumber?: string;
  travelDate: string;
  origin?: string;
  destination: string;
  amount: number;
  passengersOrGuests: string;
  status: 'Confirmed' | 'Completed';
  categoryLabel: string;
  details: Record<string, string>;
  qrData?: string;
}

export const BookingsView: React.FC<BookingsViewProps> = ({
  trips,
  activeTrip,
  onSelectTrip,
  onTripUpdated,
}) => {
  // Main Subsections: 'travel' | 'stay' | 'attractions' | 'my-bookings'
  const [activeSubSection, setActiveSubSection] = useState<'travel' | 'stay' | 'attractions' | 'my-bookings'>('travel');

  // Travelling sub-tabs: 'train' | 'flight' | 'bus' | 'vehicle'
  const [travelTab, setTravelTab] = useState<'train' | 'flight' | 'bus' | 'vehicle'>('train');

  // Vehicle sub-toggle: 'all' | 'cars' | 'bikes'
  const [vehicleCategoryFilter, setVehicleCategoryFilter] = useState<'all' | 'cars' | 'bikes'>('all');

  // Confirmed bookings archive
  const [confirmedBookings, setConfirmedBookings] = useState<ConfirmedBooking[]>([
    {
      id: 'BK-1049',
      type: 'train',
      title: '22436 / NEW DELHI - VARANASI VANDE BHARAT EXP',
      subtitle: 'Coach C2, Seat 18 (Window Seat) • Exec. Chair Car (EC)',
      bookingRef: 'IRCTC-948201',
      pnrNumber: '245-8910472',
      travelDate: '2026-06-12',
      origin: 'New Delhi (NDLS)',
      destination: 'Varanasi Jn (BSB)',
      amount: 2365,
      passengersOrGuests: '1 Adult (Alex Morgan, 32M)',
      status: 'Confirmed',
      categoryLabel: 'IRCTC Indian Railways',
      details: {
        'PNR No': '245-8910472',
        'Train No & Name': '22436 / VANDE BHARAT EXP',
        'Coach / Seat': 'C2 / 18 (Window Seat)',
        'Quota': 'General (GN)',
        'Food Choice': 'Vegetarian Meal Included',
        'Insurance': 'Opted (Policy #IR-991204)'
      },
      qrData: 'IRCTC-PNR:2458910472|22436|C2-18|CONFIRMED'
    },
    {
      id: 'BK-1050',
      type: 'attraction',
      title: 'The Louvre Museum: Timed-Entry & Mona Lisa Priority Ticket',
      subtitle: 'Pyramid Fast-Track Entrance • 10:00 AM Slot',
      bookingRef: 'LVR-773910',
      travelDate: '2026-06-11',
      destination: 'Paris',
      amount: 2975,
      passengersOrGuests: '2 Adults',
      status: 'Confirmed',
      categoryLabel: 'Museum Entry',
      details: { 'Time Slot': '10:00 AM', 'Entry Gate': 'Pyramid Main', 'Audio Guide': 'Included' }
    }
  ]);

  // Modal states for reservation flow
  const [activeReservationModal, setActiveReservationModal] = useState<any | null>(null);
  const [activeTicketVoucher, setActiveTicketVoucher] = useState<ConfirmedBooking | null>(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [addToTripExpensesChecked, setAddToTripExpensesChecked] = useState(true);

  // Database persistence state
  const [loadingDbBookings, setLoadingDbBookings] = useState(false);

  // Import Booking AI Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<'text' | 'file'>('text');
  const [pastedText, setPastedText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; base64: string; mimeType: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractedReviewList, setExtractedReviewList] = useState<any[]>([]);
  const [importLinkedExpense, setImportLinkedExpense] = useState(true);
  const [isSavingImport, setIsSavingImport] = useState(false);

  // Fetch persisted bookings from SQLite database
  const loadBookingsFromDatabase = async () => {
    try {
      setLoadingDbBookings(true);
      const res = await api.getBookings(activeTrip?.id);
      if (res.bookings && res.bookings.length > 0) {
        const mapped: ConfirmedBooking[] = res.bookings.map((b) => ({
          id: String(b.id),
          type: (b.type as any) || 'train',
          title: `${b.provider}: ${b.origin ? `${b.origin} ➔ ` : ''}${b.destination}`,
          subtitle: `${b.passengers || '1 Traveler'} • ${b.type.toUpperCase()}`,
          bookingRef: b.reference_number,
          pnrNumber: b.pnr_number || b.reference_number,
          travelDate: b.start_datetime ? b.start_datetime.split('T')[0].split(' ')[0] : '2026-06-12',
          origin: b.origin,
          destination: b.destination,
          amount: b.amount,
          passengersOrGuests: b.passengers || '1 Traveler',
          status: (b.status as any) || 'Confirmed',
          categoryLabel: b.category_label || b.provider,
          details: b.details || {},
          qrData: b.qr_data || `GT-CONFIRMED|${b.reference_number}|${b.amount}|${b.destination}`
        }));
        setConfirmedBookings(mapped);
      }
    } catch (err) {
      console.warn('Failed to load bookings from database:', err);
    } finally {
      setLoadingDbBookings(false);
    }
  };

  useEffect(() => {
    loadBookingsFromDatabase();
  }, [activeTrip?.id]);

  // Expanded card state for in-depth IRCTC / Flight / Bus details
  const [expandedTrainId, setExpandedTrainId] = useState<string | null>(null);
  const [selectedTrainClass, setSelectedTrainClass] = useState<{ [trainId: string]: IRCTCClassOption }>({});
  const [selectedFlightTier, setSelectedFlightTier] = useState<{ [flightId: string]: FlightFareTier }>({});
  const [selectedBusTier, setSelectedBusTier] = useState<{ [busId: string]: BusClassOption }>({});

  // User's itinerary destination cities (derived from activeTrip)
  const itineraryCities = useMemo(() => {
    if (!activeTrip || !activeTrip.stops || activeTrip.stops.length === 0) {
      return ['Delhi', 'Mumbai', 'Goa', 'Jaipur', 'Bengaluru'];
    }
    return activeTrip.stops.map(s => s.city_name);
  }, [activeTrip]);

  const defaultOrigin = activeTrip?.stops?.[0]?.city_name || 'Delhi';
  const defaultDestination = activeTrip?.stops?.[1]?.city_name || activeTrip?.stops?.[0]?.city_name || 'Varanasi';

  /* ==========================================================================
     1. IRCTC TRAIN SEARCH STATE
     ========================================================================== */
  const [trainFrom, setTrainFrom] = useState<string>(defaultOrigin);
  const [trainTo, setTrainTo] = useState<string>(defaultDestination);
  const [trainDate, setTrainDate] = useState<string>(activeTrip?.start_date || '2026-06-15');
  const [trainClassFilter, setTrainClassFilter] = useState<string>('All Classes');
  const [trainQuota, setTrainQuota] = useState<string>('General');
  const [flexibleWithDate, setFlexibleWithDate] = useState<boolean>(true);

  // Generated dynamic trains based on search
  const availableTrains = useMemo(() => {
    const list = generateIRCTCTrains(trainFrom, trainTo, trainDate);
    if (trainClassFilter === 'All Classes') return list;

    // Filter by class code if specified
    const codeMatch = trainClassFilter.split(' ')[0];
    return list.filter(t => t.classes.some(c => c.code.toLowerCase().includes(codeMatch.toLowerCase())));
  }, [trainFrom, trainTo, trainDate, trainClassFilter]);

  /* ==========================================================================
     2. FLIGHT SEARCH STATE
     ========================================================================== */
  const [flightFrom, setFlightFrom] = useState<string>(defaultOrigin);
  const [flightTo, setFlightTo] = useState<string>(defaultDestination);
  const [flightDate, setFlightDate] = useState<string>(activeTrip?.start_date || '2026-06-15');
  const [flightCabinFilter, setFlightCabinFilter] = useState<string>('All Cabins');

  const availableFlights = useMemo(() => {
    return generateFlightRoutes(flightFrom, flightTo, flightDate);
  }, [flightFrom, flightTo, flightDate]);

  /* ==========================================================================
     3. BUS SEARCH STATE
     ========================================================================== */
  const [busFrom, setBusFrom] = useState<string>(defaultOrigin);
  const [busTo, setBusTo] = useState<string>(defaultDestination);
  const [busDate, setBusDate] = useState<string>(activeTrip?.start_date || '2026-06-15');

  const availableBuses = useMemo(() => {
    return generateBusRoutes(busFrom, busTo, busDate);
  }, [busFrom, busTo, busDate]);

  /* ==========================================================================
     4. REGIONAL VEHICLE RENTALS (DYNAMIC DESTINATION FLEET)
     ========================================================================== */
  const [chosenDestinationCity, setChosenDestinationCity] = useState<string>(() => {
    if (activeTrip?.stops && activeTrip.stops.length > 0) {
      return activeTrip.stops[0].city_name;
    }
    return 'Goa';
  });

  const [vehiclePickupDate, setVehiclePickupDate] = useState<string>(activeTrip?.start_date || '2026-06-15');
  const [vehicleDropDate, setVehicleDropDate] = useState<string>(activeTrip?.end_date || '2026-06-20');
  const [vehicleBodyFilter, setVehicleBodyFilter] = useState<string>('all');

  const regionalVehiclesList = useMemo(() => {
    const fleet = getRegionalVehicles(chosenDestinationCity);
    return fleet.filter(v => {
      if (vehicleCategoryFilter !== 'all' && v.category !== vehicleCategoryFilter) return false;
      if (vehicleBodyFilter !== 'all' && v.bodyType.toLowerCase() !== vehicleBodyFilter.toLowerCase()) return false;
      return true;
    });
  }, [chosenDestinationCity, vehicleCategoryFilter, vehicleBodyFilter]);

  /* ==========================================================================
     5. STAYS / ACCOMMODATION (Cheapest to Most Expensive)
     ========================================================================== */
  const [stayCityFilter, setStayCityFilter] = useState<string>('All');
  const [stayTypeFilter, setStayTypeFilter] = useState<string>('All');
  const [staySortBy, setStaySortBy] = useState<'price-asc' | 'price-desc' | 'rating'>('price-asc');
  const [stayMaxPrice, setStayMaxPrice] = useState<number>(25000);

  const rawAccommodations = useMemo(() => [
    {
      id: 'st-1',
      name: 'Highway Star Express Motel & Suites',
      type: 'Motel',
      city: 'Delhi',
      country: 'India',
      location: 'Suburban Ring Road • Free Ground Parking',
      pricePerNight: 950,
      rating: 4.2,
      reviewsCount: 310,
      image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80',
      perks: ['Free Parking', '24/7 Check-in', 'Drive-in Rooms', 'Free Breakfast Snack'],
      tag: 'Cheapest Stay'
    },
    {
      id: 'st-2',
      name: 'Backpacker Central Pods & Social Hostel',
      type: 'Hostel / Budget Stay',
      city: 'Goa',
      country: 'India',
      location: 'Near Anjuna Beach • 200m to Flea Market',
      pricePerNight: 1190,
      rating: 4.6,
      reviewsCount: 840,
      image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=600&q=80',
      perks: ['Privacy Pods', 'Free High-Speed Wi-Fi', 'Rooftop Lounge', 'Keycard Access'],
      tag: 'Backpacker Choice'
    },
    {
      id: 'st-3',
      name: 'Travelers Oasis Heritage Roadside Inn',
      type: 'Motel',
      city: 'Jaipur',
      country: 'India',
      location: 'Bani Park • 10 min to Railway Station',
      pricePerNight: 1350,
      rating: 4.3,
      reviewsCount: 195,
      image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=600&q=80',
      perks: ['Air Conditioned', 'Free Ground Parking', 'Pet Friendly', 'Self-Check-in Kiosk'],
      tag: 'Road Trip Pick'
    },
    {
      id: 'st-4',
      name: 'Old Quarter Charm Boutique Hotel (3★)',
      type: 'Boutique Hotel',
      city: 'Varanasi',
      country: 'India',
      location: 'Dashashwamedh Ghat Views • Historic Courtyard',
      pricePerNight: 2450,
      rating: 4.7,
      reviewsCount: 620,
      image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80',
      perks: ['Ghatside Breakfast', 'Private Bathroom', 'Elevator', 'Tea/Coffee Maker'],
      tag: 'Best Value City Stay'
    },
    {
      id: 'st-5',
      name: 'Taj Gateway Waterfront Luxury Palace (5★)',
      type: 'Luxury Resort',
      city: 'Mumbai',
      country: 'India',
      location: 'Apollo Bunder • Arabian Sea View',
      pricePerNight: 16500,
      rating: 4.95,
      reviewsCount: 1450,
      image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=600&q=80',
      perks: ['Heritage High-Tea', 'Infinity Pool & Spa', 'Private Butler Service', 'Airport Chauffeur'],
      tag: 'Ultra Luxury'
    }
  ], []);

  const processedStays = useMemo(() => {
    return rawAccommodations
      .filter((stay) => {
        if (stayCityFilter !== 'All' && stay.city !== stayCityFilter) return false;
        if (stayTypeFilter !== 'All') {
          if (stayTypeFilter === 'Motel' && stay.type !== 'Motel') return false;
          if (stayTypeFilter === 'Budget' && !stay.type.includes('Budget') && !stay.type.includes('Hostel')) return false;
          if (stayTypeFilter === 'Hotel' && !stay.type.includes('Hotel') && !stay.type.includes('Boutique')) return false;
          if (stayTypeFilter === 'Luxury' && !stay.type.includes('Luxury')) return false;
        }
        if (stay.pricePerNight > stayMaxPrice) return false;
        return true;
      })
      .sort((a, b) => {
        if (staySortBy === 'price-asc') return a.pricePerNight - b.pricePerNight; // CHEAPEST FIRST (DEFAULT)
        if (staySortBy === 'price-desc') return b.pricePerNight - a.pricePerNight;
        if (staySortBy === 'rating') return b.rating - a.rating;
        return a.pricePerNight - b.pricePerNight;
      });
  }, [rawAccommodations, stayCityFilter, stayTypeFilter, staySortBy, stayMaxPrice]);

  /* ==========================================================================
     6. PRE-BOOKING ATTRACTIONS
     ========================================================================== */
  const [attractionCategoryFilter, setAttractionCategoryFilter] = useState<'All' | 'museum' | 'zoo' | 'amusement' | 'monument'>('All');
  const [attractionCityFilter, setAttractionCityFilter] = useState<string>('All');

  const rawAttractions = useMemo(() => [
    {
      id: 'att-1',
      title: 'National Rail Museum & Heritage Steam Ride',
      category: 'museum',
      city: 'Delhi',
      country: 'India',
      advanceRequirement: 'Timed entry ticket • Sells out on weekends',
      highlights: ['Fairy Queen Steam Engine', 'Royal Saloon Coaches', 'Joy Train Ride'],
      ticketPrice: 250,
      slots: ['10:00 AM', '12:30 PM', '03:00 PM', '04:30 PM'],
      duration: '2.5 Hours',
      image: 'https://images.unsplash.com/photo-1565099824688-e93eb20fe622?auto=format&fit=crop&w=600&q=80',
      badge: 'Heritage Train Pick'
    },
    {
      id: 'att-2',
      title: 'The Louvre Museum: Timed-Entry & Mona Lisa Access',
      category: 'museum',
      city: 'Paris',
      country: 'France',
      advanceRequirement: 'Strict 30-min slot booking mandatory • Sells out 2 weeks ahead',
      highlights: ['Priority Pyramid Fast Track', 'Denon & Sully Wings Access', 'Interactive Audio Guide'],
      ticketPrice: 2975,
      slots: ['09:30 AM', '11:00 AM', '01:30 PM', '03:45 PM'],
      duration: '3.5 Hours',
      image: 'https://images.unsplash.com/photo-1565099824688-e93eb20fe622?auto=format&fit=crop&w=600&q=80',
      badge: 'High Demand'
    },
    {
      id: 'att-3',
      title: 'Amber Palace Sound & Light Show VIP Seating',
      category: 'monument',
      city: 'Jaipur',
      country: 'India',
      advanceRequirement: 'Pre-booking mandatory for English / Hindi show seating',
      highlights: ['Maota Lake Reflections', 'Royal Rajput Legend Narrative', 'Front Courtyard Seats'],
      ticketPrice: 450,
      slots: ['07:00 PM (English)', '08:15 PM (Hindi)'],
      duration: '1.5 Hours',
      image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=600&q=80',
      badge: 'Night Experience'
    },
    {
      id: 'att-4',
      title: 'Kashi Vishwanath Corridor & Ganga Sunrise Boat',
      category: 'monument',
      city: 'Varanasi',
      country: 'India',
      advanceRequirement: 'Authorized pilgrim pass & motorized Bajra slot',
      highlights: ['Subah-e-Banaras Aarti', 'Ancient Manikarnika Ghat View', 'Direct Corridor Access'],
      ticketPrice: 650,
      slots: ['05:30 AM (Sunrise)', '06:00 PM (Sunset Aarti)'],
      duration: '2.0 Hours',
      image: 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=600&q=80',
      badge: 'Spiritual Highlight'
    }
  ], []);

  const processedAttractions = useMemo(() => {
    return rawAttractions.filter(item => {
      if (attractionCityFilter !== 'All' && item.city.toLowerCase() !== attractionCityFilter.toLowerCase()) return false;
      if (attractionCategoryFilter !== 'All' && item.category !== attractionCategoryFilter) return false;
      return true;
    });
  }, [rawAttractions, attractionCityFilter, attractionCategoryFilter]);

  /* ==========================================================================
     RESERVATION INITIATION HANDLERS
     ========================================================================== */
  const handleOpenTrainReservation = (train: IRCTCTrain, selectedClass: IRCTCClassOption) => {
    setActiveReservationModal({
      type: 'train',
      item: train,
      selectedClass: selectedClass,
      passengers: 1,
      passengerName: 'Alex Morgan',
      passengerAge: 32,
      passengerGender: 'Male',
      berthPreference: 'Lower Berth (LB)',
      foodChoice: train.trainType === 'Vande Bharat' || train.trainType === 'Rajdhani' ? 'Vegetarian' : 'No Food',
      autoUpgradation: true,
      confirmBerthsOnly: true,
      optInsurance: true,
      contactEmail: 'alex@globetrotter.io',
      contactPhone: '+91 98765 43210',
      travelDate: trainDate,
      timeSlot: `${train.departureTime} Departure`
    });
  };

  const handleOpenFlightReservation = (flight: FlightRouteOption, selectedTier: FlightFareTier) => {
    setActiveReservationModal({
      type: 'flight',
      item: flight,
      selectedTier: selectedTier,
      passengers: 1,
      passengerName: 'Alex Morgan',
      contactEmail: 'alex@globetrotter.io',
      contactPhone: '+91 98765 43210',
      travelDate: flightDate,
      timeSlot: `${flight.departureTime} (Flight ${flight.flightNo})`,
      seatPreference: 'Window (12A)'
    });
  };

  const handleOpenBusReservation = (bus: BusRouteOption, selectedClass: BusClassOption) => {
    setActiveReservationModal({
      type: 'bus',
      item: bus,
      selectedClass: selectedClass,
      passengers: 1,
      passengerName: 'Alex Morgan',
      contactEmail: 'alex@globetrotter.io',
      contactPhone: '+91 98765 43210',
      travelDate: busDate,
      boardingPoint: bus.boardingPoints[0].point,
      timeSlot: `${bus.departureTime} Departure`
    });
  };

  const handleOpenVehicleReservation = (vehicle: RegionalVehicle) => {
    setActiveReservationModal({
      type: 'vehicle',
      item: vehicle,
      rentalDays: 3,
      passengerName: 'Alex Morgan',
      drivingLicense: 'DL-0420180094182',
      contactEmail: 'alex@globetrotter.io',
      contactPhone: '+91 98765 43210',
      pickupHub: vehicle.pickupHubs[0],
      travelDate: vehiclePickupDate,
      timeSlot: `Pickup: ${vehiclePickupDate} • Drop: ${vehicleDropDate}`
    });
  };

  const handleOpenStayOrAttractionReservation = (type: 'stay' | 'attraction', item: any) => {
    setActiveReservationModal({
      type: type,
      item: item,
      passengers: 1,
      passengerName: 'Alex Morgan',
      contactEmail: 'alex@globetrotter.io',
      contactPhone: '+91 98765 43210',
      travelDate: activeTrip?.start_date || '2026-06-15',
      timeSlot: item.slots ? item.slots[0] : 'Standard 24-hr Check-in'
    });
  };

  /* ==========================================================================
     CONFIRM RESERVATION & GENERATE AUTHENTIC E-TICKET / VOUCHER
     ========================================================================== */
  const handleConfirmReservation = async () => {
    if (!activeReservationModal) return;
    setIsSubmittingBooking(true);

    const {
      type,
      item,
      selectedClass,
      selectedTier,
      passengerName,
      passengerAge,
      passengerGender,
      berthPreference,
      foodChoice,
      contactEmail,
      contactPhone,
      travelDate,
      timeSlot,
      passengers,
      rentalDays,
      drivingLicense,
      pickupHub
    } = activeReservationModal;

    let costTotal = 0;
    let title = '';
    let subtitle = '';
    let categoryLabel = '';
    let pnr = '';
    const detailsMap: Record<string, string> = {
      'Contact Email': contactEmail,
      'Contact Phone': contactPhone,
      'Currency': 'INR (₹)'
    };

    if (type === 'train') {
      const cls = selectedClass as IRCTCClassOption;
      costTotal = cls.fareINR * (passengers || 1);
      if (activeReservationModal.optInsurance) costTotal += 1;
      pnr = `${Math.floor(200 + Math.random() * 700)}-${Math.floor(1000000 + Math.random() * 9000000)}`;
      title = `${item.trainNo} / ${item.trainName}`;
      const coach = cls.code === '1A' ? 'H1' : cls.code === '2A' ? 'A1' : cls.code === '3A' ? 'B3' : cls.code === 'EC' ? 'E1' : 'C2';
      const berthNo = Math.floor(12 + Math.random() * 45);
      subtitle = `Coach ${coach}, Berth ${berthNo} (${berthPreference}) • ${cls.name}`;
      categoryLabel = 'IRCTC Indian Railways';
      detailsMap['PNR No'] = pnr;
      detailsMap['Quota'] = `${trainQuota} (GN)`;
      detailsMap['Berth Status'] = `CNF / ${coach} / ${berthNo} / ${berthPreference.split(' ')[0]}`;
      detailsMap['Passenger'] = `${passengerName} (${passengerAge}y, ${passengerGender})`;
      detailsMap['Food Preference'] = foodChoice;
      detailsMap['Auto-Upgradation'] = activeReservationModal.autoUpgradation ? 'Yes (Opted)' : 'No';
    } else if (type === 'flight') {
      const tier = selectedTier as FlightFareTier;
      costTotal = tier.priceINR * (passengers || 1);
      pnr = `${item.airlineCode}${Math.floor(100000 + Math.random() * 900000)}`;
      title = `${item.airline} (${item.flightNo}) - ${tier.tierName}`;
      subtitle = `Seat 14F (Window) • ${item.fromCity} (${item.fromCode}) → ${item.toCity} (${item.toCode})`;
      categoryLabel = 'Aviation E-Ticket';
      detailsMap['Airline PNR'] = pnr;
      detailsMap['Flight No'] = item.flightNo;
      detailsMap['Aircraft'] = item.aircraft;
      detailsMap['Baggage Included'] = `${tier.checkInBaggage} Check-in • ${tier.cabinBaggage} Cabin`;
      detailsMap['Terminal'] = item.fromTerminal;
    } else if (type === 'bus') {
      const cls = selectedClass as BusClassOption;
      costTotal = cls.priceINR * (passengers || 1);
      pnr = `BUS-${Math.floor(100000 + Math.random() * 900000)}`;
      title = `${item.operator} (${item.busModel})`;
      subtitle = `Seat/Berth L-04 • ${item.fromCity} → ${item.toCity}`;
      categoryLabel = 'Intercity Bus M-Ticket';
      detailsMap['Ticket PNR'] = pnr;
      detailsMap['Berth Type'] = cls.tierName;
      detailsMap['Boarding Point'] = activeReservationModal.boardingPoint || item.boardingPoints[0].point;
      detailsMap['Live Tracking'] = 'Active SMS Tracking Link sent to mobile';
    } else if (type === 'vehicle') {
      const days = rentalDays || 3;
      costTotal = item.pricePerDayINR * days;
      pnr = `VHC-${Math.floor(100000 + Math.random() * 900000)}`;
      const plate = `${item.city.substring(0, 2).toUpperCase()}-07-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${Math.floor(1000 + Math.random() * 9000)}`;
      title = `${item.name} (${item.brand})`;
      subtitle = `Plate #${plate} • ${days} Days Rental • ${pickupHub}`;
      categoryLabel = `${item.regionalTag}`;
      detailsMap['Rental Agreement ID'] = pnr;
      detailsMap['Assigned Vehicle Plate'] = plate;
      detailsMap['Driver License'] = drivingLicense;
      detailsMap['Pickup Depot'] = pickupHub;
      detailsMap['Key Access PIN'] = `${Math.floor(1000 + Math.random() * 9000)}`;
      detailsMap['Security Deposit'] = `₹0 (Fastag & DL Verified)`;
    } else {
      costTotal = (item.pricePerNight || item.ticketPrice || 1500) * (passengers || 1);
      pnr = `REF-${Math.floor(100000 + Math.random() * 900000)}`;
      title = item.name || item.title;
      subtitle = `${type === 'stay' ? 'Room Stay' : 'Advance Admission Slot'} • ${timeSlot}`;
      categoryLabel = type.toUpperCase();
      detailsMap['Booking Ref'] = pnr;
    }

    const newBooking: ConfirmedBooking = {
      id: 'BK-' + Math.floor(1000 + Math.random() * 9000),
      type: type as any,
      title: title,
      subtitle: subtitle,
      bookingRef: pnr || ('GT-' + Math.floor(100000 + Math.random() * 900000)),
      pnrNumber: pnr,
      travelDate: travelDate,
      origin: item.fromCity || item.from || item.city,
      destination: item.toCity || item.to || item.city,
      amount: costTotal,
      passengersOrGuests: `${passengers || 1} Traveler${(passengers || 1) > 1 ? 's' : ''} (${passengerName})`,
      status: 'Confirmed',
      categoryLabel: categoryLabel,
      details: detailsMap,
      qrData: `GT-CONFIRMED|${pnr}|${costTotal}|${travelDate}|${passengerName}`
    };

    // Auto record into trip budget & expenses and persist to SQLite bookings table if activeTrip exists
    if (activeTrip) {
      try {
        await api.createBooking(activeTrip.id, {
          type: newBooking.type,
          provider: newBooking.categoryLabel || 'Carrier / Provider',
          reference_number: newBooking.bookingRef,
          pnr_number: newBooking.pnrNumber,
          origin: newBooking.origin,
          destination: newBooking.destination,
          start_datetime: `${newBooking.travelDate} 10:00`,
          passengers: newBooking.passengersOrGuests,
          amount: costTotal,
          currency: 'INR',
          source: 'mock',
          status: 'Confirmed',
          category_label: newBooking.categoryLabel,
          details: newBooking.details,
          qr_data: newBooking.qrData,
          add_expense: addToTripExpensesChecked,
        });

        const fresh = await api.getTrip(activeTrip.id);
        if (onTripUpdated) onTripUpdated(fresh.trip);
      } catch (e) {
        console.warn('Could not persist booking to DB:', e);
      }
    }

    setConfirmedBookings(prev => [newBooking, ...prev]);
    setIsSubmittingBooking(false);
    setActiveReservationModal(null);
    setActiveTicketVoucher(newBooking);
  };

  /* ==========================================================================
     AI BOOKING EXTRACTION & IMPORT LOGIC
     ========================================================================== */

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Edge case: max 5 MB
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setFileError('File exceeds 5 MB limit. Please select a smaller PDF or screenshot.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedFile({
        name: file.name,
        size: file.size,
        base64: reader.result as string,
        mimeType: file.type || 'application/pdf',
      });
    };
    reader.onerror = () => {
      setFileError('Failed to read file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleRunAiExtraction = async () => {
    setExtractionError(null);
    if (!pastedText.trim() && !uploadedFile) {
      setExtractionError('Please paste booking confirmation text or select a file (PDF / Screenshot).');
      return;
    }

    setIsExtracting(true);
    try {
      const res = await api.extractBooking({
        text: pastedText.trim() || undefined,
        file_base64: uploadedFile?.base64,
        file_mime_type: uploadedFile?.mimeType,
        trip_id: activeTrip?.id,
      });

      if (!res.bookings || res.bookings.length === 0) {
        setExtractionError('No booking details could be parsed from the provided document.');
        return;
      }

      // Format extracted items into editable review items
      const reviewItems = res.bookings.map((item: any, idx: number) => ({
        temp_id: `ext-${Date.now()}-${idx}`,
        type: item.type?.value || 'flight',
        type_conf: item.type?.confidence ?? 0.8,
        provider: item.provider?.value || '',
        provider_conf: item.provider?.confidence ?? 0.8,
        reference_number: item.reference_number?.value || '',
        ref_conf: item.reference_number?.confidence ?? 0.8,
        origin: item.origin?.value || '',
        origin_conf: item.origin?.confidence ?? 0.8,
        destination: item.destination?.value || '',
        dest_conf: item.destination?.confidence ?? 0.8,
        start_datetime: item.start_datetime?.value || new Date().toISOString().substring(0, 16),
        start_conf: item.start_datetime?.confidence ?? 0.8,
        end_datetime: item.end_datetime?.value || '',
        passengers: Array.isArray(item.passenger_names?.value) ? item.passenger_names.value.join(', ') : '1 Traveler',
        passengers_conf: item.passenger_names?.confidence ?? 0.8,
        amount: Number(item.amount?.value) || 0,
        amount_conf: item.amount?.confidence ?? 0.8,
        currency: item.currency?.value || 'INR',
        notes: item.notes?.value || '',
        is_duplicate: item.is_duplicate || false,
        duplicate_warning: item.duplicate_warning || '',
      }));

      setExtractedReviewList(reviewItems);
    } catch (err: any) {
      setExtractionError(err.message || 'Failed to extract booking with Gemini AI.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveImportedBooking = async (item: any) => {
    if (!item.provider || !item.reference_number || !item.destination) {
      alert('Provider, reference number, and destination are required.');
      return;
    }

    setIsSavingImport(true);
    try {
      const travelDate = item.start_datetime.split('T')[0].split(' ')[0] || new Date().toISOString().split('T')[0];
      const newBookingObj: ConfirmedBooking = {
        id: `GT-${Date.now()}`,
        type: item.type,
        title: `${item.provider}: ${item.origin ? `${item.origin} ➔ ` : ''}${item.destination}`,
        subtitle: `${item.passengers} • Ref #${item.reference_number}`,
        bookingRef: item.reference_number,
        pnrNumber: item.reference_number,
        travelDate: travelDate,
        origin: item.origin,
        destination: item.destination,
        amount: Number(item.amount) || 0,
        passengersOrGuests: item.passengers,
        status: 'Confirmed',
        categoryLabel: `${item.provider} (${item.type.toUpperCase()})`,
        details: {
          'Reference No': item.reference_number,
          'Departure / Check-in': item.start_datetime,
          'Arrival / Check-out': item.end_datetime || 'N/A',
          'Travelers': item.passengers,
          'Source': 'AI Extracted Document',
          ...(item.notes ? { 'Notes': item.notes } : {}),
        },
        qrData: `GT-CONFIRMED|${item.reference_number}|${item.amount}|${travelDate}|${item.passengers}`
      };

      if (activeTrip) {
        await api.createBooking(activeTrip.id, {
          type: item.type,
          provider: item.provider,
          reference_number: item.reference_number,
          pnr_number: item.reference_number,
          origin: item.origin,
          destination: item.destination,
          start_datetime: item.start_datetime,
          end_datetime: item.end_datetime,
          passengers: item.passengers,
          amount: Number(item.amount) || 0,
          currency: item.currency || 'INR',
          source: 'imported',
          status: 'Confirmed',
          category_label: item.provider,
          details: newBookingObj.details,
          qr_data: newBookingObj.qrData,
          notes: item.notes,
          add_expense: importLinkedExpense,
        });

        const fresh = await api.getTrip(activeTrip.id);
        if (onTripUpdated) onTripUpdated(fresh.trip);
      }

      setConfirmedBookings(prev => [newBookingObj, ...prev]);
      // Remove this item from the review list
      setExtractedReviewList(prev => prev.filter(r => r.temp_id !== item.temp_id));

      if (extractedReviewList.length <= 1) {
        setIsImportModalOpen(false);
        setPastedText('');
        setUploadedFile(null);
      }

      // Open digital ticket voucher immediately
      setActiveTicketVoucher(newBookingObj);
    } catch (err: any) {
      alert(err.message || 'Failed to save imported booking');
    } finally {
      setIsSavingImport(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header & Concierge Summary Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-semibold mb-3 border border-sky-400/30">
              <Ticket className="w-3.5 h-3.5" />
              <span>Multi-City Travel & Transit Reservations Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-serif-heading tracking-tight text-white">
              Official Bookings & Concierge
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Authentic IRCTC train bookings, multi-tier flight & bus reservations, regional destination vehicle rentals, verified stays, and advance attraction slots with instant e-tickets.
            </p>
          </div>

          {/* Target Trip Sync Indicator */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 shrink-0 min-w-[260px]">
            <div className="text-[11px] uppercase tracking-wider text-amber-300 font-bold mb-1.5 flex items-center justify-between">
              <span>Target Trip Itinerary</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            {activeTrip ? (
              <div>
                <p className="text-sm font-bold text-white truncate max-w-[220px]">{activeTrip.name}</p>
                <div className="flex items-center space-x-2 text-xs text-slate-300 mt-1">
                  <MapPin className="w-3 h-3 text-sky-400" />
                  <span>{activeTrip.stops?.length || 0} destinations connected</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-300">No trip selected. Defaulting to national corridor.</p>
            )}

            {trips.length > 1 && (
              <div className="mt-3 pt-2.5 border-t border-white/10">
                <select
                  value={activeTrip?.id || ''}
                  onChange={(e) => {
                    const found = trips.find(t => t.id === Number(e.target.value));
                    if (found) onSelectTrip(found);
                  }}
                  className="w-full text-xs bg-slate-900/80 text-white rounded-lg px-2.5 py-1.5 border border-white/20 focus:outline-none"
                >
                  {trips.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Primary Sub-section Navigation Tabs */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() => setActiveSubSection('travel')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubSection === 'travel'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30 ring-2 ring-sky-300'
                : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
            }`}
          >
            <Train className="w-4 h-4" />
            <span>1. Transit & Travel Bookings</span>
          </button>

          <button
            onClick={() => setActiveSubSection('stay')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubSection === 'stay'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300 font-extrabold'
                : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
            }`}
          >
            <Hotel className="w-4 h-4" />
            <span>2. Stays (Cheapest to Luxury)</span>
          </button>

          <button
            onClick={() => setActiveSubSection('attractions')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeSubSection === 'attractions'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-300'
                : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>3. Advance Attractions</span>
          </button>

          <div className="flex items-center space-x-2 ml-auto">
            <button
              onClick={() => {
                setIsImportModalOpen(true);
                setExtractedReviewList([]);
                setExtractionError(null);
                setFileError(null);
              }}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center space-x-1.5 cursor-pointer bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:brightness-110 ring-2 ring-indigo-300"
              title="Import booking from confirmation text, PDF or screenshot using Gemini AI"
            >
              <Upload className="w-4 h-4" />
              <span>Import Booking</span>
            </button>

            <button
              onClick={() => setActiveSubSection('my-bookings')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                activeSubSection === 'my-bookings'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-300'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>My Confirmed Bookings ({confirmedBookings.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SUB-SECTION 1: TRANSIT & TRAVEL (TRAIN, FLIGHT, BUS, CAR/BIKE)
          ========================================================================= */}
      {activeSubSection === 'travel' && (
        <div className="space-y-6">
          {/* Sub-tabs for the 4 travel modes */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 flex-1">
              <button
                onClick={() => setTravelTab('train')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                  travelTab === 'train'
                    ? 'bg-[#0f3e84] text-white shadow-sm ring-1 ring-blue-800'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Train className="w-4 h-4 text-amber-300" />
                <span>IRCTC Train Bookings</span>
              </button>

              <button
                onClick={() => setTravelTab('flight')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                  travelTab === 'flight'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Plane className="w-4 h-4" />
                <span>Flight Bookings</span>
              </button>

              <button
                onClick={() => setTravelTab('bus')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                  travelTab === 'bus'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Bus className="w-4 h-4" />
                <span>Intercity Bus Bookings</span>
              </button>

              <button
                onClick={() => setTravelTab('vehicle')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                  travelTab === 'vehicle'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Car className="w-4 h-4" />
                <span>Regional Car / Bike Rentals</span>
              </button>
            </div>

            {travelTab === 'vehicle' && (
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 shrink-0">
                <button
                  onClick={() => setVehicleCategoryFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    vehicleCategoryFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  All Vehicles
                </button>
                <button
                  onClick={() => setVehicleCategoryFilter('cars')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    vehicleCategoryFilter === 'cars' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Cars & SUVs
                </button>
                <button
                  onClick={() => setVehicleCategoryFilter('bikes')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    vehicleCategoryFilter === 'bikes' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Bikes & Scooters
                </button>
              </div>
            )}
          </div>

          {/* ===================================================================
              1. OFFICIAL IRCTC TICKET BOOKING SYSTEM SIMULATION
              =================================================================== */}
          {travelTab === 'train' && (
            <div className="space-y-6">
              {/* IRCTC Official Branding Bar */}
              <div className="bg-[#0f3e84] text-white rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-blue-900 shadow-md">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-xs shrink-0">
                    <Train className="w-8 h-8 text-[#0f3e84]" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-amber-300 font-extrabold text-sm tracking-wide">
                        IRCTC e-Ticketing Service
                      </span>
                      <span className="text-[11px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-sm">
                        PRS LIVE
                      </span>
                    </div>
                    <p className="text-xs text-blue-100 mt-0.5">
                      Indian Railways Passenger Reservation System • Live Seat Availability & Instant ERS Ticket Issuance
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-xs text-blue-200">
                  <div className="flex items-center space-x-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Official CRIS Integration</span>
                  </div>
                  <div className="flex items-center space-x-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                    <Clock className="w-4 h-4 text-amber-300" />
                    <span>Tatkal Open: 10:00 AM (AC)</span>
                  </div>
                </div>
              </div>

              {/* IRCTC Search Bar */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 items-end">
                  {/* From Station */}
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      From Station / City
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={trainFrom}
                        onChange={(e) => setTrainFrom(e.target.value)}
                        placeholder="e.g. NDLS - New Delhi"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-800"
                      />
                      <MapPin className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* To Station */}
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      To Station / City
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={trainTo}
                        onChange={(e) => setTrainTo(e.target.value)}
                        placeholder="e.g. BSB - Varanasi Jn"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-800"
                      />
                      <MapPin className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Journey Date
                    </label>
                    <input
                      type="date"
                      value={trainDate}
                      onChange={(e) => setTrainDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-800"
                    />
                  </div>

                  {/* Search Button */}
                  <div>
                    <button
                      type="button"
                      className="w-full py-2.5 px-4 bg-[#fb792b] hover:bg-[#e06518] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Find Trains</span>
                    </button>
                  </div>
                </div>

                {/* Filter Row: Classes, Quota, and Flexible Checkbox */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-700">Class:</span>
                      <select
                        value={trainClassFilter}
                        onChange={(e) => setTrainClassFilter(e.target.value)}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                      >
                        <option>All Classes</option>
                        <option>1A - AC First Class</option>
                        <option>2A - AC 2 Tier</option>
                        <option>3A - AC 3 Tier</option>
                        <option>3E - AC 3 Economy</option>
                        <option>EC - Exec. Chair Car</option>
                        <option>CC - AC Chair Car</option>
                        <option>SL - Sleeper</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-700">Quota:</span>
                      <select
                        value={trainQuota}
                        onChange={(e) => setTrainQuota(e.target.value)}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                      >
                        <option>General</option>
                        <option>Ladies</option>
                        <option>Lower Berth / Sr. Citizen</option>
                        <option>Person With Disability</option>
                        <option>Tatkal</option>
                        <option>Premium Tatkal</option>
                      </select>
                    </div>

                    <label className="flex items-center space-x-1.5 font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={flexibleWithDate}
                        onChange={(e) => setFlexibleWithDate(e.target.checked)}
                        className="rounded border-slate-300 text-[#0f3e84] focus:ring-blue-800"
                      />
                      <span>Flexible With Date (±1 Day)</span>
                    </label>
                  </div>

                  {/* Popular Route Shortcuts */}
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                    <span className="font-semibold">Quick Corridor:</span>
                    <button
                      onClick={() => { setTrainFrom('Delhi'); setTrainTo('Varanasi'); }}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
                    >
                      DEL → BSB
                    </button>
                    <button
                      onClick={() => { setTrainFrom('Mumbai'); setTrainTo('Goa'); }}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
                    >
                      BOM → GOA
                    </button>
                    <button
                      onClick={() => { setTrainFrom('Delhi'); setTrainTo('Mumbai'); }}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
                    >
                      DEL → BOM
                    </button>
                  </div>
                </div>
              </div>

              {/* IRCTC Train List Display */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-600 px-1 font-medium">
                  <div>
                    <span>Trains Available: <strong>{availableTrains.length} Services</strong> between <strong>{trainFrom}</strong> and <strong>{trainTo}</strong> on <strong>{trainDate}</strong> ({trainQuota} Quota)</span>
                  </div>
                  <div className="flex items-center space-x-1 text-emerald-600 font-bold">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Real-time PRS Availability</span>
                  </div>
                </div>

                {availableTrains.map((train) => {
                  const isExpanded = expandedTrainId === train.id;
                  const currentSelectedClass = selectedTrainClass[train.id] || train.classes[0];

                  return (
                    <div
                      key={train.id}
                      className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400 transition-all shadow-xs overflow-hidden"
                    >
                      {/* Train Header Strip */}
                      <div className="p-5 pb-4 border-b border-slate-100">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-md bg-[#0f3e84] text-white font-black text-xs">
                                {train.trainNo}
                              </span>
                              <h3 className="text-base font-black text-slate-900 tracking-tight">
                                {train.trainName}
                              </h3>
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold uppercase">
                                {train.trainType}
                              </span>
                            </div>

                            <div className="flex items-center space-x-3 text-xs text-slate-500 pt-0.5">
                              {/* Running Days */}
                              <div className="flex items-center space-x-1">
                                <span className="font-bold text-slate-600">Runs On:</span>
                                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                                  <span
                                    key={idx}
                                    className={`w-4 h-4 rounded-xs text-[10px] font-black flex items-center justify-center ${
                                      train.runsOnDays[idx]
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-slate-100 text-slate-300'
                                    }`}
                                  >
                                    {day}
                                  </span>
                                ))}
                              </div>

                              <span>•</span>
                              <span>{train.distanceKm} km</span>

                              {train.hasPantry && (
                                <>
                                  <span>•</span>
                                  <span className="text-blue-800 font-semibold">Pantry Car</span>
                                </>
                              )}
                              {train.hasECatering && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-semibold">e-Catering Available</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Timetable Schedule Grid */}
                          <div className="flex items-center space-x-6 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                            <div className="text-right">
                              <p className="text-base font-black text-slate-900">{train.departureTime}</p>
                              <p className="font-bold text-[#0f3e84]">{train.fromStationCode}</p>
                              <p className="text-[10px] text-slate-600 truncate max-w-[90px]">{train.fromStationName}</p>
                            </div>

                            <div className="flex flex-col items-center">
                              <span className="text-[10px] text-slate-600 font-bold">{train.duration}</span>
                              <div className="w-20 h-0.5 bg-blue-800 relative my-1">
                                <div className="w-2 h-2 rounded-full bg-[#fb792b] absolute -top-0.75 right-0" />
                              </div>
                              <span className="text-[9px] text-emerald-700 font-semibold">Strict Punctuality</span>
                            </div>

                            <div className="text-left">
                              <p className="text-base font-black text-slate-900">{train.arrivalTime}</p>
                              <p className="font-bold text-[#0f3e84]">{train.toStationCode}</p>
                              <p className="text-[10px] text-slate-600 truncate max-w-[90px]">{train.toStationName}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* IRCTC Live Class Availability Tiles */}
                      <div className="p-4 bg-slate-50/70">
                        <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center justify-between">
                          <span>Select Travel Class (Live PRS Status)</span>
                          <span className="text-slate-600 normal-case">Click any class to check fare breakup and book</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                          {train.classes.map((cls) => {
                            const isSelected = currentSelectedClass?.code === cls.code;
                            const isAvailable = cls.statusCode === 'available';
                            const isRac = cls.statusCode === 'rac';

                            return (
                              <button
                                key={cls.code}
                                type="button"
                                onClick={() => {
                                  setSelectedTrainClass(prev => ({ ...prev, [train.id]: cls }));
                                  setExpandedTrainId(train.id);
                                }}
                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                                  isSelected
                                    ? 'bg-white border-[#0f3e84] shadow-md ring-2 ring-[#0f3e84]/20'
                                    : 'bg-white hover:bg-slate-50 border-slate-200'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-black text-sm text-slate-900">{cls.code}</span>
                                  <span className="text-xs font-black text-slate-900">
                                    ₹{cls.fareINR.toLocaleString('en-IN')}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-600 truncate">{cls.name}</p>

                                <div className="mt-2 pt-2 border-t border-slate-100">
                                  <span
                                    className={`text-[11px] font-black block truncate ${
                                      isAvailable
                                        ? 'text-emerald-700'
                                        : isRac
                                        ? 'text-amber-700'
                                        : 'text-orange-700'
                                    }`}
                                  >
                                    {cls.status}
                                  </span>
                                  <span className="text-[9px] text-slate-600 block mt-0.5">
                                    {cls.probability || 'High Probability'}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Selected Class Fare Breakup & Instant Book CTA */}
                      {currentSelectedClass && (
                        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-black text-[#0f3e84]">
                                Selected Class: {currentSelectedClass.name}
                              </span>
                              <span className="text-xs font-bold text-emerald-700">
                                ({currentSelectedClass.status})
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                              <span>Base Fare: ₹{currentSelectedClass.baseFare}</span>
                              <span>·</span>
                              <span>Reservation: ₹{currentSelectedClass.reservationCharge}</span>
                              <span>·</span>
                              <span>Superfast: ₹{currentSelectedClass.superfastCharge}</span>
                              {currentSelectedClass.cateringCharge ? (
                                <>
                                  <span>·</span>
                                  <span>Catering: ₹{currentSelectedClass.cateringCharge}</span>
                                </>
                              ) : null}
                              <span>·</span>
                              <span>GST: ₹{currentSelectedClass.gst}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3 shrink-0">
                            <div className="text-right">
                              <span className="text-[10px] uppercase font-bold text-slate-600 block">Total Fare</span>
                              <span className="text-lg font-black text-slate-900">
                                ₹{currentSelectedClass.fareINR.toLocaleString('en-IN')}
                              </span>
                            </div>

                            <button
                              onClick={() => handleOpenTrainReservation(train, currentSelectedClass)}
                              className="px-5 py-2.5 rounded-xl bg-[#fb792b] hover:bg-[#e06518] text-white text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer flex items-center space-x-1.5"
                            >
                              <span>Book IRCTC Seat →</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===================================================================
              2. FLIGHT BOOKING SYSTEM (MULTI-TIER REALISTIC OPTIONS)
              =================================================================== */}
          {travelTab === 'flight' && (
            <div className="space-y-6">
              {/* Flight Search Bar */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Departure Airport</label>
                  <input
                    type="text"
                    value={flightFrom}
                    onChange={(e) => setFlightFrom(e.target.value)}
                    placeholder="e.g. Delhi (DEL)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Arrival Airport</label>
                  <input
                    type="text"
                    value={flightTo}
                    onChange={(e) => setFlightTo(e.target.value)}
                    placeholder="e.g. Mumbai (BOM)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Travel Date</label>
                  <input
                    type="date"
                    value={flightDate}
                    onChange={(e) => setFlightDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Cabin</label>
                  <select
                    value={flightCabinFilter}
                    onChange={(e) => setFlightCabinFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option>All Cabins</option>
                    <option>Economy</option>
                    <option>Premium Economy</option>
                    <option>Business Class</option>
                  </select>
                </div>
                <div>
                  <button className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer">
                    <Search className="w-3.5 h-3.5" />
                    <span>Search Flights</span>
                  </button>
                </div>
              </div>

              {/* Flights Listing */}
              <div className="space-y-4">
                {availableFlights.map((flight) => {
                  const currentTier = selectedFlightTier[flight.id] || flight.fareTiers[0];

                  return (
                    <div key={flight.id} className="bg-white rounded-2xl border border-slate-200 hover:border-sky-300 transition-all shadow-xs overflow-hidden">
                      {/* Flight Header */}
                      <div className="p-5 pb-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center space-x-3.5">
                          <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 font-black text-sm">
                            ✈️
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="text-base font-extrabold text-slate-900">{flight.airline}</h3>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                                {flight.flightNo}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {flight.aircraft} • <span className="text-emerald-600 font-semibold">{flight.onTimeRating}</span>
                            </p>
                          </div>
                        </div>

                        {/* Timetable */}
                        <div className="flex items-center space-x-6 text-xs text-slate-600">
                          <div>
                            <p className="text-base font-black text-slate-900">{flight.departureTime}</p>
                            <p className="font-bold text-sky-800">{flight.fromCode}</p>
                            <p className="text-[10px] text-slate-600">{flight.fromTerminal}</p>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-600 font-semibold">{flight.duration}</span>
                            <div className="w-20 h-0.5 bg-sky-500 relative my-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-sky-600 absolute -top-0.5 right-0" />
                            </div>
                            <span className="text-[10px] text-sky-600 font-medium">{flight.stops}</span>
                          </div>
                          <div>
                            <p className="text-base font-black text-slate-900">{flight.arrivalTime}</p>
                            <p className="font-bold text-sky-800">{flight.toCode}</p>
                            <p className="text-[10px] text-slate-600">{flight.toTerminal}</p>
                          </div>
                        </div>
                      </div>

                      {/* Multi-Option Fare Tiers Grid */}
                      <div className="p-4 bg-slate-50/70">
                        <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-2">
                          Available Fare Tiers & Baggage Options
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {flight.fareTiers.map((tier) => {
                            const isSelected = currentTier.tierId === tier.tierId;

                            return (
                              <div
                                key={tier.tierId}
                                onClick={() => setSelectedFlightTier(prev => ({ ...prev, [flight.id]: tier }))}
                                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                  isSelected
                                    ? 'bg-white border-sky-600 shadow-md ring-2 ring-sky-500/20'
                                    : 'bg-white hover:bg-slate-50 border-slate-200'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="font-extrabold text-xs text-slate-900">{tier.tierName}</span>
                                    {tier.badge && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold">
                                        {tier.badge}
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-lg font-black text-slate-900 mb-2">
                                    ₹{tier.priceINR.toLocaleString('en-IN')}
                                  </div>

                                  <div className="space-y-1 text-[11px] text-slate-600">
                                    <p className="flex items-center space-x-1">
                                      <Luggage className="w-3 h-3 text-slate-400" />
                                      <span>Check-in: <strong>{tier.checkInBaggage}</strong></span>
                                    </p>
                                    <p>Cabin: {tier.cabinBaggage}</p>
                                    <p>Seat: {tier.seatSelection}</p>
                                    <p>Meal: {tier.meal}</p>
                                  </div>
                                </div>

                                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                                  <span className="text-[10px] text-amber-700 font-bold">
                                    {tier.seatsRemaining} seats left
                                  </span>
                                  <span className="text-xs font-bold text-sky-600">
                                    {isSelected ? 'Selected ✓' : 'Select'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Flight Footer with Booking Action */}
                      <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
                        <div className="text-xs text-slate-600">
                          Selected Tier: <strong className="text-slate-900">{currentTier.tierName}</strong> (₹{currentTier.priceINR.toLocaleString('en-IN')})
                        </div>

                        <button
                          onClick={() => handleOpenFlightReservation(flight, currentTier)}
                          className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer"
                        >
                          Book Flight Ticket →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===================================================================
              3. BUS BOOKING SYSTEM (MULTI-TIER SEATS & BERTHS)
              =================================================================== */}
          {travelTab === 'bus' && (
            <div className="space-y-6">
              {/* Bus Search Bar */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Departure City</label>
                  <input
                    type="text"
                    value={busFrom}
                    onChange={(e) => setBusFrom(e.target.value)}
                    placeholder="e.g. Delhi"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Arrival City</label>
                  <input
                    type="text"
                    value={busTo}
                    onChange={(e) => setBusTo(e.target.value)}
                    placeholder="e.g. Varanasi"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Date of Journey</label>
                  <input
                    type="date"
                    value={busDate}
                    onChange={(e) => setBusDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <button className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer">
                    <Search className="w-3.5 h-3.5" />
                    <span>Search Buses</span>
                  </button>
                </div>
              </div>

              {/* Bus Routes Listing */}
              <div className="space-y-4">
                {availableBuses.map((bus) => {
                  const currentClass = selectedBusTier[bus.id] || bus.classOptions[0];

                  return (
                    <div key={bus.id} className="bg-white rounded-2xl border border-slate-200 hover:border-rose-300 transition-all shadow-xs overflow-hidden">
                      <div className="p-5 pb-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-base font-black text-slate-900">{bus.operator}</h3>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px] border border-emerald-200 flex items-center space-x-1">
                              <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                              <span>{bus.rating} ({bus.reviewsCount})</span>
                            </span>
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 text-[10px] font-bold">
                              {bus.operatorType}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">{bus.busModel}</p>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {bus.amenities.map((am, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                                ✓ {am}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Timetable */}
                        <div className="flex items-center space-x-6 text-xs text-slate-600">
                          <div>
                            <p className="text-base font-black text-slate-900">{bus.departureTime}</p>
                            <p className="font-bold text-slate-800">{bus.fromCity}</p>
                            <p className="text-[10px] text-slate-600">{bus.boardingPoints[0].point.substring(0, 22)}...</p>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-600 font-semibold">{bus.duration}</span>
                            <div className="w-20 h-0.5 bg-rose-500 relative my-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-rose-600 absolute -top-0.5 right-0" />
                            </div>
                            <span className="text-[10px] text-emerald-600 font-medium">Live GPS</span>
                          </div>
                          <div>
                            <p className="text-base font-black text-slate-900">{bus.arrivalTime}</p>
                            <p className="font-bold text-slate-800">{bus.toCity}</p>
                            <p className="text-[10px] text-slate-600">{bus.droppingPoints[0].point.substring(0, 22)}...</p>
                          </div>
                        </div>
                      </div>

                      {/* Berth / Seat Class Options */}
                      <div className="p-4 bg-slate-50/70">
                        <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-2">
                          Select Berth / Seat Category
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {bus.classOptions.map((cls) => {
                            const isSelected = currentClass.tierId === cls.tierId;

                            return (
                              <div
                                key={cls.tierId}
                                onClick={() => setSelectedBusTier(prev => ({ ...prev, [bus.id]: cls }))}
                                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                  isSelected
                                    ? 'bg-white border-rose-600 shadow-md ring-2 ring-rose-500/20'
                                    : 'bg-white hover:bg-slate-50 border-slate-200'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-xs text-slate-900">{cls.tierName}</span>
                                    <span className="text-sm font-black text-slate-900">
                                      ₹{cls.priceINR.toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-emerald-700 font-bold mb-2">{cls.status}</p>

                                  <div className="space-y-0.5 text-[10px] text-slate-600">
                                    {cls.features.map((f, idx) => (
                                      <p key={idx}>• {f}</p>
                                    ))}
                                  </div>
                                </div>

                                <div className="mt-3 pt-2 border-t border-slate-100 text-right">
                                  <span className="text-xs font-bold text-rose-600">
                                    {isSelected ? 'Selected Berth ✓' : 'Select'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bus Footer */}
                      <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
                        <div className="text-xs text-slate-600">
                          Selected: <strong className="text-slate-900">{currentClass.tierName}</strong> (₹{currentClass.priceINR.toLocaleString('en-IN')})
                        </div>

                        <button
                          onClick={() => handleOpenBusReservation(bus, currentClass)}
                          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer"
                        >
                          Book Bus Berth →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===================================================================
              4. REGIONAL VEHICLE RENTALS (DESTINATION-SPECIFIC LIVE AVAILABILITY)
              =================================================================== */}
          {travelTab === 'vehicle' && (
            <div className="space-y-6">
              {/* Destination Selector & Rental Date Filter */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Regional Self-Drive Fleet & Daily Rentals</h3>
                    <p className="text-xs text-slate-500">
                      Live regional vehicle availability synced precisely to your destination with authentic models and instant doorstep pickup.
                    </p>
                  </div>

                  {/* Destination City Switcher */}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-700">Destination:</span>
                    <select
                      value={chosenDestinationCity}
                      onChange={(e) => setChosenDestinationCity(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      {itineraryCities.map(c => (
                        <option key={c} value={c}>{c} (Trip Stop)</option>
                      ))}
                      <option value="Goa">Goa (Beach Circuit)</option>
                      <option value="Manali">Manali / Himachal (Mountain Circuit)</option>
                      <option value="Delhi">Delhi / NCR</option>
                      <option value="Jaipur">Jaipur (Rajasthan)</option>
                      <option value="Bengaluru">Bengaluru (Tech Corridors)</option>
                      <option value="Paris">Paris (European Hub)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Rental Pickup City
                    </label>
                    <input
                      type="text"
                      value={chosenDestinationCity}
                      onChange={(e) => setChosenDestinationCity(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Pickup & Return Dates
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={vehiclePickupDate}
                        onChange={(e) => setVehiclePickupDate(e.target.value)}
                        className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-800"
                      />
                      <input
                        type="date"
                        value={vehicleDropDate}
                        onChange={(e) => setVehicleDropDate(e.target.value)}
                        className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <button className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer">
                      <Search className="w-3.5 h-3.5" />
                      <span>Check Regional Fleet</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Regional Fleet Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {regionalVehiclesList.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Vehicle Image & Stock Badge */}
                      <div className="relative h-44 bg-slate-100 overflow-hidden">
                        <img
                          src={vehicle.image}
                          alt={vehicle.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 left-3 px-2.5 py-1 bg-slate-900/85 backdrop-blur-md rounded-lg text-white text-[10px] font-bold">
                          {vehicle.bodyType}
                        </div>
                        <div className="absolute top-3 right-3 px-2 py-1 bg-amber-400 text-slate-950 rounded-lg text-[10px] font-bold flex items-center space-x-1">
                          <Star className="w-3 h-3 fill-slate-950" />
                          <span>{vehicle.rating}</span>
                        </div>
                      </div>

                      <div className="p-4 space-y-2.5">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                            {vehicle.regionalTag}
                          </span>
                          <h4 className="text-base font-extrabold text-slate-900 leading-snug">
                            {vehicle.name}
                          </h4>
                        </div>

                        {/* Specs */}
                        <div className="flex items-center space-x-3 text-xs text-slate-500 font-medium">
                          <span>{vehicle.transmission}</span>
                          <span>•</span>
                          <span>{vehicle.fuelType}</span>
                          <span>•</span>
                          <span>{vehicle.mileageOrRange}</span>
                        </div>

                        {/* Real-time stock status */}
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700">
                          {vehicle.stockStatus}
                        </div>

                        {/* Features list */}
                        <div className="pt-2 border-t border-slate-100 space-y-1">
                          {vehicle.features.map((feat, idx) => (
                            <p key={idx} className="text-[11px] text-slate-600 flex items-center space-x-1.5">
                              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{feat}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Pricing & Reservation CTA */}
                    <div className="p-4 pt-2 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-600 block">Daily Tariff</span>
                        <span className="text-lg font-black text-slate-900">
                          ₹{vehicle.pricePerDayINR.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-slate-600 font-medium"> / day</span>
                      </div>

                      <button
                        onClick={() => handleOpenVehicleReservation(vehicle)}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                      >
                        Reserve Vehicle →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SUB-SECTION 2: STAY / ACCOMMODATION (SORTED CHEAPEST TO LUXURY)
          ========================================================================= */}
      {activeSubSection === 'stay' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">All Available Stays & Accommodations</h3>
                <p className="text-xs text-slate-500">
                  Arranged automatically from <strong className="text-emerald-700 font-bold">cheapest to luxury range</strong> with instant booking.
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <span className="text-xs font-semibold text-slate-500">Sort By:</span>
                <select
                  value={staySortBy}
                  onChange={(e) => setStaySortBy(e.target.value as any)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="price-asc">Cheapest First (₹ Low to High)</option>
                  <option value="price-desc">Luxury First (₹ High to Low)</option>
                  <option value="rating">Top Rated (Review Score)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700">Filter City:</span>
                <select
                  value={stayCityFilter}
                  onChange={(e) => setStayCityFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                >
                  <option value="All">All Cities</option>
                  {itineraryCities.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700">Type:</span>
                <select
                  value={stayTypeFilter}
                  onChange={(e) => setStayTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                >
                  <option value="All">All Categories</option>
                  <option value="Motel">Motels & Drive-in Stays</option>
                  <option value="Budget">Hostels & Budget Pods</option>
                  <option value="Hotel">Hotels & Boutique Inns</option>
                  <option value="Luxury">Luxury Resorts & Heritage Palaces</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {processedStays.map((stay) => (
              <div key={stay.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="relative h-44 bg-slate-100 overflow-hidden">
                    <img
                      src={stay.image}
                      alt={stay.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 px-2 py-1 bg-slate-900/80 backdrop-blur-md rounded-lg text-white text-[10px] font-bold">
                      {stay.type}
                    </div>
                    <div className="absolute top-3 right-3 px-2 py-1 bg-amber-400 text-slate-950 rounded-lg text-[10px] font-bold flex items-center space-x-1">
                      <Star className="w-3 h-3 fill-slate-950" />
                      <span>{stay.rating}</span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block">{stay.tag}</span>
                    <h4 className="text-base font-bold text-slate-900 leading-snug">{stay.name}</h4>
                    <p className="text-xs text-slate-500 flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{stay.location}</span>
                    </p>

                    <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                      {stay.perks.map((p, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          ✓ {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-2 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">Nightly Rate</span>
                    <span className="text-lg font-black text-slate-900">₹{stay.pricePerNight.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-slate-600 font-medium"> / night</span>
                  </div>

                  <button
                    onClick={() => handleOpenStayOrAttractionReservation('stay', stay)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                  >
                    Reserve Room →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-SECTION 3: PRE-BOOKING ATTRACTIONS
          ========================================================================= */}
      {activeSubSection === 'attractions' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Pre-Book Advance Entry Tickets</h3>
              <p className="text-xs text-slate-500">
                Official timed entry passes for iconic museums, monuments, and exhibits.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700">Category:</span>
              <select
                value={attractionCategoryFilter}
                onChange={(e) => setAttractionCategoryFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value="All">All Attractions</option>
                <option value="museum">Museums</option>
                <option value="monument">Monuments</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {processedAttractions.map((att) => (
              <div key={att.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="relative h-48 bg-slate-100 overflow-hidden">
                    <img src={att.image} alt={att.title} className="w-full h-full object-cover" />
                    <div className="absolute top-3 left-3 px-2 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold">
                      {att.city}, {att.country}
                    </div>
                  </div>

                  <div className="p-5 space-y-2.5">
                    <h4 className="text-base font-bold text-slate-900">{att.title}</h4>
                    <p className="text-xs text-amber-700 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-200">
                      ⚠️ {att.advanceRequirement}
                    </p>

                    <div className="space-y-1 pt-1">
                      {att.highlights.map((h, i) => (
                        <p key={i} className="text-xs text-slate-600 flex items-center space-x-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{h}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">Ticket Price</span>
                    <span className="text-lg font-black text-slate-900">₹{att.ticketPrice.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-slate-600"> / person</span>
                  </div>

                  <button
                    onClick={() => handleOpenStayOrAttractionReservation('attraction', att)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Select Slot & Pass →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-SECTION 4: MY CONFIRMED BOOKINGS ARCHIVE
          ========================================================================= */}
      {activeSubSection === 'my-bookings' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Your Confirmed Travel Bookings & Passes</h3>
              <p className="text-xs text-slate-500">
                Official electronic vouchers with PNRs and QR codes. Auto-synced with trip itinerary.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
              {confirmedBookings.length} Active Reservations
            </span>
          </div>

          <div className="space-y-3">
            {confirmedBookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-emerald-300 transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-black text-[10px]">
                      {booking.categoryLabel}
                    </span>
                    <h4 className="text-base font-bold text-slate-900">{booking.title}</h4>
                  </div>
                  <p className="text-xs text-slate-600">{booking.subtitle}</p>
                  <div className="flex items-center space-x-4 text-xs text-slate-500">
                    <span>Travel Date: <strong>{booking.travelDate}</strong></span>
                    <span>Ref / PNR: <strong className="font-mono text-slate-800">{booking.bookingRef}</strong></span>
                    <span>Travelers: <strong>{booking.passengersOrGuests}</strong></span>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 gap-2 shrink-0">
                  <div className="text-left sm:text-right">
                    <span className="text-base font-black text-slate-900">₹{booking.amount.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-emerald-700 font-bold block">Confirmed ✓</span>
                  </div>

                  <button
                    onClick={() => setActiveTicketVoucher(booking)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>View Official Pass</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          RESERVATION CHECKOUT MODAL (HIGH AUTHENTICITY)
          ========================================================================= */}
      {activeReservationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
            <div className={`p-5 text-white flex items-center justify-between shrink-0 ${
              activeReservationModal.type === 'train' ? 'bg-[#0f3e84]' : 'bg-slate-900'
            }`}>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                  {activeReservationModal.type === 'train' ? 'IRCTC Passenger Reservation System (PRS)' : 'Express Reservation Checkout'}
                </span>
                <h3 className="text-base font-extrabold truncate max-w-md">
                  {activeReservationModal.item.trainName || activeReservationModal.item.airline || activeReservationModal.item.operator || activeReservationModal.item.name || activeReservationModal.item.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveReservationModal(null)}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Summary Strip */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Selected Service</span>
                  <span className="font-extrabold text-slate-900 text-xs">
                    {activeReservationModal.selectedClass?.name || activeReservationModal.selectedTier?.tierName || activeReservationModal.timeSlot}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Base Tariff</span>
                  <span className="text-base font-black text-slate-900">
                    ₹{(activeReservationModal.selectedClass?.fareINR || activeReservationModal.selectedTier?.priceINR || activeReservationModal.item.pricePerDayINR || activeReservationModal.item.pricePerNight || activeReservationModal.item.ticketPrice || 1500).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Passenger Inputs */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 border-b pb-1">Primary Passenger / Driver Info</h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name (as per Govt ID) *</label>
                  <input
                    type="text"
                    value={activeReservationModal.passengerName}
                    onChange={(e) => setActiveReservationModal({ ...activeReservationModal, passengerName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Age</label>
                    <input
                      type="number"
                      value={activeReservationModal.passengerAge || 32}
                      onChange={(e) => setActiveReservationModal({ ...activeReservationModal, passengerAge: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                    <select
                      value={activeReservationModal.passengerGender || 'Male'}
                      onChange={(e) => setActiveReservationModal({ ...activeReservationModal, passengerGender: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                    >
                      <option>Male</option>
                      <option>Female</option>
                      <option>Transgender</option>
                    </select>
                  </div>
                  {activeReservationModal.type === 'train' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Berth Preference</label>
                      <select
                        value={activeReservationModal.berthPreference}
                        onChange={(e) => setActiveReservationModal({ ...activeReservationModal, berthPreference: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                      >
                        <option>Lower Berth (LB)</option>
                        <option>Middle Berth (MB)</option>
                        <option>Upper Berth (UB)</option>
                        <option>Side Lower (SL)</option>
                        <option>Side Upper (SU)</option>
                        <option>Window Seat (WS)</option>
                        <option>No Preference</option>
                      </select>
                    </div>
                  )}
                  {activeReservationModal.type === 'vehicle' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Driver License No *</label>
                      <input
                        type="text"
                        value={activeReservationModal.drivingLicense || ''}
                        onChange={(e) => setActiveReservationModal({ ...activeReservationModal, drivingLicense: e.target.value })}
                        placeholder="DL-042018..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-800"
                      />
                    </div>
                  )}
                </div>

                {/* IRCTC Specific Options */}
                {activeReservationModal.type === 'train' && (
                  <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-2">
                    <span className="text-[10px] font-bold text-[#0f3e84] uppercase block">
                      Indian Railways Travel Preferences
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="flex items-center space-x-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activeReservationModal.autoUpgradation}
                          onChange={(e) => setActiveReservationModal({ ...activeReservationModal, autoUpgradation: e.target.checked })}
                          className="rounded border-slate-300 text-[#0f3e84]"
                        />
                        <span>Consider for Free Auto-Upgradation</span>
                      </label>

                      <label className="flex items-center space-x-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activeReservationModal.optInsurance}
                          onChange={(e) => setActiveReservationModal({ ...activeReservationModal, optInsurance: e.target.checked })}
                          className="rounded border-slate-300 text-[#0f3e84]"
                        />
                        <span>IRCTC Travel Insurance (₹0.45/person)</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Contact info */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={activeReservationModal.contactEmail}
                      onChange={(e) => setActiveReservationModal({ ...activeReservationModal, contactEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile (for SMS & ERS PNR)</label>
                    <input
                      type="text"
                      value={activeReservationModal.contactPhone}
                      onChange={(e) => setActiveReservationModal({ ...activeReservationModal, contactPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                    />
                  </div>
                </div>

                {activeTrip && (
                  <div className="pt-2">
                    <label className="flex items-center space-x-2 text-xs font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addToTripExpensesChecked}
                        onChange={(e) => setAddToTripExpensesChecked(e.target.checked)}
                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span>Automatically record cost to active trip budget & expenses</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <span className="text-[10px] text-slate-600 block">Total Payable in INR</span>
                <span className="text-xl font-black text-slate-900">
                  ₹{(
                    (activeReservationModal.selectedClass?.fareINR || activeReservationModal.selectedTier?.priceINR || activeReservationModal.item.pricePerDayINR || activeReservationModal.item.pricePerNight || activeReservationModal.item.ticketPrice || 1500) * (activeReservationModal.passengers || 1)
                  ).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveReservationModal(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={isSubmittingBooking}
                  onClick={handleConfirmReservation}
                  className={`px-5 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all shadow-md flex items-center space-x-1.5 cursor-pointer ${
                    activeReservationModal.type === 'train' ? 'bg-[#fb792b] hover:bg-[#e06518]' : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  {isSubmittingBooking ? 'Issuing E-Ticket...' : 'Confirm & Generate Ticket →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DIGITAL E-TICKET & IRCTC ERS PASS MODAL
          ========================================================================= */}
      {activeTicketVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header with authentic styling */}
            <div className={`p-6 text-white text-center relative shrink-0 ${
              activeTicketVoucher.type === 'train' ? 'bg-[#0f3e84]' : 'bg-gradient-to-r from-emerald-600 to-teal-700'
            }`}>
              <button
                onClick={() => setActiveTicketVoucher(null)}
                className="absolute top-4 right-4 p-1 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                {activeTicketVoucher.type === 'train' ? (
                  <Train className="w-7 h-7 text-amber-300" />
                ) : (
                  <CheckCircle2 className="w-7 h-7 text-white" />
                )}
              </div>

              <span className="text-[11px] uppercase tracking-wider font-extrabold text-amber-300 block">
                {activeTicketVoucher.type === 'train' ? 'Indian Railways Electronic Reservation Slip (ERS)' : 'Official Travel Voucher & Pass'}
              </span>
              <h3 className="text-base sm:text-lg font-black tracking-tight mt-0.5">
                {activeTicketVoucher.title}
              </h3>
              <p className="text-xs text-white/80 mt-1">
                PNR / Reference: <strong className="font-mono text-amber-200 text-sm">{activeTicketVoucher.pnrNumber || activeTicketVoucher.bookingRef}</strong>
              </p>
            </div>

            {/* Ticket Perforated Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-600 uppercase font-bold block">Status</span>
                  <span className="text-emerald-700 font-black flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span>CNF - Confirmed</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-600 uppercase font-bold block">Date of Journey</span>
                  <span className="text-slate-900 font-bold">{activeTicketVoucher.travelDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-600 uppercase font-bold block">Passenger Details</span>
                  <span className="text-slate-900 font-bold">{activeTicketVoucher.passengersOrGuests}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-600 uppercase font-bold block">Total Amount Paid</span>
                  <span className="text-slate-900 font-black text-sm">
                    ₹{activeTicketVoucher.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Extra Dynamic Details */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
                {Object.entries(activeTicketVoucher.details).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-slate-500">{k}:</span>
                    <span className="font-bold text-slate-800">{v}</span>
                  </div>
                ))}
              </div>

              {/* QR Code representation */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center justify-center space-y-2 text-center">
                <div className="w-28 h-28 bg-white p-2 rounded-xl shadow-inner border border-slate-300 flex items-center justify-center">
                  <QrCode className="w-24 h-24 text-slate-900" />
                </div>
                <p className="text-[10px] font-mono text-slate-500">
                  SCAN AT GATE / TT CHECK • REF #{activeTicketVoucher.bookingRef}
                </p>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center space-x-2 shrink-0">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Print / Save E-Ticket</span>
              </button>
              <button
                onClick={() => setActiveTicketVoucher(null)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      {/* =========================================================================
          AI BOOKING IMPORT MODAL (TEXT & MULTI-MODAL DOCUMENT PARSER)
          ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-400/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300 block">
                    Smart Travel Concierge
                  </span>
                  <h3 className="text-lg font-extrabold font-serif-heading">
                    Import Booking Confirmation
                  </h3>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setExtractedReviewList([]);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              {/* If no items extracted yet, show input step */}
              {extractedReviewList.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-slate-600 leading-relaxed">
                    Paste confirmation emails, SMS booking alerts, or upload boarding pass PDFs and booking screenshots. Gemini AI will automatically extract flights, trains, stays, cabs, or activities with confidence verification.
                  </p>

                  {/* Input Mode Tabs */}
                  <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setImportTab('text')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                        importTab === 'text' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Paste Confirmation Text / SMS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportTab('file')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                        importTab === 'file' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileUp className="w-3.5 h-3.5" />
                      <span>Upload PDF / Screenshot (Max 5MB)</span>
                    </button>
                  </div>

                  {/* Tab 1: Paste Text */}
                  {importTab === 'text' && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-800">
                        Paste Booking Email, PNR Text, or E-Ticket Slip
                      </label>
                      <textarea
                        rows={7}
                        placeholder={`Example:\nYour IndiGo booking 6E-2041 from Delhi (DEL) to Varanasi (VNS) on 2026-06-12 06:15 is confirmed. PNR: W9KZ2Q. Passengers: Alex Morgan. Total Fare: INR 4,850.`}
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-sky-600 font-mono resize-none leading-relaxed"
                      />
                    </div>
                  )}

                  {/* Tab 2: Upload File */}
                  {importTab === 'file' && (
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-800">
                        Upload Document or Image Receipt
                      </label>
                      <div className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-2xl p-6 text-center transition-all bg-slate-50/50 hover:bg-sky-50/30">
                        <input
                          type="file"
                          id="booking-file-input"
                          accept="application/pdf,image/png,image/jpeg,image/webp"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <label htmlFor="booking-file-input" className="cursor-pointer space-y-2 block">
                          <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
                            <Upload className="w-6 h-6" />
                          </div>
                          <div>
                            <span className="font-bold text-sky-700 block">Click to upload or drag & drop</span>
                            <span className="text-[11px] text-slate-500">PDF, PNG, JPG or WebP (strictly up to 5 MB)</span>
                          </div>
                        </label>
                      </div>

                      {uploadedFile && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-emerald-600" />
                            <span className="font-bold text-emerald-900 truncate max-w-xs">{uploadedFile.name}</span>
                            <span className="text-[10px] text-emerald-700 font-semibold">
                              ({(uploadedFile.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUploadedFile(null)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {fileError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{fileError}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {extractionError && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-start space-x-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Extraction Notice</span>
                        <span>{extractionError}</span>
                      </div>
                    </div>
                  )}

                  {/* Extract action */}
                  <div className="pt-2 flex items-center justify-end">
                    <button
                      type="button"
                      disabled={isExtracting || (!pastedText.trim() && !uploadedFile)}
                      onClick={handleRunAiExtraction}
                      className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isExtracting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Extracting Details with Gemini AI...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Extract Booking with Gemini AI →</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Step 2: Editable Confirmation Cards with Confidence Highlighting */
                <div className="space-y-6">
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-indigo-700 block">AI Verification Review</span>
                      <p className="text-xs text-indigo-900 font-semibold">
                        Found {extractedReviewList.length} booking reservation(s). Fields with lower confidence (<span className="text-amber-800 font-bold">&lt; 75%</span>) are highlighted for your verification. Nothing is saved until you confirm.
                      </p>
                    </div>
                    <button
                      onClick={() => setExtractedReviewList([])}
                      className="px-3 py-1.5 text-xs text-indigo-700 hover:text-indigo-900 font-bold cursor-pointer"
                    >
                      ← Re-scan
                    </button>
                  </div>

                  {extractedReviewList.map((item, index) => {
                    const isLowConf = (val?: number) => val !== undefined && val < 0.75;

                    return (
                      <div
                        key={item.temp_id}
                        className="bg-white rounded-3xl border border-slate-300 p-5 space-y-4 shadow-sm"
                      >
                        {/* Duplicate Warning */}
                        {item.is_duplicate && (
                          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start space-x-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <strong className="block">Duplicate Reference Detected:</strong>
                              <span>{item.duplicate_warning}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-extrabold text-[10px] uppercase tracking-wider">
                            Booking #{index + 1} ({item.type})
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            Source: imported
                          </span>
                        </div>

                        {/* Editable Form Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-bold text-slate-700">Booking Type</label>
                              {isLowConf(item.type_conf) && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                                  ⚠️ {(item.type_conf * 100).toFixed(0)}% conf
                                </span>
                              )}
                            </div>
                            <select
                              value={item.type}
                              onChange={(e) => {
                                const val = e.target.value;
                                setExtractedReviewList(prev => prev.map(r => r.temp_id === item.temp_id ? { ...r, type: val } : r));
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                                isLowConf(item.type_conf) ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-slate-50'
                              }`}
                            >
                              <option value="flight">Flight</option>
                              <option value="train">Train</option>
                              <option value="bus">Bus</option>
                              <option value="stay">Stay / Hotel</option>
                              <option value="cab">Cab / Rental Car</option>
                              <option value="activity">Attraction / Activity</option>
                            </select>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-bold text-slate-700">Provider / Airline / Hotel</label>
                              {isLowConf(item.provider_conf) && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                                  ⚠️ {(item.provider_conf * 100).toFixed(0)}% conf
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={item.provider}
                              onChange={(e) => {
                                const val = e.target.value;
                                setExtractedReviewList(prev => prev.map(r => r.temp_id === item.temp_id ? { ...r, provider: val } : r));
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                                isLowConf(item.provider_conf) ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-slate-50'
                              }`}
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-bold text-slate-700">Reference / PNR Number</label>
                              {isLowConf(item.ref_conf) && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                                  ⚠️ {(item.ref_conf * 100).toFixed(0)}% conf
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={item.reference_number}
                              onChange={(e) => {
                                const val = e.target.value;
                                setExtractedReviewList(prev => prev.map(r => r.temp_id === item.temp_id ? { ...r, reference_number: val } : r));
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border ${
                                isLowConf(item.ref_conf) ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-slate-50'
                              }`}
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-bold text-slate-700">Destination / Property</label>
                              {isLowConf(item.dest_conf) && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                                  ⚠️ {(item.dest_conf * 100).toFixed(0)}% conf
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={item.destination}
                              onChange={(e) => {
                                const val = e.target.value;
                                setExtractedReviewList(prev => prev.map(r => r.temp_id === item.temp_id ? { ...r, destination: val } : r));
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                                isLowConf(item.dest_conf) ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-slate-50'
                              }`}
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-bold text-slate-700">Origin (Optional)</label>
                              {isLowConf(item.origin_conf) && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                                  ⚠️ {(item.origin_conf * 100).toFixed(0)}% conf
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={item.origin}
                              onChange={(e) => {
                                const val = e.target.value;
                                setExtractedReviewList(prev => prev.map(r => r.temp_id === item.temp_id ? { ...r, origin: val } : r));
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                                isLowConf(item.origin_conf) ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-slate-50'
                              }`}
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-bold text-slate-700">Start Date & Time</label>
                              {isLowConf(item.start_conf) && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                                  ⚠️ {(item.start_conf * 100).toFixed(0)}% conf
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              placeholder="YYYY-MM-DD HH:mm"
                              value={item.start_datetime}
                              onChange={(e) => {
                                const val = e.target.value;
                                setExtractedReviewList(prev => prev.map(r => r.temp_id === item.temp_id ? { ...r, start_datetime: val } : r));
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                                isLowConf(item.start_conf) ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-slate-50'
                              }`}
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-bold text-slate-700">Amount (₹ INR)</label>
                              {isLowConf(item.amount_conf) && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                                  ⚠️ {(item.amount_conf * 100).toFixed(0)}% conf
                                </span>
                              )}
                            </div>
                            <input
                              type="number"
                              min="0"
                              value={item.amount}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setExtractedReviewList(prev => prev.map(r => r.temp_id === item.temp_id ? { ...r, amount: val } : r));
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-xs font-black border ${
                                isLowConf(item.amount_conf) ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-slate-50'
                              }`}
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-bold text-slate-700">Traveler(s) / Guests</label>
                              {isLowConf(item.passengers_conf) && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                                  ⚠️ {(item.passengers_conf * 100).toFixed(0)}% conf
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={item.passengers}
                              onChange={(e) => {
                                const val = e.target.value;
                                setExtractedReviewList(prev => prev.map(r => r.temp_id === item.temp_id ? { ...r, passengers: val } : r));
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                                isLowConf(item.passengers_conf) ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-slate-50'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Optional linked expense checkbox */}
                        {activeTrip && (
                          <div className="pt-2 border-t border-slate-100">
                            <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={importLinkedExpense}
                                onChange={(e) => setImportLinkedExpense(e.target.checked)}
                                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                              />
                              <span>Automatically create linked expense in trip budget (₹{item.amount.toLocaleString('en-IN')})</span>
                            </label>
                          </div>
                        )}

                        {/* Save Action for this item */}
                        <div className="pt-2 flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            disabled={isSavingImport}
                            onClick={() => handleSaveImportedBooking(item)}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer flex items-center space-x-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Confirm & Save Booking →</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
