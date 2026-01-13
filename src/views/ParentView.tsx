import React, { useState, useMemo, useEffect } from 'react';
import { AppState, Booking, AGE_GROUPS, DAY_START, DAY_END, ParentProfile, CLASSROOM_OPTIONS } from '../types';
import { generateTimeSlots, calculateAgeGroup, checkCapacity, timeToMinutes, getIntervalAvailability, getTwoWeeksDates, getLocalISOString } from '../utils';
import { Button } from '../components/Button';
import { Input, Select } from '../components/Input';
import { Clock, AlertCircle, CheckCircle2, XCircle, Calendar, Baby, School, Users, LayoutGrid, Sparkles, LogOut, ChevronDown, LogIn, Mail } from 'lucide-react';
import { OutlookView } from '../components/OutlookView';
import { auth } from '../firebase';

interface ParentViewProps {
  state: AppState;
  addBooking: (booking: Booking) => Promise<void>;
  parentProfile?: ParentProfile | null;
  onLogout?: () => void;
  onLoginClick?: () => void;
}

export const ParentView: React.FC<ParentViewProps> = ({ state, addBooking, parentProfile, onLogout, onLoginClick }) => {
  const [viewMode, setViewMode] = useState<'BOOK' | 'OUTLOOK'>('BOOK');
  const [formData, setFormData] = useState({
    parentName: parentProfile?.name || '',
    parentEmail: parentProfile?.email || '',
    childName: '',
    dob: '',
    date: getLocalISOString(),
    classroom: '',
    startTime: DAY_START,
    endTime: '10:00'
  });
  const [selectedChildIndex, setSelectedChildIndex] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fill from profile
  useEffect(() => {
    if (parentProfile) {
      setFormData(prev => ({ 
          ...prev, 
          parentName: parentProfile.name,
          parentEmail: parentProfile.email
      }));
      if (parentProfile.children.length > 0) {
        // Default to first child
        selectChild(0);
      }
    }
  }, [parentProfile]);

  const selectChild = (index: number) => {
    if (!parentProfile || !parentProfile.children[index]) return;
    const child = parentProfile.children[index];
    setSelectedChildIndex(index);
    setFormData(prev => ({
        ...prev,
        childName: child.name,
        dob: child.dob,
        classroom: child.classroom
    }));
  };

  const handleLogout = async () => {
    await auth.signOut();
    if (onLogout) onLogout();
  };

  // Derived Values
  const ageInfo = useMemo(() => {
    if (!formData.dob) return null;
    return calculateAgeGroup(formData.dob);
  }, [formData.dob]);

  const timeSlots = useMemo(() => generateTimeSlots(DAY_START, DAY_END), []);
  const dateOptions = useMemo(() => getTwoWeeksDates(), []);
  const classroomOptions = useMemo(() => CLASSROOM_OPTIONS.map(c => ({ value: c, label: c })), []);
  
  const availabilityData = useMemo(() => 
    getIntervalAvailability(state.bookings, state.teacherCount, formData.date), 
  [state.bookings, state.teacherCount, formData.date]);

  // Validation on the fly
  const availabilityCheck = useMemo(() => {
    if (!ageInfo) return null;
    
    // Basic validation
    if (timeToMinutes(formData.startTime) >= timeToMinutes(formData.endTime)) {
        return { available: false, error: "End time must be after start time" };
    }

    const weight = AGE_GROUPS[ageInfo.group].weight;
    const check = checkCapacity(
        formData.date,
        formData.startTime, 
        formData.endTime, 
        weight, 
        state.bookings, 
        state.teacherCount
    );

    if (!check.available) {
        return { available: false, error: `Capacity exceeded at ${check.conflictTime}` };
    }
    return { available: true };
  }, [formData.date, formData.startTime, formData.endTime, ageInfo, state.bookings, state.teacherCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!ageInfo) {
        setError("Please enter a valid Date of Birth");
        setIsSubmitting(false);
        return;
    }
    if (!formData.parentEmail) {
        setError("Contact email is required");
        setIsSubmitting(false);
        return;
    }
    if (!availabilityCheck?.available) {
        setError(availabilityCheck?.error || "Slot unavailable");
        setIsSubmitting(false);
        return;
    }

    const newBooking: Booking = {
        id: crypto.randomUUID(),
        parentName: formData.parentName,
        parentEmail: formData.parentEmail,
        childName: formData.childName,
        dob: formData.dob,
        date: formData.date,
        classroom: formData.classroom,
        ageGroup: ageInfo.group,
        startTime: formData.startTime,
        endTime: formData.endTime,
        status: 'PENDING',
        createdAt: Date.now()
    };

    try {
        await addBooking(newBooking);
        setSuccess(true);
        // Reset ONLY child data if manual mode, otherwise keep selected child
        if (!parentProfile) {
            setFormData(prev => ({ ...prev, childName: '', dob: '', classroom: '' })); 
        }
        setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
        setError(e.message || "Could not submit booking. Please try again.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleSelectDateFromOutlook = (date: string) => {
    setFormData(prev => ({ ...prev, date }));
    setViewMode('BOOK');
  };

  const getSlotStatus = (maxUsage: number) => {
    const remaining = state.teacherCount - maxUsage + 0.001; // epsilon for float safety
    const fitsInfant = remaining >= AGE_GROUPS['Infant'].weight;
    const fitsToddler = remaining >= AGE_GROUPS['Toddler'].weight;
    const fitsPreschooler = remaining >= AGE_GROUPS['Preschooler'].weight;

    if (fitsInfant) return { label: 'Open (All)', color: 'bg-green-100 text-green-700', border: 'border-slate-100' };
    if (fitsToddler) return { label: 'Open: Tots & PreK', color: 'bg-yellow-100 text-yellow-800', border: 'border-yellow-100' };
    if (fitsPreschooler) return { label: 'Open: PreK Only', color: 'bg-orange-100 text-orange-800', border: 'border-orange-100' };
    
    return { label: 'FULL', color: 'bg-red-100 text-red-700', border: 'border-red-100' };
  };

  const myBookings = state.bookings
    .filter(b => b.parentName === formData.parentName && formData.parentName !== '')
    .sort((a,b) => b.createdAt - a.createdAt);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      
      {/* Header & View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex-1">
            <h2 className="text-2xl font-display font-bold text-slate-800 mb-1">
                {parentProfile ? `Welcome, ${parentProfile.name.split(' ')[0]}` : 'Schedule Care'}
            </h2>
            <p className="text-slate-500 text-sm hidden md:block">
                {parentProfile ? 'Book a slot for your little one.' : 'Find and book drop-in slots for your child.'}
            </p>
          </div>
          {parentProfile ? (
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-red-500">
                  <LogOut className="w-4 h-4 mr-1" /> Logout
              </Button>
          ) : (
              <Button variant="secondary" size="sm" onClick={onLoginClick} className="whitespace-nowrap">
                  <LogIn className="w-4 h-4 mr-2" /> Login / Save Info
              </Button>
          )}
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-xl">
           <button 
              onClick={() => setViewMode('BOOK')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'BOOK' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
              <Calendar className="w-4 h-4" /> Book
           </button>
           <button 
              onClick={() => setViewMode('OUTLOOK')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'OUTLOOK' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
              <LayoutGrid className="w-4 h-4" /> Outlook
           </button>
        </div>
      </div>

      {viewMode === 'BOOK' ? (
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Booking Form */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  New Request
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Parent Name / Child Selector */}
                  {parentProfile && parentProfile.children.length > 0 ? (
                      <div className="space-y-4 mb-4 pb-4 border-b border-slate-100">
                         <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">Select Child</label>
                            <div className="relative">
                                <select 
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-secondary focus:border-primary"
                                    value={selectedChildIndex}
                                    onChange={(e) => selectChild(Number(e.target.value))}
                                >
                                    {parentProfile.children.map((child, idx) => (
                                        <option key={idx} value={idx}>{child.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                         </div>
                         <Input 
                            label="Parent Name" 
                            value={formData.parentName}
                            readOnly
                            className="opacity-70 bg-slate-50"
                         />
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 gap-4">
                        <Input 
                            label="Parent Name" 
                            placeholder="Your full name"
                            value={formData.parentName}
                            onChange={e => setFormData({...formData, parentName: e.target.value})}
                            required
                        />
                        <Input 
                            label="Email Address"
                            type="email" 
                            placeholder="name@example.com"
                            value={formData.parentEmail}
                            onChange={e => setFormData({...formData, parentEmail: e.target.value})}
                            required
                        />
                      </div>
                  )}
                  
                  <Select 
                      label="Date"
                      options={dateOptions}
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                  />

                  <div className="grid grid-cols-2 gap-4">
                      <Select 
                          label="Start Time"
                          options={timeSlots.slice(0, -1).map(t => ({ value: t, label: t }))}
                          value={formData.startTime}
                          onChange={e => setFormData({...formData, startTime: e.target.value})}
                      />
                      <Select 
                          label="End Time"
                          options={timeSlots.slice(1).map(t => ({ value: t, label: t }))}
                          value={formData.endTime}
                          onChange={e => setFormData({...formData, endTime: e.target.value})}
                      />
                  </div>

                  {(!parentProfile) && (
                     <div className="border-t border-slate-100 my-4 pt-4">
                        <Input 
                            label="Child Name" 
                            placeholder="Child's first name"
                            value={formData.childName}
                            onChange={e => setFormData({...formData, childName: e.target.value})}
                            required
                        />
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <Input 
                                label="Date of Birth" 
                                type="date"
                                value={formData.dob}
                                onChange={e => setFormData({...formData, dob: e.target.value})}
                                required
                            />
                            <Select 
                                label="Classroom" 
                                options={[{ value: '', label: 'Select Classroom' }, ...classroomOptions]}
                                value={formData.classroom}
                                onChange={e => setFormData({...formData, classroom: e.target.value})}
                                required
                            />
                        </div>
                     </div>
                  )}

                  {/* Live Feedback Section */}
                  {ageInfo && (
                      <div className="bg-slate-50 p-3 rounded-lg text-sm space-y-1">
                          <div className="flex justify-between">
                              <span className="text-slate-500">Child:</span>
                              <span className="font-medium text-slate-700">{formData.childName}</span>
                          </div>
                          <div className="flex justify-between">
                              <span className="text-slate-500">Age Group:</span>
                              <span className="font-medium text-slate-700">{ageInfo.group} ({ageInfo.ageLabel})</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
                              <span className="text-slate-500">Availability:</span>
                              {availabilityCheck?.available ? (
                                  <span className="text-green-600 font-bold flex items-center gap-1">
                                      <CheckCircle2 className="w-4 h-4" /> Available
                                  </span>
                              ) : (
                                  <span className="text-red-500 font-bold flex items-center gap-1">
                                      <XCircle className="w-4 h-4" /> {availabilityCheck?.error}
                                  </span>
                              )}
                          </div>
                      </div>
                  )}

                  {error && (
                      <div className="p-3 bg-danger/10 text-red-600 text-sm rounded-lg flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {error}
                      </div>
                  )}
                  
                  {success && (
                      <div className="p-3 bg-success/30 text-green-700 text-sm rounded-lg flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          Request submitted successfully!
                      </div>
                  )}

                  <Button 
                      type="submit" 
                      className="w-full mt-4" 
                      disabled={isSubmitting || !availabilityCheck?.available || !formData.childName}
                  >
                      {isSubmitting ? 'Submitting...' : 'Submit Request'}
                  </Button>
              </form>
          </div>

          {/* Right Column: Capacity & Requests */}
          <div className="space-y-6">
              {/* Availability Overview */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      {dateOptions.find(d => d.value === formData.date)?.label.split(' (')[0]} Availability
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                      {availabilityData.map(slot => {
                          const status = getSlotStatus(slot.maxUsage);
                          
                          return (
                            <div key={slot.startTime} className={`p-2.5 rounded-xl border ${status.border} ${slot.isFull ? 'bg-red-50' : 'bg-slate-50'}`}>
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="font-medium text-slate-700 text-xs">{slot.startTime}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${status.color}`}>
                                        {status.label}
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mb-2">
                                    <div 
                                        className={`h-full transition-all duration-500 ${
                                            slot.isFull ? 'bg-red-500' : 
                                            slot.percentage > 70 ? 'bg-yellow-500' : 
                                            'bg-green-500'
                                        }`}
                                        style={{ width: `${Math.min(slot.percentage, 100)}%` }}
                                    />
                                </div>
                                {/* Booked Classrooms Tags */}
                                {slot.classrooms && slot.classrooms.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {slot.classrooms.map(c => (
                                            <span key={c.name} className="text-[10px] bg-slate-200/60 text-slate-600 px-1.5 py-0.5 rounded leading-tight">
                                                {c.name} <span className="font-semibold text-slate-800">({c.count})</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                          );
                      })}
                  </div>
              </div>

              {/* My Requests - Only for logged in parents */}
              {parentProfile && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Baby className="w-5 h-5 text-secondary" />
                      My History {formData.parentName && `(${formData.parentName})`}
                  </h3>
                  
                  {myBookings.length === 0 ? (
                      <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
                          No history found.
                      </div>
                  ) : (
                      <div className="space-y-3">
                          {myBookings.map(booking => (
                              <div key={booking.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-start">
                                  <div>
                                      <div className="flex items-center gap-2 mb-1">
                                          <span className="font-bold text-slate-800">{booking.childName}</span>
                                          <span className={`text-xs px-2 py-0.5 rounded-full ${AGE_GROUPS[booking.ageGroup].color}`}>
                                              {booking.ageGroup}
                                          </span>
                                      </div>
                                      <div className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">
                                          {booking.date}
                                      </div>
                                      <div className="text-sm text-slate-500 flex items-center gap-2">
                                          <Clock className="w-3 h-3" />
                                          {booking.startTime} - {booking.endTime}
                                      </div>
                                  </div>
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide
                                      ${booking.status === 'APPROVED' ? 'bg-success text-green-700' : 
                                        booking.status === 'DENIED' ? 'bg-slate-100 text-slate-500' : 
                                        'bg-warning text-yellow-700'}
                                  `}>
                                      {booking.status}
                                  </span>
                              </div>
                          ))}
                      </div>
                  )}
                </div>
              )}
          </div>
        </div>
      ) : (
        <OutlookView 
          state={state} 
          onSelectDate={handleSelectDateFromOutlook} 
          activeDate={formData.date}
        />
      )}
    </div>
  );
};