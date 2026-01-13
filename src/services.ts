import { db } from './firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  runTransaction, 
  query, 
  where,
  setDoc,
  getDoc,
  orderBy
} from 'firebase/firestore';
import { Booking, AGE_GROUPS, ParentProfile } from './types';
import { timeToMinutes, minutesToTime, getBookingWeight, checkCapacity } from './utils';

// Configuration: Check environment
const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Collections: Prefix with 'test_' in development to separate data
const COL_PREFIX = IS_DEV ? 'test_' : '';

const BOOKINGS_COL = `${COL_PREFIX}bookings`;
const DAILY_STATS_COL = `${COL_PREFIX}dailyStats`;
const CONFIG_COL = `${COL_PREFIX}config`;
const PARENTS_COL = `${COL_PREFIX}parents`;

if (IS_DEV) {
  console.log(`%c 🛠️ DEV MODE: Using Test Collections (${BOOKINGS_COL}, etc.) `, 'background: #333; color: #bada55');
}

// --- Subscriptions ---

export const subscribeToBookings = (callback: (bookings: Booking[]) => void) => {
  const q = query(collection(db, BOOKINGS_COL), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const bookings = snapshot.docs.map(doc => doc.data() as Booking);
    callback(bookings);
  });
};

export const subscribeToTeacherCount = (callback: (count: number) => void) => {
  return onSnapshot(doc(db, CONFIG_COL, 'main'), (doc) => {
    if (doc.exists()) {
      callback(doc.data().teacherCount);
    } else {
      callback(2); // Default
    }
  });
};

// --- Actions ---

export const setTeacherCount = async (count: number) => {
  await setDoc(doc(db, CONFIG_COL, 'main'), { teacherCount: count }, { merge: true });
};

export const addBooking = async (booking: Booking) => {
  const statsDocRef = doc(db, DAILY_STATS_COL, booking.date);
  const bookingDocRef = doc(db, BOOKINGS_COL, booking.id);
  const configDocRef = doc(db, CONFIG_COL, 'main');

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Get current stats and config
      const statsDoc = await transaction.get(statsDocRef);
      const configDoc = await transaction.get(configDocRef);

      const teacherCount = configDoc.exists() ? configDoc.data().teacherCount : 2;
      let currentUsage: Record<string, number> = {};

      if (statsDoc.exists()) {
        currentUsage = statsDoc.data().usage || {};
      }

      // 2. Calculate slots needed
      const weight = getBookingWeight(booking);
      const startMin = timeToMinutes(booking.startTime);
      const endMin = timeToMinutes(booking.endTime);
      
      const slotsToUpdate: string[] = [];

      // Iterate every 5 minutes from start (inclusive) to end (exclusive)
      for (let t = startMin; t < endMin; t += 5) {
        const timeKey = minutesToTime(t);
        slotsToUpdate.push(timeKey);
        
        const currentSlotWeight = currentUsage[timeKey] || 0;
        
        if (currentSlotWeight + weight > teacherCount) {
          throw new Error(`Capacity exceeded at ${timeKey}. Please choose a different time.`);
        }
      }

      // 3. Update usage map
      slotsToUpdate.forEach(slot => {
        currentUsage[slot] = (currentUsage[slot] || 0) + weight;
      });

      // 4. Commit writes
      transaction.set(statsDocRef, { usage: currentUsage }, { merge: true });
      transaction.set(bookingDocRef, booking);
    });
  } catch (error) {
    console.error("Booking failed:", error);
    throw error;
  }
};

export const addBatchBookings = async (bookings: Booking[]) => {
  if (bookings.length === 0) return;
  
  const configDocRef = doc(db, CONFIG_COL, 'main');

  try {
    await runTransaction(db, async (transaction) => {
      const configDoc = await transaction.get(configDocRef);
      const teacherCount = configDoc.exists() ? configDoc.data().teacherCount : 2;

      // Group bookings by date to check stats efficiently
      const bookingsByDate: Record<string, Booking[]> = {};
      bookings.forEach(b => {
        if (!bookingsByDate[b.date]) bookingsByDate[b.date] = [];
        bookingsByDate[b.date].push(b);
      });

      const uniqueDates = Object.keys(bookingsByDate);
      const statsDocsRefs = uniqueDates.map(date => doc(db, DAILY_STATS_COL, date));
      const statsDocs = await Promise.all(statsDocsRefs.map(ref => transaction.get(ref)));

      // Helper map to store modified usage before writing
      const modifiedUsageByDate: Record<string, Record<string, number>> = {};

      // Process each date
      for (let i = 0; i < uniqueDates.length; i++) {
        const date = uniqueDates[i];
        const statsDoc = statsDocs[i];
        
        let currentUsage = statsDoc.exists() ? (statsDoc.data().usage || {}) : {};
        if (modifiedUsageByDate[date]) {
             currentUsage = modifiedUsageByDate[date];
        }

        const dateBookings = bookingsByDate[date];

        // Process all bookings for this date
        for (const booking of dateBookings) {
             const weight = getBookingWeight(booking);
             const startMin = timeToMinutes(booking.startTime);
             const endMin = timeToMinutes(booking.endTime);

             for (let t = startMin; t < endMin; t += 5) {
                const timeKey = minutesToTime(t);
                const currentSlotWeight = currentUsage[timeKey] || 0;

                if (currentSlotWeight + weight > teacherCount) {
                     throw new Error(`Capacity exceeded on ${date} at ${timeKey}.`);
                }
                currentUsage[timeKey] = currentSlotWeight + weight;
             }
        }
        modifiedUsageByDate[date] = currentUsage;
      }

      // If we got here, all dates are valid. Commit everything.
      // 1. Write stats
      uniqueDates.forEach((date) => {
           transaction.set(doc(db, DAILY_STATS_COL, date), { usage: modifiedUsageByDate[date] }, { merge: true });
      });

      // 2. Write bookings
      bookings.forEach(booking => {
           transaction.set(doc(db, BOOKINGS_COL, booking.id), booking);
      });
    });
  } catch (error) {
    console.error("Batch booking failed:", error);
    throw error;
  }
};

export const updateBookingStatus = async (booking: Booking, newStatus: 'APPROVED' | 'DENIED') => {
  const bookingDocRef = doc(db, BOOKINGS_COL, booking.id);
  const statsDocRef = doc(db, DAILY_STATS_COL, booking.date);

  try {
    if (newStatus === 'APPROVED') {
      // Just update status, capacity is already reserved
      await setDoc(bookingDocRef, { status: newStatus }, { merge: true });
    } else if (newStatus === 'DENIED') {
      // Need to release capacity
      await runTransaction(db, async (transaction) => {
        const statsDoc = await transaction.get(statsDocRef);
        if (!statsDoc.exists()) {
          // Should not happen if data is consistent, but safety check
           transaction.set(bookingDocRef, { status: newStatus }, { merge: true });
           return;
        }

        const currentUsage = statsDoc.data().usage || {};
        const weight = getBookingWeight(booking);
        const startMin = timeToMinutes(booking.startTime);
        const endMin = timeToMinutes(booking.endTime);

        for (let t = startMin; t < endMin; t += 5) {
          const timeKey = minutesToTime(t);
          if (currentUsage[timeKey]) {
            currentUsage[timeKey] = Math.max(0, currentUsage[timeKey] - weight);
          }
        }

        transaction.set(statsDocRef, { usage: currentUsage }, { merge: true });
        transaction.set(bookingDocRef, { status: newStatus }, { merge: true });
      });
    }
  } catch (error) {
    console.error("Update status failed:", error);
    throw error;
  }
};

// --- Parent Profile Actions ---

export const getParentProfile = async (uid: string): Promise<ParentProfile | null> => {
  const docRef = doc(db, PARENTS_COL, uid);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data() as ParentProfile;
  }
  return null;
};

export const updateParentProfile = async (uid: string, profile: ParentProfile) => {
  await setDoc(doc(db, PARENTS_COL, uid), profile, { merge: true });
};
