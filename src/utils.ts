import { Booking, AGE_GROUPS, DAY_START, DAY_END } from './types';

// Helper to get local date string YYYY-MM-DD
export const getLocalISOString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return getLocalISOString(date);
};

export const addMonths = (dateStr: string, months: number): string => {
  const date = new Date(dateStr + 'T00:00:00');
  date.setMonth(date.getMonth() + months);
  return getLocalISOString(date);
};

// Generate recurring dates
export const generateRecurringDates = (startDate: string, frequency: 'WEEKLY' | 'MONTHLY', untilDate: string): string[] => {
  const dates: string[] = [];
  let current = startDate;

  while (current <= untilDate) {
    dates.push(current);
    if (frequency === 'WEEKLY') {
      current = addDays(current, 7);
    } else {
      current = addMonths(current, 1);
    }
  }
  return dates;
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

// Helper to get booking weight
export const getBookingWeight = (booking: Booking): number => {
  return booking.customWeight !== undefined ? booking.customWeight : AGE_GROUPS[booking.ageGroup].weight;
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
         currentUsage += getBookingWeight(booking);
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
    let approvedUsage = 0;
    let pendingUsage = 0;

    for (const b of bookings) {
      if (b.status === 'DENIED') continue;
      if (b.date !== date) continue;

      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);
      if (bStart <= t && bEnd > t) {
        const weight = getBookingWeight(b);
        if (b.status === 'APPROVED') {
          approvedUsage += weight;
        } else if (b.status === 'PENDING') {
          pendingUsage += weight;
        }
      }
    }
    
    const totalUsage = approvedUsage + pendingUsage;

    data.push({
      time: minutesToTime(t),
      usage: totalUsage, // Legacy support for single-color charts
      approvedUsage,
      pendingUsage,
      percentage: (totalUsage / totalTeachers) * 100
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
        
        // Map to track unique booking IDs per classroom to calculate counts correctly
        const classroomMap = new Map<string, Set<string>>();

        // check every 5 mins within this interval to find peak usage
        for (let subT = t; subT < intervalEnd; subT += 5) {
             let usage = 0;
             for (const b of bookings) {
                 if (b.status === 'DENIED') continue;
                 if (b.date !== date) continue;

                 const bStart = timeToMinutes(b.startTime);
                 const bEnd = timeToMinutes(b.endTime);
                 if (bStart <= subT && bEnd > subT) {
                     usage += getBookingWeight(b);
                     
                     // Don't include blockouts in classroom counts
                     if (b.classroom && b.type !== 'BLOCKOUT') {
                         if (!classroomMap.has(b.classroom)) {
                             classroomMap.set(b.classroom, new Set());
                         }
                         classroomMap.get(b.classroom)!.add(b.id);
                     }
                 }
             }
             if (usage > maxUsage) maxUsage = usage;
        }
        
        // Convert map to formatted array
        const classrooms = Array.from(classroomMap.entries()).map(([name, ids]) => ({
            name,
            count: ids.size
        })).sort((a, b) => a.name.localeCompare(b.name));

        intervals.push({
            startTime: minutesToTime(t),
            endTime: minutesToTime(intervalEnd),
            maxUsage,
            percentage: totalTeachers > 0 ? (maxUsage / totalTeachers) * 100 : 100,
            isFull: maxUsage >= totalTeachers,
            classrooms
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
    
    // Calculate basic peak for visual graph (still useful for shape)
    let maxUsage = 0;
    for (const stat of dailyStats) {
        if (stat.usage > maxUsage) maxUsage = stat.usage;
    }

    // Calculate Available Slots (30 minute increments)
    // Daily stats are in 5 minute increments.
    // 30 mins = 6 increments.
    let availableSlots = 0;
    const chunkSize = 6; // 30 mins / 5 mins
    
    for (let i = 0; i < dailyStats.length; i += chunkSize) {
        const chunk = dailyStats.slice(i, i + chunkSize);
        
        // If the chunk is smaller than 30 mins (end of day), we skip or count it. 
        // Assuming uniform day length, usually fine.
        if (chunk.length === 0) continue;

        // A slot is available if NO 5-min segment within it exceeds capacity
        // Note: usage is continuous. 
        // If max usage in this 30 min window < totalTeachers, it is "open" for at least 1 small child (weight ~0.2)
        // Strictly speaking, we should check if (maxUsage + minWeight <= totalTeachers) but strict check:
        // If usage < totalTeachers, there is at least some space.
        const chunkPeak = Math.max(...chunk.map(s => s.usage));
        
        // We consider a slot "Open" if there is room for at least a preschooler (0.2) or just room in general?
        // Let's say if usage < teacherCount, it's technically open.
        if (chunkPeak < totalTeachers) {
            availableSlots++;
        }
    }
    
    // Only count standard bookings for the "Active Count" display
    const activeCount = bookings.filter(b => b.date === d.value && b.status === 'APPROVED' && b.type !== 'BLOCKOUT').length;
    const pendingCount = bookings.filter(b => b.date === d.value && b.status === 'PENDING').length;

    return {
        date: d.value,
        label: d.label,
        maxUsage,
        percentage: totalTeachers > 0 ? (maxUsage / totalTeachers) * 100 : 0,
        availableSlots,
        activeCount,
        pendingCount,
        usageData: dailyStats
    };
  });
};

// --- Analysis / Breakdown Utils ---

export const getStartOfWeek = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(date);
  monday.setDate(diff);
  return getLocalISOString(monday);
};

export const getEndOfWeek = (dateStr: string) => {
  const start = new Date(getStartOfWeek(dateStr) + 'T00:00:00');
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return getLocalISOString(end);
};

export const getStartOfMonth = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  return getLocalISOString(new Date(date.getFullYear(), date.getMonth(), 1));
};

export const getEndOfMonth = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  return getLocalISOString(new Date(date.getFullYear(), date.getMonth() + 1, 0));
};

export const getBreakdownStats = (bookings: Booking[], scope: 'DAY' | 'WEEK' | 'MONTH', refDate: string) => {
  // 1. Determine Date Range
  let startDate = refDate;
  let endDate = refDate;

  if (scope === 'WEEK') {
    startDate = getStartOfWeek(refDate);
    endDate = getEndOfWeek(refDate);
  } else if (scope === 'MONTH') {
    startDate = getStartOfMonth(refDate);
    endDate = getEndOfMonth(refDate);
  }

  // 2. Filter Bookings - EXCLUDE BLOCKOUTS from Analysis
  const rangeBookings = bookings.filter(b => 
    b.status === 'APPROVED' && b.type !== 'BLOCKOUT' && b.date >= startDate && b.date <= endDate
  );

  // 3. Aggregate Data
  const byClassroom: Record<string, number> = {}; // Name -> Total Hours
  const byAge: Record<string, number> = {}; // Group -> Total Hours
  const uniqueStudents = new Set<string>();
  
  const timeSlotsAccumulator: Record<string, number> = {}; 
  const startMin = timeToMinutes(DAY_START);
  const endMin = timeToMinutes(DAY_END);
  
  // Init accumulator
  for (let t = startMin; t < endMin; t += 5) {
     timeSlotsAccumulator[minutesToTime(t)] = 0;
  }

  // Helper to get booking duration in hours
  const getDurationHours = (start: string, end: string) => {
    return (timeToMinutes(end) - timeToMinutes(start)) / 60;
  };

  const daysWithData = new Set<string>();

  rangeBookings.forEach(b => {
    daysWithData.add(b.date);
    uniqueStudents.add(b.childName + b.parentName); // Simple unique key

    const hours = getDurationHours(b.startTime, b.endTime);
    
    // By Classroom
    const cls = b.classroom || 'Unassigned';
    byClassroom[cls] = (byClassroom[cls] || 0) + hours;

    // By Age
    byAge[b.ageGroup] = (byAge[b.ageGroup] || 0) + hours;

    // By Time (Weighted)
    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime);
    const weight = getBookingWeight(b);

    for (let t = startMin; t < endMin; t += 5) {
       if (bStart <= t && bEnd > t) {
          const timeKey = minutesToTime(t);
          timeSlotsAccumulator[timeKey] = (timeSlotsAccumulator[timeKey] || 0) + weight;
       }
    }
  });

  // Process Time Data
  const numDays = Math.max(1, daysWithData.size);
  const timeData = Object.entries(timeSlotsAccumulator).map(([time, totalWeight]) => ({
    time,
    avgUsage: totalWeight / numDays
  })).sort((a,b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  // Process Categorical Data for Charts
  const classroomData = Object.entries(byClassroom).map(([name, hours]) => ({ name, hours })).sort((a,b) => b.hours - a.hours);
  const ageData = Object.entries(byAge).map(([name, hours]) => ({ name, hours })).sort((a,b) => b.hours - a.hours);
  
  const totalHours = Object.values(byClassroom).reduce((acc, v) => acc + v, 0);

  // Calc Average Daily Load (average of maxes)
  const avgPeakLoad = Math.max(...timeData.map(t => t.avgUsage));

  return {
    startDate,
    endDate,
    totalBookings: rangeBookings.length,
    uniqueStudentCount: uniqueStudents.size,
    totalHours,
    avgPeakLoad,
    timeData,
    classroomData,
    ageData
  };
};