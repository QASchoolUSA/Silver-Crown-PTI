export type UserRole = 'driver' | 'admin';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  companyId: string;
  role: UserRole;
  equipmentTypes?: EquipmentType[];
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  createdAt: string;
}

export type LoadStatus = 'available' | 'in_transit' | 'delivered';
export type EquipmentType = 'Dry Van' | 'Reefer' | 'Flatbed';

export interface Coords {
  latitude: number;
  longitude: number;
}

export interface Load {
  id: string;
  companyId: string;
  assignedDriverId: string | null;
  assignedDriverName?: string;
  origin: string;
  destination: string;
  payout: string;
  miles: string;
  deadhead?: string;
  type: EquipmentType;
  status: LoadStatus;
  originCoords: Coords;
  destCoords: Coords;
  deliveryDate?: string;
  createdAt: string;
}

export type InspectionStatus = 'PASS' | 'DEFECTS FOUND';
export type ItemStatus = 'pass' | 'fail' | null;

export interface InspectionItem {
  name: string;
  status: ItemStatus;
  notes?: string;
  photoUrl?: string;
}

export interface InspectionSection {
  id: string;
  title: string;
  type: 'Truck' | 'Trailer';
  items: InspectionItem[];
}

export interface Inspection {
  id: string;
  companyId: string;
  driverId: string;
  driverName: string;
  truckNumber: string;
  trailerNumber: string | null;
  status: InspectionStatus;
  sections: InspectionSection[];
  signatureUrl?: string;
  createdAt: string;
}

export interface InviteCode {
  id: string;
  code: string;
  companyId: string;
  role: UserRole;
  createdBy: string;
  expiresAt: string;
  usedCount: number;
  maxUses: number;
  createdAt: string;
}

export interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  useEmulators?: boolean;
}

export interface FirebaseInitOptions {
  /** Pass `getReactNativePersistence(AsyncStorage)` on React Native. */
  authPersistence?: import('firebase/auth').Persistence;
}

export interface WeatherAlert {
  id: string;
  event: string;
  severity: string;
  headline: string;
  description: string;
  expires: string;
}

export interface WeatherPeriod {
  name: string;
  startTime: string;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  shortForecast: string;
  isDaytime: boolean;
}

export interface LocationWeather {
  label: string;
  periods: WeatherPeriod[];
  alerts: WeatherAlert[];
  hasAdverseConditions: boolean;
  available: boolean;
}

export interface RouteWeather {
  origin: LocationWeather;
  destination: LocationWeather;
}
