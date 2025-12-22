export type AgeGroup = 'Infant' | 'Toddler' | 'Preschooler';

export type BookingStatus = 'PENDING' | 'APPROVED' | 'DENIED';

export interface Booking {
  id: string;
  parentName: string;
  childName: string;
  dob: string; // ISO date string YYYY-MM-DD
  date: string; // ISO date string YYYY-MM-DD (Date of the booking)
  ageGroup: AgeGroup;
  classroom: string;
  startTime: string; // HH:mm format (24h)
  endTime: string;   // HH:mm format (24h)
  status: BookingStatus;
  createdAt: number;
}

export interface AppState {
  bookings: Booking[];
  teacherCount: number;
  currentDate: string; // YYYY-MM-DD
}

export const AGE_GROUPS: Record<AgeGroup, { weight: number; label: string; color: string }> = {
  'Infant': { weight: 0.5, label: 'Infant', color: 'bg-blue-100 text-blue-800' },
  'Toddler': { weight: 0.25, label: 'Toddler', color: 'bg-green-100 text-green-800' },
  'Preschooler': { weight: 0.2, label: 'Preschooler', color: 'bg-purple-100 text-purple-800' },
};

export const DAY_START = "09:00";
export const DAY_END = "13:00";