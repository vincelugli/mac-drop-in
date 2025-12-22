import React, { useState, useMemo } from 'react';
import { AppState, Booking, AGE_GROUPS, DAY_START, DAY_END } from '../types';
import { generateTimeSlots, calculateAgeGroup, checkCapacity, timeToMinutes, getIntervalAvailability, getTwoWeeksDates, getLocalISOString } from '../utils';
import { Button } from '../components/Button';
import { Input, Select } from '../components/Input';
import { Clock, AlertCircle, CheckCircle2, XCircle, Calendar, Baby, School, Users } from 'lucide-react';

interface ParentViewProps {
  state: AppState;
  addBooking: (booking: Booking) => void;
}

export const ParentView: React.FC<ParentViewProps> = ({ state, addBooking }) => {
  const [formData, setFormData] = useState({
    parentName: '',
    childName: '',
    dob: '',
    date: getLocalISOString(),
    classroom: '',
    startTime: DAY_START,
    endTime: '10:00'
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Derived Values
  const ageInfo = useMemo(() => {
    if (!formData.dob) return null;
    return calculateAgeGroup(formData.dob);
  }, [formData.dob]);

  const timeSlots = useMemo(() => generateTimeSlots(DAY_START, DAY_END), []);
  const dateOptions = useMemo(() => getTwoWeeksDates(), []);
  
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ageInfo) {
        setError("Please enter a valid Date of Birth");
        return;
    }
    if (!availabilityCheck?.available) {
        setError(availabilityCheck?.error || "Slot unavailable");
        return;
    }

    const newBooking: Booking = {
        id: crypto.randomUUID(),
        parentName: formData.parentName,
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

    addBooking(newBooking);
    setSuccess(true);
    // Reset child info but keep parent, date and time
    setFormData(prev => ({ ...prev, childName: '', dob: '', classroom: '' })); 
    setTimeout(() => setSuccess(false), 3000);
  };

  const myBookings = state.bookings
    .filter(b => b.parentName === formData.parentName && formData.parentName !== '')
    .sort((a,b) => b.createdAt - a.createdAt);

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-display font-bold text-slate-800 mb-2">Book a Drop-in</h2>
        <p className="text-slate-500">Schedule care between 9:00 AM and 1:00 PM for the next two weeks.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        
        {/* Booking Form */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                New Request
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input 
                    label="Parent Name" 
                    placeholder="Your full name"
                    value={formData.parentName}
                    onChange={e => setFormData({...formData, parentName: e.target.value})}
                    required
                />
                
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
                         <Input 
                            label="Classroom" 
                            placeholder="e.g. Bunnies"
                            value={formData.classroom}
                            onChange={e => setFormData({...formData, classroom: e.target.value})}
                            required
                        />
                    </div>
                </div>

                {/* Live Feedback Section */}
                {ageInfo && (
                    <div className="bg-slate-50 p-3 rounded-lg text-sm space-y-1">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Age Group:</span>
                            <span className="font-medium text-slate-700">{ageInfo.group} ({ageInfo.ageLabel})</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Capacity Cost:</span>
                            <span className="font-medium text-slate-700">{(AGE_GROUPS[ageInfo.group].weight * 100)}% of 1 Teacher</span>
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
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}
                
                {success && (
                    <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Request submitted successfully!
                    </div>
                )}

                <Button 
                    type="submit" 
                    className="w-full mt-4" 
                    disabled={!availabilityCheck?.available || !formData.childName}
                >
                    Submit Request
                </Button>
            </form>
        </div>

        {/* Right Column: Capacity & Requests */}
        <div className="space-y-6">
            
            {/* Availability Overview */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Availability for {dateOptions.find(d => d.value === formData.date)?.label.split(' (')[0]}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    {availabilityData.map(slot => (
                        <div key={slot.startTime} className={`p-2.5 rounded-xl border ${slot.isFull ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="font-medium text-slate-700 text-xs">{slot.startTime}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                    slot.isFull ? 'bg-red-200 text-red-700' : 
                                    slot.percentage > 70 ? 'bg-yellow-100 text-yellow-700' : 
                                    'bg-green-100 text-green-700'
                                }`}>
                                    {slot.isFull ? 'FULL' : slot.percentage > 70 ? 'LIMITED' : 'OPEN'}
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-500 ${
                                        slot.isFull ? 'bg-red-500' : 
                                        slot.percentage > 70 ? 'bg-yellow-500' : 
                                        'bg-green-500'
                                    }`}
                                    style={{ width: `${Math.min(slot.percentage, 100)}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* My Requests */}
            <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Baby className="w-5 h-5 text-secondary" />
                    My Requests {formData.parentName && `(${formData.parentName})`}
                </h3>
                
                {myBookings.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
                        No requests found. Enter your name to see history.
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
                                    <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                                        <School className="w-3 h-3" />
                                        {booking.classroom}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wide
                                        ${booking.status === 'APPROVED' ? 'bg-success text-green-700' : 
                                          booking.status === 'DENIED' ? 'bg-slate-100 text-slate-500' : 
                                          'bg-warning text-yellow-700'}
                                    `}>
                                        {booking.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};