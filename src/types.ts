
export type AgeGroup = 'Infant' | 'Toddler' | 'Preschooler';

export type BookingStatus = 'PENDING' | 'APPROVED' | 'DENIED';

export type BookingType = 'STANDARD' | 'BLOCKOUT';

export interface Booking {
  id: string;
  parentName: string; // For Blockouts, this acts as the "Reason"
  parentEmail?: string; // Contact email for the booking
  childName: string;  // For Blockouts, this acts as a label like "BLOCKED"
  dob: string; // ISO date string YYYY-MM-DD
  date: string; // ISO date string YYYY-MM-DD (Date of the booking)
  ageGroup: AgeGroup;
  classroom: string;
  startTime: string; // HH:mm format (24h)
  endTime: string;   // HH:mm format (24h)
  status: BookingStatus;
  createdAt: number;
  type?: BookingType;
  customWeight?: number; // Overrides age group weight for blockouts
  notes?: string;
}

export interface Child {
  name: string;
  dob: string;
  classroom: string;
}

export interface ParentProfile {
  name: string;
  email: string;
  children: Child[];
}

export interface AppState {
  bookings: Booking[];
  teacherCount: number;
  currentDate: string; // YYYY-MM-DD
}

export const AGE_GROUPS: Record<AgeGroup, { weight: number; label: string; color: string }> = {
  'Infant': { weight: 0.5, label: 'Infant', color: 'bg-blue-100 text-blue-800' },
  'Toddler': { weight: 1/3, label: 'Toddler', color: 'bg-green-100 text-green-800' },
  'Preschooler': { weight: 0.2, label: 'Preschooler', color: 'bg-purple-100 text-purple-800' },
};

export const DAY_START = "09:00";
export const DAY_END = "13:00";

export const CLASSROOM_OPTIONS = ['Infants', 'Tots', '2s', '3-5s', 'PreK'];