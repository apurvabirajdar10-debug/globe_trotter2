export interface IRCTCClassOption {
  code: string; // e.g. '1A', '2A', '3A', '3E', 'SL', 'EC', 'CC', '2S'
  name: string; // e.g. 'AC 3 Tier (3A)'
  status: string; // e.g. 'AVAILABLE - 0048', 'RAC 12', 'GNWL 8 / WL 4'
  statusCode: 'available' | 'rac' | 'wl';
  seatsAvailable: number;
  fareINR: number;
  baseFare: number;
  reservationCharge: number;
  superfastCharge: number;
  tatkalCharge?: number;
  cateringCharge?: number;
  gst: number;
  updatedMinutesAgo: number;
  probability?: string; // 'High (96% chance)', 'Guaranteed Confirmation'
}

export interface IRCTCTrain {
  id: string;
  trainNo: string;
  trainName: string;
  fromStationCode: string;
  fromStationName: string;
  toStationCode: string;
  toStationName: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  runsOnDays: boolean[]; // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
  trainType: 'Vande Bharat' | 'Rajdhani' | 'Shatabdi' | 'Duronto' | 'Superfast' | 'Mail/Express' | 'Jan Shatabdi';
  hasPantry: boolean;
  hasECatering: boolean;
  distanceKm: number;
  classes: IRCTCClassOption[];
}

export interface FlightFareTier {
  tierId: 'saver' | 'standard' | 'flexi' | 'business';
  tierName: string;
  badge?: string;
  priceINR: number;
  cabinBaggage: string;
  checkInBaggage: string;
  seatSelection: string;
  meal: string;
  dateChangeFee: string;
  cancellationRefund: string;
  seatsRemaining: number;
}

export interface FlightRouteOption {
  id: string;
  airline: string;
  airlineCode: string;
  logoUrl?: string;
  flightNo: string;
  aircraft: string; // e.g., 'Airbus A321neo', 'Boeing 787-9 Dreamliner'
  fromCity: string;
  fromCode: string;
  fromTerminal: string;
  toCity: string;
  toCode: string;
  toTerminal: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: string; // 'Non-stop' | '1 Stop via DEL'
  onTimeRating: string; // '94% On-time'
  fareTiers: FlightFareTier[];
}

export interface BusClassOption {
  tierId: 'lower-single' | 'lower-double' | 'upper-single' | 'semi-sleeper';
  tierName: string;
  seatLayout: string; // e.g. '2+1 Sleeper', '2+2 Push Back'
  status: string; // 'AVAILABLE - 6 berths'
  seatsAvailable: number;
  priceINR: number;
  features: string[];
}

export interface BusRouteOption {
  id: string;
  operator: string;
  operatorType: 'Govt Corporation' | 'Premium Private Fleet' | 'Electric Super-Express';
  busModel: string; // 'Volvo 9600 Multi-Axle', 'BharatBenz AC Sleeper', 'KSRTC Airavat'
  fromCity: string;
  toCity: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  rating: number;
  reviewsCount: number;
  boardingPoints: { point: string; time: string }[];
  droppingPoints: { point: string; time: string }[];
  amenities: string[];
  liveTracking: boolean;
  classOptions: BusClassOption[];
}

export interface RegionalVehicle {
  id: string;
  category: 'cars' | 'bikes';
  bodyType: 'Hatchback' | 'Sedan' | 'Compact SUV' | '4x4 Off-roader' | 'Cruiser Bike' | 'Adventure Tourer' | 'Scooter' | 'EV Smart';
  name: string;
  brand: string;
  regionalTag: string; // e.g., 'Goa Beach Special', 'Manali Hill Climb Certified'
  city: string;
  image: string;
  transmission: 'Manual' | 'Automatic' | 'CVT' | 'Direct Drive EV';
  fuelType: 'Petrol' | 'Diesel' | 'Electric' | 'Hybrid';
  mileageOrRange: string;
  seats: number;
  luggageCapacity?: string;
  rating: number;
  tripsCompleted: number;
  pricePerDayINR: number;
  securityDepositINR: number;
  freeKmPerDay: string;
  stockStatus: string; // '3 Units Available Today', 'Instant Doorstep Delivery'
  stockUnits: number;
  pickupHubs: string[];
  features: string[];
}

// ---------------------------------------------------------------------------
// 1. IRCTC STATIONS DATABASE
// ---------------------------------------------------------------------------
export interface IRCTCStation {
  code: string;
  name: string;
  city: string;
  state: string;
}

export const IRCTC_STATIONS: IRCTCStation[] = [
  { code: 'NDLS', name: 'New Delhi', city: 'Delhi', state: 'Delhi' },
  { code: 'NZM', name: 'Hazrat Nizamuddin', city: 'Delhi', state: 'Delhi' },
  { code: 'DLI', name: 'Old Delhi Jn', city: 'Delhi', state: 'Delhi' },
  { code: 'MMCT', name: 'Mumbai Central', city: 'Mumbai', state: 'Maharashtra' },
  { code: 'CSMT', name: 'Chhatrapati Shivaji Maharaj Terminus', city: 'Mumbai', state: 'Maharashtra' },
  { code: 'BDTS', name: 'Bandra Terminus', city: 'Mumbai', state: 'Maharashtra' },
  { code: 'PUNE', name: 'Pune Jn', city: 'Pune', state: 'Maharashtra' },
  { code: 'HWH', name: 'Howrah Jn', city: 'Kolkata', state: 'West Bengal' },
  { code: 'SDAH', name: 'Sealdah', city: 'Kolkata', state: 'West Bengal' },
  { code: 'MAS', name: 'MGR Chennai Central', city: 'Chennai', state: 'Tamil Nadu' },
  { code: 'SBC', name: 'KSR Bengaluru City', city: 'Bengaluru', state: 'Karnataka' },
  { code: 'YPR', name: 'Yesvantpur Jn', city: 'Bengaluru', state: 'Karnataka' },
  { code: 'HYB', name: 'Hyderabad Deccan', city: 'Hyderabad', state: 'Telangana' },
  { code: 'SC', name: 'Secunderabad Jn', city: 'Hyderabad', state: 'Telangana' },
  { code: 'JP', name: 'Jaipur Jn', city: 'Jaipur', state: 'Rajasthan' },
  { code: 'BSB', name: 'Varanasi Jn', city: 'Varanasi', state: 'Uttar Pradesh' },
  { code: 'AGC', name: 'Agra Cantt', city: 'Agra', state: 'Uttar Pradesh' },
  { code: 'MAO', name: 'Madgaon Jn', city: 'Goa', state: 'Goa' },
  { code: 'CDG', name: 'Chandigarh Jn', city: 'Chandigarh', state: 'Punjab / Haryana' },
  { code: 'SVDK', name: 'Shri Mata Vaishno Devi Katra', city: 'Katra / Jammu', state: 'Jammu & Kashmir' },
  { code: 'ADI', name: 'Ahmedabad Jn', city: 'Ahmedabad', state: 'Gujarat' },
  { code: 'ERS', name: 'Ernakulam Jn (South)', city: 'Kochi', state: 'Kerala' },
  { code: 'TVC', name: 'Thiruvananthapuram Central', city: 'Thiruvananthapuram', state: 'Kerala' },
  { code: 'UDZ', name: 'Udaipur City', city: 'Udaipur', state: 'Rajasthan' },
  { code: 'GHY', name: 'Guwahati Jn', city: 'Guwahati', state: 'Assam' },
  { code: 'ASR', name: 'Amritsar Jn', city: 'Amritsar', state: 'Punjab' },
  { code: 'LKO', name: 'Lucknow Charbagh', city: 'Lucknow', state: 'Uttar Pradesh' },
];

export function findStationForCity(cityName: string): IRCTCStation {
  const clean = cityName.toLowerCase().trim();
  const direct = IRCTC_STATIONS.find(s =>
    s.city.toLowerCase() === clean ||
    s.name.toLowerCase().includes(clean) ||
    clean.includes(s.city.toLowerCase()) ||
    s.code.toLowerCase() === clean
  );
  if (direct) return direct;

  // Fallback defaults if city is international or not in list
  return {
    code: cityName.substring(0, 3).toUpperCase() + 'C',
    name: `${cityName} Central Terminal`,
    city: cityName,
    state: 'Indian Railways'
  };
}

// ---------------------------------------------------------------------------
// 2. DYNAMIC IRCTC TRAINS GENERATOR
// ---------------------------------------------------------------------------
export function generateIRCTCTrains(fromCity: string, toCity: string, dateStr: string): IRCTCTrain[] {
  const fromStn = findStationForCity(fromCity);
  const toStn = findStationForCity(toCity);

  // Realistic seed variation based on city names
  const pairHash = Math.abs((fromCity + toCity).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
  const isVandeRoute = true;

  const trains: IRCTCTrain[] = [
    {
      id: `irctc-vb-${pairHash % 900}`,
      trainNo: `22${String(400 + (pairHash % 89)).padStart(3, '0')}`,
      trainName: `${toStn.city.toUpperCase()} VANDE BHARAT EXP`,
      fromStationCode: fromStn.code,
      fromStationName: fromStn.name,
      toStationCode: toStn.code,
      toStationName: toStn.name,
      departureTime: '06:00 AM',
      arrivalTime: '11:50 AM',
      duration: '05h 50m',
      runsOnDays: [true, true, true, false, true, true, true], // Except Thu
      trainType: 'Vande Bharat',
      hasPantry: true,
      hasECatering: true,
      distanceKm: 485,
      classes: [
        {
          code: 'EC',
          name: 'Exec. Chair Car (EC)',
          status: 'AVAILABLE - 0026',
          statusCode: 'available',
          seatsAvailable: 26,
          fareINR: 2365,
          baseFare: 1980,
          reservationCharge: 60,
          superfastCharge: 45,
          cateringCharge: 180,
          gst: 100,
          updatedMinutesAgo: 4,
          probability: 'Guaranteed Confirmation'
        },
        {
          code: 'CC',
          name: 'AC Chair Car (CC)',
          status: 'AVAILABLE - 0118',
          statusCode: 'available',
          seatsAvailable: 118,
          fareINR: 1280,
          baseFare: 1020,
          reservationCharge: 40,
          superfastCharge: 45,
          cateringCharge: 120,
          gst: 55,
          updatedMinutesAgo: 2,
          probability: 'Guaranteed Confirmation'
        }
      ]
    },
    {
      id: `irctc-raj-${pairHash % 800}`,
      trainNo: `12${String(950 + (pairHash % 40)).padStart(3, '0')}`,
      trainName: `${toStn.city.toUpperCase()} RAJDHANI EXPRESS`,
      fromStationCode: fromStn.code,
      fromStationName: fromStn.name,
      toStationCode: toStn.code,
      toStationName: toStn.name,
      departureTime: '04:55 PM',
      arrivalTime: '08:35 AM',
      duration: '15h 40m',
      runsOnDays: [true, true, true, true, true, true, true], // All days
      trainType: 'Rajdhani',
      hasPantry: true,
      hasECatering: true,
      distanceKm: 1384,
      classes: [
        {
          code: '1A',
          name: 'AC First Class (1A)',
          status: 'AVAILABLE - 0008',
          statusCode: 'available',
          seatsAvailable: 8,
          fareINR: 4820,
          baseFare: 4210,
          reservationCharge: 60,
          superfastCharge: 75,
          cateringCharge: 260,
          gst: 215,
          updatedMinutesAgo: 6,
          probability: 'Guaranteed Confirmation'
        },
        {
          code: '2A',
          name: 'AC 2 Tier (2A)',
          status: 'AVAILABLE - 0034',
          statusCode: 'available',
          seatsAvailable: 34,
          fareINR: 2890,
          baseFare: 2470,
          reservationCharge: 50,
          superfastCharge: 45,
          cateringCharge: 200,
          gst: 125,
          updatedMinutesAgo: 3,
          probability: 'Guaranteed Confirmation'
        },
        {
          code: '3A',
          name: 'AC 3 Tier (3A)',
          status: 'AVAILABLE - 0092',
          statusCode: 'available',
          seatsAvailable: 92,
          fareINR: 2040,
          baseFare: 1720,
          reservationCharge: 40,
          superfastCharge: 45,
          cateringCharge: 150,
          gst: 85,
          updatedMinutesAgo: 1,
          probability: 'Guaranteed Confirmation'
        },
        {
          code: '3E',
          name: 'AC 3 Economy (3E)',
          status: 'AVAILABLE - 0044',
          statusCode: 'available',
          seatsAvailable: 44,
          fareINR: 1860,
          baseFare: 1560,
          reservationCharge: 40,
          superfastCharge: 45,
          cateringCharge: 140,
          gst: 75,
          updatedMinutesAgo: 5,
          probability: 'Guaranteed Confirmation'
        }
      ]
    },
    {
      id: `irctc-sf-${pairHash % 700}`,
      trainNo: `12${String(610 + (pairHash % 60)).padStart(3, '0')}`,
      trainName: `${fromStn.city.toUpperCase()} - ${toStn.city.toUpperCase()} SF EXPRESS`,
      fromStationCode: fromStn.code,
      fromStationName: fromStn.name,
      toStationCode: toStn.code,
      toStationName: toStn.name,
      departureTime: '08:20 PM',
      arrivalTime: '06:40 AM',
      duration: '10h 20m',
      runsOnDays: [true, true, true, true, true, true, true],
      trainType: 'Superfast',
      hasPantry: true,
      hasECatering: true,
      distanceKm: 780,
      classes: [
        {
          code: '2A',
          name: 'AC 2 Tier (2A)',
          status: 'RAC 04',
          statusCode: 'rac',
          seatsAvailable: 4,
          fareINR: 1940,
          baseFare: 1760,
          reservationCharge: 50,
          superfastCharge: 45,
          gst: 85,
          updatedMinutesAgo: 8,
          probability: 'High Probability (94% Confirmed)'
        },
        {
          code: '3A',
          name: 'AC 3 Tier (3A)',
          status: 'AVAILABLE - 0054',
          statusCode: 'available',
          seatsAvailable: 54,
          fareINR: 1390,
          baseFare: 1240,
          reservationCharge: 40,
          superfastCharge: 45,
          gst: 65,
          updatedMinutesAgo: 2,
          probability: 'Guaranteed Confirmation'
        },
        {
          code: 'SL',
          name: 'Sleeper (SL)',
          status: 'AVAILABLE - 0142',
          statusCode: 'available',
          seatsAvailable: 142,
          fareINR: 520,
          baseFare: 460,
          reservationCharge: 20,
          superfastCharge: 40,
          gst: 0,
          updatedMinutesAgo: 1,
          probability: 'Guaranteed Confirmation'
        }
      ]
    },
    {
      id: `irctc-overnight-${pairHash % 600}`,
      trainNo: `12${String(410 + (pairHash % 50)).padStart(3, '0')}`,
      trainName: `GOLDEN HERITAGE OVERNIGHT MAIL`,
      fromStationCode: fromStn.code,
      fromStationName: fromStn.name,
      toStationCode: toStn.code,
      toStationName: toStn.name,
      departureTime: '10:45 PM',
      arrivalTime: '07:15 AM',
      duration: '08h 30m',
      runsOnDays: [true, true, true, true, true, true, true],
      trainType: 'Mail/Express',
      hasPantry: false,
      hasECatering: true,
      distanceKm: 610,
      classes: [
        {
          code: '1A',
          name: 'AC First Class (1A)',
          status: 'AVAILABLE - 0004',
          statusCode: 'available',
          seatsAvailable: 4,
          fareINR: 3120,
          baseFare: 2900,
          reservationCharge: 60,
          superfastCharge: 45,
          gst: 115,
          updatedMinutesAgo: 12,
          probability: 'Guaranteed Confirmation'
        },
        {
          code: '2A',
          name: 'AC 2 Tier (2A)',
          status: 'AVAILABLE - 0021',
          statusCode: 'available',
          seatsAvailable: 21,
          fareINR: 1780,
          baseFare: 1610,
          reservationCharge: 50,
          superfastCharge: 45,
          gst: 75,
          updatedMinutesAgo: 7,
          probability: 'Guaranteed Confirmation'
        },
        {
          code: '3A',
          name: 'AC 3 Tier (3A)',
          status: 'GNWL 14 / WL 6',
          statusCode: 'wl',
          seatsAvailable: 0,
          fareINR: 1240,
          baseFare: 1110,
          reservationCharge: 40,
          superfastCharge: 45,
          gst: 45,
          updatedMinutesAgo: 5,
          probability: 'Medium Probability (72% Confirmed)'
        },
        {
          code: 'SL',
          name: 'Sleeper (SL)',
          status: 'AVAILABLE - 0076',
          statusCode: 'available',
          seatsAvailable: 76,
          fareINR: 460,
          baseFare: 400,
          reservationCharge: 20,
          superfastCharge: 40,
          gst: 0,
          updatedMinutesAgo: 3,
          probability: 'Guaranteed Confirmation'
        }
      ]
    }
  ];

  return trains;
}

// ---------------------------------------------------------------------------
// 3. FLIGHT OPERATORS & MULTI-OPTION ROUTES
// ---------------------------------------------------------------------------
export function generateFlightRoutes(fromCity: string, toCity: string, dateStr: string): FlightRouteOption[] {
  const fromCode = fromCity.substring(0, 3).toUpperCase();
  const toCode = toCity.substring(0, 3).toUpperCase();

  return [
    {
      id: 'fl-indigo-1',
      airline: 'IndiGo Airlines',
      airlineCode: '6E',
      flightNo: `6E-${Math.floor(200 + Math.random() * 600)}`,
      aircraft: 'Airbus A321neo • Slimline USB',
      fromCity,
      fromCode,
      fromTerminal: 'T1 - Domestic Departure',
      toCity,
      toCode,
      toTerminal: 'T2 - Arrivals',
      departureTime: '06:15 AM',
      arrivalTime: '08:25 AM',
      duration: '2h 10m',
      stops: 'Non-stop',
      onTimeRating: '96% On-time track record',
      fareTiers: [
        {
          tierId: 'saver',
          tierName: 'Saver (Cabin Only)',
          priceINR: 4299,
          cabinBaggage: '7 kg',
          checkInBaggage: 'Not included (₹500 for 15kg)',
          seatSelection: 'Chargeable from ₹150',
          meal: 'Paid on-board menu',
          dateChangeFee: '₹2,500 + fare difference',
          cancellationRefund: '₹3,000 deduction',
          seatsRemaining: 4
        },
        {
          tierId: 'standard',
          tierName: 'Standard / Regular',
          badge: 'Most Popular',
          priceINR: 5149,
          cabinBaggage: '7 kg',
          checkInBaggage: '15 kg included',
          seatSelection: 'Free standard seats',
          meal: 'Cookie + Beverage included',
          dateChangeFee: '₹1,500 + fare difference',
          cancellationRefund: 'Standard airline deduction',
          seatsRemaining: 18
        },
        {
          tierId: 'flexi',
          tierName: 'Flexi Plus',
          badge: 'Zero Change Fee',
          priceINR: 6790,
          cabinBaggage: '7 kg',
          checkInBaggage: '15 kg included',
          seatSelection: 'Free Preferred / XL Seat',
          meal: 'Complimentary Hot Sandwich + Beverage',
          dateChangeFee: 'Free (0 change fees up to 2 hrs)',
          cancellationRefund: 'Only ₹500 fee on cancel',
          seatsRemaining: 9
        }
      ]
    },
    {
      id: 'fl-airindia-2',
      airline: 'Air India',
      airlineCode: 'AI',
      flightNo: `AI-${Math.floor(400 + Math.random() * 400)}`,
      aircraft: 'Boeing 787-9 Dreamliner • Inflight Wi-Fi',
      fromCity,
      fromCode,
      fromTerminal: 'T3 - Integrated Hub',
      toCity,
      toCode,
      toTerminal: 'T1 - Arrivals',
      departureTime: '10:45 AM',
      arrivalTime: '01:05 PM',
      duration: '2h 20m',
      stops: 'Non-stop',
      onTimeRating: '92% On-time',
      fareTiers: [
        {
          tierId: 'standard',
          tierName: 'Economy Comfort',
          badge: 'Hot Meal Included',
          priceINR: 5850,
          cabinBaggage: '8 kg',
          checkInBaggage: '20 kg included',
          seatSelection: 'Free seat selection',
          meal: 'Full Hot Gourmet Meal (Veg / Non-veg)',
          dateChangeFee: '₹1,200',
          cancellationRefund: 'Refundable with standard fee',
          seatsRemaining: 12
        },
        {
          tierId: 'flexi',
          tierName: 'Economy Flexi',
          badge: '25kg Baggage',
          priceINR: 7490,
          cabinBaggage: '8 kg',
          checkInBaggage: '25 kg check-in',
          seatSelection: 'Front row / Priority seating',
          meal: 'Premium Hot Meal + Lounge Pass Option',
          dateChangeFee: 'Zero date change charge',
          cancellationRefund: 'Full refund minus ₹600',
          seatsRemaining: 6
        },
        {
          tierId: 'business',
          tierName: 'Business Class',
          badge: 'Flat-Bed Luxury',
          priceINR: 17800,
          cabinBaggage: '12 kg',
          checkInBaggage: '35 kg priority check-in',
          seatSelection: 'Lie-flat 180° luxury seat',
          meal: '3-Course Chef Dining + Bar Service',
          dateChangeFee: 'Unlimited Free Date Changes',
          cancellationRefund: 'Instant full refund',
          seatsRemaining: 3
        }
      ]
    },
    {
      id: 'fl-akasa-3',
      airline: 'Akasa Air / Vistara Heritage',
      airlineCode: 'QP',
      flightNo: `QP-${Math.floor(1100 + Math.random() * 300)}`,
      aircraft: 'Boeing 737 MAX 8 • Cafe Akasa',
      fromCity,
      fromCode,
      fromTerminal: 'T1 - Departure Gate 4',
      toCity,
      toCode,
      toTerminal: 'T2 - Arrivals',
      departureTime: '05:30 PM',
      arrivalTime: '07:45 PM',
      duration: '2h 15m',
      stops: 'Non-stop',
      onTimeRating: '95% On-time',
      fareTiers: [
        {
          tierId: 'saver',
          tierName: 'Saver Fare',
          priceINR: 4450,
          cabinBaggage: '7 kg',
          checkInBaggage: '15 kg check-in',
          seatSelection: 'Auto-assigned at web check-in',
          meal: 'Buy on-board',
          dateChangeFee: '₹2,200 fee',
          cancellationRefund: 'Non-refundable',
          seatsRemaining: 5
        },
        {
          tierId: 'standard',
          tierName: 'Standard Saver',
          badge: 'Value Choice',
          priceINR: 5290,
          cabinBaggage: '7 kg',
          checkInBaggage: '15 kg check-in',
          seatSelection: 'Choose your seat',
          meal: 'Pre-booked hot snack item',
          dateChangeFee: '₹1,500',
          cancellationRefund: 'Standard refund',
          seatsRemaining: 15
        }
      ]
    }
  ];
}

// ---------------------------------------------------------------------------
// 4. BUS OPERATORS & MULTI-OPTION ROUTES
// ---------------------------------------------------------------------------
export function generateBusRoutes(fromCity: string, toCity: string, dateStr: string): BusRouteOption[] {
  return [
    {
      id: 'bus-intrcity-1',
      operator: 'IntrCity SmartBus Volvo 9600',
      operatorType: 'Premium Private Fleet',
      busModel: 'Volvo 9600 Multi-Axle AC Sleeper (2+1)',
      fromCity,
      toCity,
      departureTime: '08:30 PM',
      arrivalTime: '06:15 AM',
      duration: '09h 45m',
      rating: 4.8,
      reviewsCount: 2180,
      liveTracking: true,
      amenities: [
        'Live GPS Tracking',
        'Clean Sanitized Blanket & Pillow',
        'Individual USB & AC Vent',
        'Emergency SOS + CCTV',
        'Complimentary Water Bottle'
      ],
      boardingPoints: [
        { point: `${fromCity} Central Bus Terminal (Bay 12)`, time: '08:00 PM' },
        { point: `${fromCity} Ring Road Toll Gate Plaza`, time: '08:30 PM' }
      ],
      droppingPoints: [
        { point: `${toCity} Expressway Toll Plaza`, time: '05:45 AM' },
        { point: `${toCity} Main Station Circle`, time: '06:15 AM' }
      ],
      classOptions: [
        {
          tierId: 'lower-single',
          tierName: 'Lower Single Berth (Window)',
          seatLayout: '1 Berth Single Row',
          status: 'AVAILABLE - 04 berths',
          seatsAvailable: 4,
          priceINR: 1390,
          features: ['Private Curtain', 'No co-passenger', 'Charging socket', 'Reading light']
        },
        {
          tierId: 'lower-double',
          tierName: 'Lower Double Berth',
          seatLayout: '2 Berths Shared Row',
          status: 'AVAILABLE - 08 berths',
          seatsAvailable: 8,
          priceINR: 1190,
          features: ['Cozy for couples/friends', 'Soft foam mattress', 'Water bottle holder']
        },
        {
          tierId: 'upper-single',
          tierName: 'Upper Single Berth',
          seatLayout: 'Upper Single Row',
          status: 'AVAILABLE - 06 berths',
          seatsAvailable: 6,
          priceINR: 1050,
          features: ['Panoramic view', 'Safety railings', 'Privacy curtain']
        }
      ]
    },
    {
      id: 'bus-ksrtc-2',
      operator: 'State Express Airavat Club Class',
      operatorType: 'Govt Corporation',
      busModel: 'Scania Metrolink Multi-Axle HD',
      fromCity,
      toCity,
      departureTime: '10:00 PM',
      arrivalTime: '07:30 AM',
      duration: '09h 30m',
      rating: 4.7,
      reviewsCount: 4320,
      liveTracking: true,
      amenities: [
        'Punctual Govt Timings',
        'Ergonomic Calf-Support Recliner',
        'Packaged Drinking Water',
        'Experienced Double Crew'
      ],
      boardingPoints: [
        { point: `${fromCity} ISBT Govt Terminus (Platform 4)`, time: '09:30 PM' },
        { point: `${fromCity} Outer Ring Flyover`, time: '10:00 PM' }
      ],
      droppingPoints: [
        { point: `${toCity} Bus Stand Platform 1`, time: '07:30 AM' }
      ],
      classOptions: [
        {
          tierId: 'semi-sleeper',
          tierName: 'Executive Semi-Sleeper AC Recliner',
          seatLayout: '2+2 Pushback 140°',
          status: 'AVAILABLE - 16 seats',
          seatsAvailable: 16,
          priceINR: 890,
          features: ['140° deep pushback', 'Calf-support rest', 'Personal AC airflow']
        }
      ]
    },
    {
      id: 'bus-zingbus-3',
      operator: 'Zingbus Electric Super-Express',
      operatorType: 'Electric Super-Express',
      busModel: 'Zingbus Zero-Emission AC Sleeper',
      fromCity,
      toCity,
      departureTime: '07:15 PM',
      arrivalTime: '05:00 AM',
      duration: '09h 45m',
      rating: 4.9,
      reviewsCount: 1640,
      liveTracking: true,
      amenities: [
        '100% Electric & Silent Ride',
        'Zing Premium Lounge Access at Boarding',
        'Fresh Blanket & Sanitized Linen',
        'Free Wi-Fi Onboard'
      ],
      boardingPoints: [
        { point: `${fromCity} Zingbus Premium Lounge`, time: '06:45 PM' },
        { point: `${fromCity} Metro Station Hub Gate 2`, time: '07:15 PM' }
      ],
      droppingPoints: [
        { point: `${toCity} City Junction Depot`, time: '05:00 AM' }
      ],
      classOptions: [
        {
          tierId: 'lower-single',
          tierName: 'Lower Single Sleeper Pod',
          seatLayout: 'Private Capsule Pod',
          status: 'AVAILABLE - 03 berths',
          seatsAvailable: 3,
          priceINR: 1450,
          features: ['Noise-cancelling capsule', 'Type-C Fast Charging', 'Anti-motion sickness setup']
        },
        {
          tierId: 'upper-single',
          tierName: 'Upper Single Sleeper Pod',
          seatLayout: 'Upper Capsule Pod',
          status: 'AVAILABLE - 05 berths',
          seatsAvailable: 5,
          priceINR: 1120,
          features: ['Quiet zone', 'Ambient LED mood lighting', 'Privacy blind']
        }
      ]
    }
  ];
}

// ---------------------------------------------------------------------------
// 5. REGIONAL VEHICLE RENTALS (CARS & BIKES) WITH REAL-TIME LOCAL AVAILABILITY
// ---------------------------------------------------------------------------
export function getRegionalVehicles(cityName: string): RegionalVehicle[] {
  const norm = cityName.toLowerCase().trim();

  // Region 1: GOA & COASTAL
  if (norm.includes('goa') || norm.includes('madgaon') || norm.includes('panaji') || norm.includes('calangute')) {
    return [
      {
        id: 'goa-car-thar',
        category: 'cars',
        bodyType: '4x4 Off-roader',
        name: 'Mahindra Thar 4x4 Open Convertible',
        brand: 'Mahindra',
        regionalTag: 'Goa Coastal Cruise Icon',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80',
        transmission: 'Manual',
        fuelType: 'Diesel',
        mileageOrRange: '14 km/l',
        seats: 4,
        luggageCapacity: '2 Bags',
        rating: 4.9,
        tripsCompleted: 480,
        pricePerDayINR: 3200,
        securityDepositINR: 0,
        freeKmPerDay: 'Unlimited km in Goa',
        stockStatus: '🟢 3 Units Available Today at Mopa & Dabolim Hubs',
        stockUnits: 3,
        pickupHubs: ['Mopa International Airport', 'Dabolim Airport Terminal', 'Madgaon Railway Station', 'Calangute Delivery'],
        features: ['Convertible Open Roof', '4x4 Beach Grip', 'Bluetooth Audio System', 'Zero Deposit with DL']
      },
      {
        id: 'goa-car-creta',
        category: 'cars',
        bodyType: 'Compact SUV',
        name: 'Hyundai Creta SX(O) Sunroof',
        brand: 'Hyundai',
        regionalTag: 'Family AC Beach Touring',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
        transmission: 'Automatic',
        fuelType: 'Petrol',
        mileageOrRange: '16 km/l',
        seats: 5,
        luggageCapacity: '3 Large Bags',
        rating: 4.8,
        tripsCompleted: 310,
        pricePerDayINR: 2600,
        securityDepositINR: 0,
        freeKmPerDay: 'Unlimited km',
        stockStatus: '🟢 5 Units in Stock at Panaji Depot',
        stockUnits: 5,
        pickupHubs: ['Panaji City Center', 'Dabolim Airport Hub', 'Baga Circle'],
        features: ['Panoramic Sunroof', 'Ventilated Seats', 'Fastag Pre-installed', 'Dashcam Equipped']
      },
      {
        id: 'goa-car-jimny',
        category: 'cars',
        bodyType: '4x4 Off-roader',
        name: 'Maruti Suzuki Jimny Alpha 4x4 AT',
        brand: 'Maruti Suzuki',
        regionalTag: 'Compact Beach Explorer',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80',
        transmission: 'Automatic',
        fuelType: 'Petrol',
        mileageOrRange: '16.5 km/l',
        seats: 4,
        luggageCapacity: '2 Medium Bags',
        rating: 4.7,
        tripsCompleted: 195,
        pricePerDayINR: 2200,
        securityDepositINR: 0,
        freeKmPerDay: 'Unlimited km',
        stockStatus: '🟡 Last 1 Unit Remaining at Dabolim',
        stockUnits: 1,
        pickupHubs: ['Dabolim Airport Desk', 'Candolim Beach Point'],
        features: ['True 4x4 ALLGRIP PRO', 'Easy Beach Parking', 'Apple CarPlay / Android Auto']
      },
      {
        id: 'goa-bike-hunter',
        category: 'bikes',
        bodyType: 'Cruiser Bike',
        name: 'Royal Enfield Hunter 350 Dapper Ash',
        brand: 'Royal Enfield',
        regionalTag: 'Coastal Highway Cruiser',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
        transmission: 'Manual',
        fuelType: 'Petrol',
        mileageOrRange: '36 km/l',
        seats: 2,
        rating: 4.9,
        tripsCompleted: 780,
        pricePerDayINR: 750,
        securityDepositINR: 0,
        freeKmPerDay: 'Unlimited km',
        stockStatus: '🟢 8 Bikes Available in Calangute & Anjuna',
        stockUnits: 8,
        pickupHubs: ['Calangute Main Road', 'Anjuna Flea Market Stand', 'Mopa Airport Parking'],
        features: ['2 ISI Certified Helmets Included', 'Fast-charging Mobile Mount', 'Roadside Assistance 24x7']
      },
      {
        id: 'goa-bike-activa',
        category: 'bikes',
        bodyType: 'Scooter',
        name: 'Honda Activa 6G Premium',
        brand: 'Honda',
        regionalTag: 'Beach Hopping Best-Seller',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1597687210367-a4915552d890?auto=format&fit=crop&w=600&q=80',
        transmission: 'CVT',
        fuelType: 'Petrol',
        mileageOrRange: '52 km/l',
        seats: 2,
        rating: 4.7,
        tripsCompleted: 1420,
        pricePerDayINR: 400,
        securityDepositINR: 0,
        freeKmPerDay: 'Unlimited km',
        stockStatus: '🟢 15 Scooters Ready for Instant Doorstep Drop',
        stockUnits: 15,
        pickupHubs: ['Doorstep Delivery to any Resort', 'Madgaon Railway Station', 'Baga Beach Hub'],
        features: ['Full Tank on Handover', 'Spacious Boot Space for Towels/Bags', 'Zero Hassle Verification']
      }
    ];
  }

  // Region 2: MANALI / HIMACHAL / HILLS / LEH / MOUNTAINS
  if (norm.includes('manali') || norm.includes('shimla') || norm.includes('leh') || norm.includes('ladakh') || norm.includes('dharamshala') || norm.includes('rishikesh')) {
    return [
      {
        id: 'hill-car-fortuner',
        category: 'cars',
        bodyType: '4x4 Off-roader',
        name: 'Toyota Fortuner 4x4 Sigma 4 AT',
        brand: 'Toyota',
        regionalTag: 'Himalayan High Pass King',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80',
        transmission: 'Automatic',
        fuelType: 'Diesel',
        mileageOrRange: '11.5 km/l',
        seats: 7,
        luggageCapacity: '5 Large Bags',
        rating: 4.9,
        tripsCompleted: 260,
        pricePerDayINR: 4900,
        securityDepositINR: 2000,
        freeKmPerDay: '350 km/day included',
        stockStatus: '🟢 2 Units Available for Rohtang & Spiti Circuit',
        stockUnits: 2,
        pickupHubs: ['Mall Road Depot', 'Bhuntar Airport (KUU)', 'Solang Valley Center'],
        features: ['High Altitude Torque', 'Snow Chains Included in Winter', 'Hill Descent Assist']
      },
      {
        id: 'hill-car-scorpio',
        category: 'cars',
        bodyType: 'Compact SUV',
        name: 'Mahindra Scorpio-N 4XPLOR 4WD',
        brand: 'Mahindra',
        regionalTag: 'Rugged Mountain Climber',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
        transmission: 'Manual',
        fuelType: 'Diesel',
        mileageOrRange: '13 km/l',
        seats: 7,
        luggageCapacity: '3 Bags',
        rating: 4.8,
        tripsCompleted: 340,
        pricePerDayINR: 3500,
        securityDepositINR: 1000,
        freeKmPerDay: '300 km/day',
        stockStatus: '🟢 3 Units Ready with Hill Permits',
        stockUnits: 3,
        pickupHubs: ['Old Manali Bridge', 'Chandigarh Airport Hub'],
        features: ['Terrain Management System (Snow/Mud/Sand)', 'High Ground Clearance 200mm', 'Roof Carrier Fitted']
      },
      {
        id: 'hill-bike-himalayan',
        category: 'bikes',
        bodyType: 'Adventure Tourer',
        name: 'Royal Enfield Himalayan 450 Sherpa',
        brand: 'Royal Enfield',
        regionalTag: 'Rohtang & Atal Tunnel Specialist',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=600&q=80',
        transmission: 'Manual',
        fuelType: 'Petrol',
        mileageOrRange: '30 km/l',
        seats: 2,
        rating: 5.0,
        tripsCompleted: 620,
        pricePerDayINR: 1450,
        securityDepositINR: 1000,
        freeKmPerDay: 'Unlimited km on Mountain Circuit',
        stockStatus: '🟢 6 Units Available with Pannier Luggage Mounts',
        stockUnits: 6,
        pickupHubs: ['Old Manali Clubhouse Road', 'Vashisht Stand'],
        features: ['Full TFT Google Maps Navigation', 'Spoke Wheels with Off-road CEAT Tyres', 'Panniers & Saddle Stays Ready']
      },
      {
        id: 'hill-bike-classic',
        category: 'bikes',
        bodyType: 'Cruiser Bike',
        name: 'Royal Enfield Classic 350 Gunmetal Grey',
        brand: 'Royal Enfield',
        regionalTag: 'Himachal Valley Thumper',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
        transmission: 'Manual',
        fuelType: 'Petrol',
        mileageOrRange: '37 km/l',
        seats: 2,
        rating: 4.8,
        tripsCompleted: 890,
        pricePerDayINR: 950,
        securityDepositINR: 500,
        freeKmPerDay: 'Unlimited km',
        stockStatus: '🟢 5 Units Ready in Manali Center',
        stockUnits: 5,
        pickupHubs: ['Mall Road Stand', 'Private Hotel Delivery'],
        features: ['Dual-channel ABS for wet mountain tarmac', 'USB Port', '2 Studds Helmets']
      }
    ];
  }

  // Region 3: DELHI / NCR / AGRA / JAIPUR (Golden Triangle & Plains)
  if (norm.includes('delhi') || norm.includes('jaipur') || norm.includes('agra') || norm.includes('udaipur') || norm.includes('noida') || norm.includes('gurugram')) {
    return [
      {
        id: 'gt-car-innova',
        category: 'cars',
        bodyType: 'Compact SUV',
        name: 'Toyota Innova Hycross Hybrid AT',
        brand: 'Toyota',
        regionalTag: 'Expressway & Palace Touring',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
        transmission: 'Automatic',
        fuelType: 'Hybrid',
        mileageOrRange: '23 km/l',
        seats: 7,
        luggageCapacity: '5 Large Bags',
        rating: 4.9,
        tripsCompleted: 510,
        pricePerDayINR: 3600,
        securityDepositINR: 0,
        freeKmPerDay: '350 km/day included',
        stockStatus: '🟢 4 Units Available at Delhi IGI Airport (T3) & Jaipur Airport',
        stockUnits: 4,
        pickupHubs: ['Delhi Airport Terminal 3', 'Jaipur Airport Desk', 'New Delhi Railway Station (Paharganj)'],
        features: ['Strong Hybrid Fuel Saver (23 km/l)', 'Ottoman Captain Reclining Seats', 'Fastag Pre-loaded', 'Smooth Highway Pilot']
      },
      {
        id: 'gt-car-swift',
        category: 'cars',
        bodyType: 'Hatchback',
        name: 'Maruti Suzuki Swift ZXi DualJet',
        brand: 'Maruti Suzuki',
        regionalTag: 'City Bazaars & Monument Hopping',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80',
        transmission: 'Manual',
        fuelType: 'Petrol',
        mileageOrRange: '22 km/l',
        seats: 5,
        luggageCapacity: '2 Bags',
        rating: 4.7,
        tripsCompleted: 820,
        pricePerDayINR: 1450,
        securityDepositINR: 0,
        freeKmPerDay: '300 km/day',
        stockStatus: '🟢 9 Units Ready across NCR & Jaipur Hubs',
        stockUnits: 9,
        pickupHubs: ['Connaught Place Inner Circle', 'Jaipur Railway Station', 'Noida Sector 18'],
        features: ['Easy to park in narrow Old Delhi / Jaipur walled city', 'Wireless Apple CarPlay', 'Chilled AC']
      },
      {
        id: 'gt-car-thar',
        category: 'cars',
        bodyType: '4x4 Off-roader',
        name: 'Mahindra Thar Earth Edition 4x4',
        brand: 'Mahindra',
        regionalTag: 'Rajasthan Desert Safari Ready',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80',
        transmission: 'Automatic',
        fuelType: 'Diesel',
        mileageOrRange: '13.5 km/l',
        seats: 4,
        luggageCapacity: '2 Bags',
        rating: 4.9,
        tripsCompleted: 290,
        pricePerDayINR: 3400,
        securityDepositINR: 0,
        freeKmPerDay: 'Unlimited km',
        stockStatus: '🟢 3 Units Available in Jaipur & Delhi',
        stockUnits: 3,
        pickupHubs: ['Jaipur MI Road Hub', 'Aerocity Delhi Parking'],
        features: ['Dune-bashing Mode', 'Convertible Hardtop', 'Zero Security Deposit']
      },
      {
        id: 'gt-bike-meteor',
        category: 'bikes',
        bodyType: 'Cruiser Bike',
        name: 'Royal Enfield Meteor 350 Stellar Blue',
        brand: 'Royal Enfield',
        regionalTag: 'Highway Long-Haul Cruiser',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
        transmission: 'Manual',
        fuelType: 'Petrol',
        mileageOrRange: '38 km/l',
        seats: 2,
        rating: 4.8,
        tripsCompleted: 440,
        pricePerDayINR: 850,
        securityDepositINR: 0,
        freeKmPerDay: 'Unlimited km',
        stockStatus: '🟢 6 Units Available at Karol Bagh & Jaipur',
        stockUnits: 6,
        pickupHubs: ['Karol Bagh Metro Gate 4', 'Jaipur Sindhi Camp Stand'],
        features: ['Tripper Turn-by-Turn Navigation', 'Windshield Screen', 'Pillion Backrest Fitted']
      }
    ];
  }

  // Region 4: BENGALURU / HYDERABAD / PUNE (Tech Hubs & Western Ghats)
  if (norm.includes('bengaluru') || norm.includes('bangalore') || norm.includes('hyderabad') || norm.includes('pune') || norm.includes('mysuru') || norm.includes('coorg') || norm.includes('ooty')) {
    return [
      {
        id: 'tech-car-nexon-ev',
        category: 'cars',
        bodyType: 'EV Smart',
        name: 'Tata Nexon EV Empowered Plus LR',
        brand: 'Tata',
        regionalTag: 'Eco Ghats & Tech Corridor EV',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
        transmission: 'Direct Drive EV',
        fuelType: 'Electric',
        mileageOrRange: '465 km Real Range',
        seats: 5,
        luggageCapacity: '3 Bags',
        rating: 4.9,
        tripsCompleted: 390,
        pricePerDayINR: 2500,
        securityDepositINR: 0,
        freeKmPerDay: 'Unlimited km (Free Charging at Tata Power Hubs)',
        stockStatus: '🟢 4 Units with 100% Charge at BLR Airport & Indiranagar',
        stockUnits: 4,
        pickupHubs: ['Kempegowda Airport Terminal', 'Indiranagar Metro Depot', 'Koramangala Sony World'],
        features: ['Zero Tailpipe Emission', 'Free DC Fast Charging Card Included', 'Sunroof & Harman 9-Speaker Audio']
      },
      {
        id: 'tech-car-creta',
        category: 'cars',
        bodyType: 'Compact SUV',
        name: 'Hyundai Creta 1.5 Turbo DCT',
        brand: 'Hyundai',
        regionalTag: 'Coorg / Ooty Highway Touring',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80',
        transmission: 'Automatic',
        fuelType: 'Petrol',
        mileageOrRange: '17 km/l',
        seats: 5,
        luggageCapacity: '3 Bags',
        rating: 4.8,
        tripsCompleted: 530,
        pricePerDayINR: 2800,
        securityDepositINR: 0,
        freeKmPerDay: '350 km/day',
        stockStatus: '🟢 6 Units in Stock across Electronic City & Whitefield',
        stockUnits: 6,
        pickupHubs: ['Whitefield ITPL Depot', 'Electronic City Phase 1'],
        features: ['Level 2 ADAS Safety', 'Fastag Pre-installed', 'Paddle Shifters for Western Ghats']
      },
      {
        id: 'tech-bike-ather',
        category: 'bikes',
        bodyType: 'Scooter',
        name: 'Ather 450X Gen 3 Warp Edition',
        brand: 'Ather',
        regionalTag: 'Smart Electric City Zip',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1597687210367-a4915552d890?auto=format&fit=crop&w=600&q=80',
        transmission: 'Direct Drive EV',
        fuelType: 'Electric',
        mileageOrRange: '110 km Range',
        seats: 2,
        rating: 4.9,
        tripsCompleted: 670,
        pricePerDayINR: 550,
        securityDepositINR: 0,
        freeKmPerDay: 'Unlimited km (Free Ather Grid Charging)',
        stockStatus: '🟢 10 Scooters Ready with Full Battery',
        stockUnits: 10,
        pickupHubs: ['Indiranagar 100ft Road', 'HSR Layout Sector 2', 'MG Road Metro'],
        features: ['Warp Mode 0-40 in 3.3s', 'Touchscreen Google Maps on Dashboard', 'Free Fast Charging across 120 Grid points']
      },
      {
        id: 'tech-bike-interceptor',
        category: 'bikes',
        bodyType: 'Cruiser Bike',
        name: 'Royal Enfield Interceptor 650 Twin',
        brand: 'Royal Enfield',
        regionalTag: 'Western Ghats Twin Thumper',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
        transmission: 'Manual',
        fuelType: 'Petrol',
        mileageOrRange: '24 km/l',
        seats: 2,
        rating: 4.9,
        tripsCompleted: 310,
        pricePerDayINR: 1350,
        securityDepositINR: 0,
        freeKmPerDay: 'Unlimited km',
        stockStatus: '🟢 3 Units Available for Coorg/Chikmagalur Tours',
        stockUnits: 3,
        pickupHubs: ['Koramangala 80ft Road', 'Pune Shivaji Nagar'],
        features: ['648cc Parallel Twin Engine', 'Slipper Clutch & ABS', 'Touring Seat & Bar-end Mirrors']
      }
    ];
  }

  // Region 5: INTERNATIONAL (Paris, Tokyo, Rome, Barcelona, London, etc.)
  if (norm.includes('paris') || norm.includes('rome') || norm.includes('tokyo') || norm.includes('barcelona') || norm.includes('london')) {
    return [
      {
        id: 'intl-car-fiat',
        category: 'cars',
        bodyType: 'Hatchback',
        name: 'Fiat 500 Hybrid / Peugeot 208 Style',
        brand: 'Fiat / Peugeot',
        regionalTag: 'European Cobblestone Specialist',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80',
        transmission: 'Manual',
        fuelType: 'Hybrid',
        mileageOrRange: '24 km/l',
        seats: 4,
        luggageCapacity: '2 Bags',
        rating: 4.8,
        tripsCompleted: 420,
        pricePerDayINR: 3200,
        securityDepositINR: 0,
        freeKmPerDay: 'Unlimited km across Schengen Zone',
        stockStatus: '🟢 5 Units Available at Central Station Depot',
        stockUnits: 5,
        pickupHubs: [`${cityName} Central Train Hub`, `${cityName} International Airport Desk`],
        features: ['Low Emission Zone (Crit\'Air / ZTL) Permit Included', 'Apple CarPlay / GPS', 'Free Cross-border EU Travel']
      },
      {
        id: 'intl-car-bmw',
        category: 'cars',
        bodyType: 'Sedan',
        name: 'BMW 3 Series Touring / Alfa Romeo Tonale',
        brand: 'BMW / Alfa Romeo',
        regionalTag: 'Autobahn & Riviera Grand Tourer',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
        transmission: 'Automatic',
        fuelType: 'Petrol',
        mileageOrRange: '16 km/l',
        seats: 5,
        luggageCapacity: '4 Large Bags',
        rating: 4.9,
        tripsCompleted: 190,
        pricePerDayINR: 5800,
        securityDepositINR: 2500,
        freeKmPerDay: 'Unlimited km',
        stockStatus: '🟢 2 Units Ready with Full Tech Pack',
        stockUnits: 2,
        pickupHubs: [`${cityName} Airport Terminal 2`, 'City Luxury Concierge'],
        features: ['Heads-Up Display', 'Adaptive Cruise Control', 'Full Panoramic Glass Roof']
      },
      {
        id: 'intl-bike-vespa',
        category: 'bikes',
        bodyType: 'Scooter',
        name: 'Vespa Primavera 125cc Italian Heritage',
        brand: 'Vespa',
        regionalTag: 'Iconic Romance & Boulevard Ride',
        city: cityName,
        image: 'https://images.unsplash.com/photo-1597687210367-a4915552d890?auto=format&fit=crop&w=600&q=80',
        transmission: 'CVT',
        fuelType: 'Petrol',
        mileageOrRange: '45 km/l',
        seats: 2,
        rating: 4.9,
        tripsCompleted: 880,
        pricePerDayINR: 1650,
        securityDepositINR: 0,
        freeKmPerDay: 'Unlimited km',
        stockStatus: '🟢 7 Vespas Ready for City Center Cruising',
        stockUnits: 7,
        pickupHubs: [`${cityName} Historic Old Quarter`, `${cityName} Train Station`],
        features: ['2 Vintage Open-Face Helmets', 'Top Box Storage for Bags & Camera', 'ZTL Historic Center Free Access']
      }
    ];
  }

  // DEFAULT REGIONAL FLEET (Fallback for any other city)
  return [
    {
      id: `def-car-creta-${norm}`,
      category: 'cars',
      bodyType: 'Compact SUV',
      name: 'Hyundai Creta / Grand Vitara Smart Hybrid',
      brand: 'Hyundai / Maruti',
      regionalTag: `Verified Regional Fleet for ${cityName}`,
      city: cityName,
      image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
      transmission: 'Automatic',
      fuelType: 'Hybrid',
      mileageOrRange: '19 km/l',
      seats: 5,
      luggageCapacity: '3 Bags',
      rating: 4.8,
      tripsCompleted: 350,
      pricePerDayINR: 2400,
      securityDepositINR: 0,
      freeKmPerDay: '300 km/day included',
      stockStatus: `🟢 4 Units in Stock at ${cityName} Transport Hub`,
      stockUnits: 4,
      pickupHubs: [`${cityName} Railway Station Plaza`, `${cityName} Airport Depot`, 'City Hotel Doorstep Delivery'],
      features: ['Fastag Equipped', 'Comprehensive Zero-Dep Insurance', '24x7 Breakdown Roadside Assistance']
    },
    {
      id: `def-car-swift-${norm}`,
      category: 'cars',
      bodyType: 'Hatchback',
      name: 'Maruti Suzuki Swift ZXi',
      brand: 'Maruti Suzuki',
      regionalTag: `Fuel Efficient City Explorer for ${cityName}`,
      city: cityName,
      image: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=80',
      transmission: 'Manual',
      fuelType: 'Petrol',
      mileageOrRange: '22 km/l',
      seats: 5,
      luggageCapacity: '2 Bags',
      rating: 4.7,
      tripsCompleted: 580,
      pricePerDayINR: 1400,
      securityDepositINR: 0,
      freeKmPerDay: '300 km/day',
      stockStatus: `🟢 6 Units Available Today in ${cityName}`,
      stockUnits: 6,
      pickupHubs: [`${cityName} Bus Terminus`, `${cityName} Train Station`],
      features: ['Chilled Air Conditioning', 'Bluetooth Audio', 'Clean Sanitized Cabin']
    },
    {
      id: `def-bike-classic-${norm}`,
      category: 'bikes',
      bodyType: 'Cruiser Bike',
      name: 'Royal Enfield Classic 350 Stealth Black',
      brand: 'Royal Enfield',
      regionalTag: `Authentic Local Explorer for ${cityName}`,
      city: cityName,
      image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
      transmission: 'Manual',
      fuelType: 'Petrol',
      mileageOrRange: '36 km/l',
      seats: 2,
      rating: 4.9,
      tripsCompleted: 640,
      pricePerDayINR: 850,
      securityDepositINR: 0,
      freeKmPerDay: 'Unlimited km',
      stockStatus: `🟢 5 Bikes Ready for Pickup in ${cityName}`,
      stockUnits: 5,
      pickupHubs: [`${cityName} Center Depot`, `${cityName} Main Junction`],
      features: ['2 ISI Helmets Included', 'Phone Mount with Fast Charger', 'Smooth Highway Ride']
    },
    {
      id: `def-bike-activa-${norm}`,
      category: 'bikes',
      bodyType: 'Scooter',
      name: 'Honda Activa 6G Smart Key',
      brand: 'Honda',
      regionalTag: `Convenient Daily City Scooter for ${cityName}`,
      city: cityName,
      image: 'https://images.unsplash.com/photo-1597687210367-a4915552d890?auto=format&fit=crop&w=600&q=80',
      transmission: 'CVT',
      fuelType: 'Petrol',
      mileageOrRange: '50 km/l',
      seats: 2,
      rating: 4.7,
      tripsCompleted: 980,
      pricePerDayINR: 450,
      securityDepositINR: 0,
      freeKmPerDay: 'Unlimited km',
      stockStatus: `🟢 8 Scooters Ready for Instant Doorstep Handover`,
      stockUnits: 8,
      pickupHubs: [`${cityName} Central Junction`, 'Doorstep Hotel Drop'],
      features: ['Keyless Push Start', 'Under-seat Luggage Box', 'Helmet Included']
    }
  ];
}
