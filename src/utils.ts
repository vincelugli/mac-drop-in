import { Booking, AGE_GROUPS, DAY_START, DAY_END } from './types';

// Helper to get local date string YYYY-MM-DD
export const getLocalISOString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Generate next 14 days
export const getTwoWeeksDates = (): { value: string; label: string }[] => {
  const dates = [];
  const today = new Date();
  
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push({
      value: getLocalISOString(d),
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + (i === 0 ? ' (Today)' : '')
    });
  }
  return dates;
};

export const formatDateDisplay = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00'); // Append time to force local date interpretation or prevent UTC shift issues in simple parsing
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

// Convert HH:mm to minutes from midnight
export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Convert minutes from midnight to HH:mm
export const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

// Generate 5-minute slots between start and end
export const generateTimeSlots = (start: string, end: string): string[] => {
  const slots: string[] = [];
  let current = timeToMinutes(start);
  const endTime = timeToMinutes(end);
  
  while (current <= endTime) {
    slots.push(minutesToTime(current));
    current += 5;
  }
  return slots;
};

// Derive age group from DOB
export const calculateAgeGroup = (dobString: string): { group: 'Infant' | 'Toddler' | 'Preschooler', ageLabel: string } => {
  const dob = new Date(dobString);
  const today = new Date();
  const diffMonths = (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth());
  
  let group: 'Infant' | 'Toddler' | 'Preschooler' = 'Preschooler';
  if (diffMonths < 18) group = 'Infant';
  else if (diffMonths < 36) group = 'Toddler';

  const years = Math.floor(diffMonths / 12);
  const months = diffMonths % 12;
  const ageLabel = years > 0 ? `${years}y ${months}m` : `${months}m`;

  return { group, ageLabel };
};

// Check capacity for a proposed time range
export const checkCapacity = (
  date: string,
  startTime: string,
  endTime: string,
  newBookingWeight: number,
  existingBookings: Booking[],
  totalTeachers: number
): { available: boolean; maxUsage: number; conflictTime?: string } => {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  
  let maxUsage = 0;

  for (let t = startMin; t < endMin; t += 5) {
    let currentUsage = 0;
    
    // Sum active bookings at time t on this specific date
    for (const booking of existingBookings) {
      if (booking.status === 'DENIED') continue;
      if (booking.date !== date) continue; // Skip bookings for other days
      
      const bStart = timeToMinutes(booking.startTime);
      const bEnd = timeToMinutes(booking.endTime);
      
      // If booking covers this slot
      if (bStart <= t && bEnd > t) {
         currentUsage += AGE_GROUPS[booking.ageGroup].weight;
      }
    }

    // Check if adding new booking exceeds capacity
    if (currentUsage + newBookingWeight > totalTeachers) {
      return { available: false, maxUsage: currentUsage, conflictTime: minutesToTime(t) };
    }
    
    if (currentUsage > maxUsage) maxUsage = currentUsage;
  }

  return { available: true, maxUsage };
};

// Get usage data for visualization
export const getDailyUsageStats = (bookings: Booking[], totalTeachers: number, date: string) => {
  const startMin = timeToMinutes(DAY_START);
  const endMin = timeToMinutes(DAY_END);
  const data = [];

  for (let t = startMin; t < endMin; t += 5) {
    let usage = 0;
    for (const b of bookings) {
      if (b.status === 'DENIED') continue;
      if (b.date !== date) continue;

      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);
      if (bStart <= t && bEnd > t) {
        usage += AGE_GROUPS[b.ageGroup].weight;
      }
    }
    data.push({
      time: minutesToTime(t),
      usage,
      percentage: (usage / totalTeachers) * 100
    });
  }
  return data;
};

// Calculate capacity for 30-minute intervals
export const getIntervalAvailability = (bookings: Booking[], totalTeachers: number, date: string) => {
    const startMin = timeToMinutes(DAY_START);
    const endMin = timeToMinutes(DAY_END);
    const intervalSize = 30;
    
    const intervals = [];
    
    for (let t = startMin; t < endMin; t += intervalSize) {
        let maxUsage = 0;
        const intervalEnd = Math.min(t + intervalSize, endMin);
        
        // check every 5 mins within this interval to find peak usage
        for (let subT = t; subT < intervalEnd; subT += 5) {
             let usage = 0;
             for (const b of bookings) {
                 if (b.status === 'DENIED') continue;
                 if (b.date !== date) continue;

                 const bStart = timeToMinutes(b.startTime);
                 const bEnd = timeToMinutes(b.endTime);
                 if (bStart <= subT && bEnd > subT) {
                     usage += AGE_GROUPS[b.ageGroup].weight;
                 }
             }
             if (usage > maxUsage) maxUsage = usage;
        }
        
        intervals.push({
            startTime: minutesToTime(t),
            endTime: minutesToTime(intervalEnd),
            maxUsage,
            percentage: totalTeachers > 0 ? (maxUsage / totalTeachers) * 100 : 100,
            isFull: maxUsage >= totalTeachers
        });
    }
    
    return intervals;
};

// Get outlook stats for the next 14 days
export const getTwoWeekOutlookStats = (bookings: Booking[], totalTeachers: number) => {
  const dates = getTwoWeeksDates();
  
  return dates.map(d => {
    // We reuse getDailyUsageStats logic to find the peak usage for the day
    const dailyStats = getDailyUsageStats(bookings, totalTeachers, d.value);
    
    let maxUsage = 0;
    for (const stat of dailyStats) {
        if (stat.usage > maxUsage) maxUsage = stat.usage;
    }
    
    const activeCount = bookings.filter(b => b.date === d.value && b.status === 'APPROVED').length;
    const pendingCount = bookings.filter(b => b.date === d.value && b.status === 'PENDING').length;

    return {
        date: d.value,
        label: d.label,
        maxUsage,
        percentage: totalTeachers > 0 ? (maxUsage / totalTeachers) * 100 : 0,
        activeCount,
        pendingCount
    };
  });
};