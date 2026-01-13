import React, { useMemo, useState } from 'react';
import { AppState, Booking, AGE_GROUPS, DAY_START, DAY_END, CLASSROOM_OPTIONS } from '../types';
import { getDailyUsageStats, getLocalISOString, formatDateDisplay, getBreakdownStats, generateTimeSlots, timeToMinutes, calculateAgeGroup, generateRecurringDates, addDays } from '../utils';
import { Button } from '../components/Button';
import { Check, X, Users, ChevronLeft, ChevronRight, Calendar, BarChart3, LayoutGrid, History, ArrowRight, PieChart, Clock, School, Baby, Lock, Ban, Trash2, PlusCircle, Repeat } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell, CartesianGrid } from 'recharts';
import { OutlookView } from '../components/OutlookView';
import { Input, Select } from '../components/Input';
import { addBooking, addBatchBookings } from '../services';

interface TeacherViewProps {
  state: AppState;
  updateBookingStatus: (id: string, status: 'APPROVED' | 'DENIED') => void;
  setTeacherCount: (count: number) => void;
}

export const TeacherView: React.FC<TeacherViewProps> = ({ state, updateBookingStatus, setTeacherCount }) => {
  const [viewMode, setViewMode] = useState<'DAILY' | 'OUTLOOK' | 'HISTORY' | 'BREAKDOWN'>('DAILY');
  const [selectedDate, setSelectedDate] = useState<string>(getLocalISOString());
  
  // Breakdown specific state
  const [breakdownScope, setBreakdownScope] = useState<'DAY' | 'WEEK' | 'MONTH'>('WEEK');

  // Blocking Modal State
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState({
      startTime: DAY_START,
      endTime: '10:00',
      reason: 'Lunch / Break',
      capacity: '1'
  });
  const [isBlocking, setIsBlocking] = useState(false);

  // New Booking / Recurrence Modal State
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    parentName: '',
    parentEmail: '',
    childName: '',
    dob: '',
    classroom: '',
    startDate: getLocalISOString(),
    startTime: DAY_START,
    endTime: '10:00',
    recurrence: 'NONE' as 'NONE' | 'WEEKLY' | 'MONTHLY',
    untilDate: addDays(getLocalISOString(), 30)
  });
  const [isBooking, setIsBooking] = useState(false);

  // Pending bookings are shown globally so teachers don't miss future requests, sorted by date then time
  const pendingBookings = state.bookings
    .filter(b => b.status === 'PENDING')
    .sort((a,b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.createdAt - b.createdAt;
    });

  // Active bookings filtered by the selected date (Standard and Blockouts)
  const activeBookings = state.bookings
    .filter(b => b.status === 'APPROVED' && b.date === selectedDate)
    .sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  
  const usageData = useMemo(() => getDailyUsageStats(state.bookings, state.teacherCount, selectedDate), [state.bookings, state.teacherCount, selectedDate]);

  // History Data Calculation
  const historyData = useMemo(() => {
    const today = getLocalISOString();
    // Get unique dates from bookings that are strictly before today
    const pastDates = Array.from(new Set(
        state.bookings
            .filter(b => b.date < today)
            .map(b => b.date)
    )).sort((a, b) => b.localeCompare(a)); // Sort descending (newest history first)

    return pastDates.map(date => {
        const daysBookings = state.bookings.filter(b => b.date === date && b.status === 'APPROVED' && b.type !== 'BLOCKOUT');
        const dailyStats = getDailyUsageStats(state.bookings, state.teacherCount, date); // Pass current teacher count just to generate stats structure
        const peakUsage = Math.max(...dailyStats.map(s => s.usage));
        
        return {
            date,
            totalStudents: daysBookings.length,
            peakUsage,
            bookings: daysBookings
        };
    });
  }, [state.bookings, state.teacherCount]);

  // Breakdown Data Calculation
  const breakdownData = useMemo(() => {
      return getBreakdownStats(state.bookings, breakdownScope, selectedDate);
  }, [state.bookings, breakdownScope, selectedDate]);

  const changeDate = (amount: number) => {
    const d = new Date(selectedDate + 'T00:00:00'); 
    
    if (viewMode === 'BREAKDOWN') {
        if (breakdownScope === 'DAY') d.setDate(d.getDate() + amount);
        if (breakdownScope === 'WEEK') d.setDate(d.getDate() + (amount * 7));
        if (breakdownScope === 'MONTH') d.setMonth(d.getMonth() + amount);
    } else {
        d.setDate(d.getDate() + amount);
    }
    
    setSelectedDate(getLocalISOString(d));
  };

  const goToDailyView = (date: string) => {
    setSelectedDate(date);
    setViewMode('DAILY');
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBlocking(true);
    try {
        const block: Booking = {
            id: crypto.randomUUID(),
            parentName: blockForm.reason, // Used as Reason
            childName: 'BLOCKED',
            dob: selectedDate, // irrelevant
            date: selectedDate,
            ageGroup: 'Preschooler', // irrelevant placeholder
            classroom: 'N/A',
            startTime: blockForm.startTime,
            endTime: blockForm.endTime,
            status: 'APPROVED',
            type: 'BLOCKOUT',
            customWeight: parseFloat(blockForm.capacity),
            createdAt: Date.now()
        };
        await addBooking(block);
        setShowBlockModal(false);
    } catch (err: any) {
        alert(err.message || 'Could not block time');
    } finally {
        setIsBlocking(false);
    }
  };

  const handleScheduleChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBooking(true);

    try {
        const { group } = calculateAgeGroup(bookingForm.dob);
        const datesToBook = bookingForm.recurrence === 'NONE' 
            ? [bookingForm.startDate] 
            : generateRecurringDates(bookingForm.startDate, bookingForm.recurrence, bookingForm.untilDate);

        const newBookings: Booking[] = datesToBook.map(date => ({
            id: crypto.randomUUID(),
            parentName: bookingForm.parentName,
            parentEmail: bookingForm.parentEmail,
            childName: bookingForm.childName,
            dob: bookingForm.dob,
            date: date,
            ageGroup: group,
            classroom: bookingForm.classroom,
            startTime: bookingForm.startTime,
            endTime: bookingForm.endTime,
            status: 'APPROVED', // Teachers schedule directly, so auto-approve
            createdAt: Date.now()
        }));

        await addBatchBookings(newBookings);
        setShowBookingModal(false);
        alert(`Successfully scheduled ${newBookings.length} booking(s).`);
    } catch (err: any) {
        alert(err.message || 'Could not schedule bookings');
    } finally {
        setIsBooking(false);
    }
  };

  const formatBreakdownLabel = () => {
      const start = new Date(breakdownData.startDate + 'T00:00:00');
      const end = new Date(breakdownData.endDate + 'T00:00:00');
      
      if (breakdownScope === 'DAY') return formatDateDisplay(breakdownData.startDate);
      if (breakdownScope === 'MONTH') return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const COLORS = ['#FF8FAB', '#BDB2FF', '#9BF6FF', '#FDFFB6', '#CAFFBF'];
  const timeSlots = useMemo(() => generateTimeSlots(DAY_START, DAY_END), []);
  const classroomOptions = CLASSROOM_OPTIONS.map(c => ({ value: c, label: c }));

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-8 relative">
      
      {/* Top Bar Stats & View Switcher */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
                <p className="text-slate-500 text-sm font-medium">Teachers On Duty</p>
                <div className="flex items-center gap-3 mt-1">
                    <span className="text-3xl font-display font-bold text-slate-800">{state.teacherCount}</span>
                    <div className="flex gap-1">
                        <button onClick={() => setTeacherCount(Math.max(1, state.teacherCount - 1))} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold">-</button>
                        <button onClick={() => setTeacherCount(state.teacherCount + 1)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold">+</button>
                    </div>
                </div>
            </div>
            <div className="p-3 bg-blue-50 text-blue-500 rounded-xl">
                <Users className="w-6 h-6" />
            </div>
        </div>

        <div className="md:col-span-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-2 overflow-x-auto">
            <button 
                onClick={() => setViewMode('DAILY')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all whitespace-nowrap ${viewMode === 'DAILY' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <BarChart3 className="w-5 h-5" />
                Daily Detail
            </button>
            <button 
                onClick={() => setViewMode('OUTLOOK')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all whitespace-nowrap ${viewMode === 'OUTLOOK' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <LayoutGrid className="w-5 h-5" />
                Outlook
            </button>
            <button 
                onClick={() => setViewMode('HISTORY')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all whitespace-nowrap ${viewMode === 'HISTORY' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <History className="w-5 h-5" />
                History
            </button>
            <button 
                onClick={() => setViewMode('BREAKDOWN')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all whitespace-nowrap ${viewMode === 'BREAKDOWN' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <PieChart className="w-5 h-5" />
                Analysis
            </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
            
            {viewMode === 'DAILY' ? (
                <>
                    {/* Date Navigator */}
                    <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <Button variant="ghost" onClick={() => changeDate(-1)}>
                            <ChevronLeft className="w-5 h-5 mr-2" /> Previous
                        </Button>
                        <div className="flex items-center gap-2 font-display font-bold text-xl text-slate-800">
                            <Calendar className="w-5 h-5 text-primary" />
                            {formatDateDisplay(selectedDate)}
                        </div>
                        <Button variant="ghost" onClick={() => changeDate(1)}>
                            Next <ChevronRight className="w-5 h-5 ml-2" />
                        </Button>
                    </div>

                    {/* Chart */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-semibold text-lg">Capacity Overview</h3>
                            <div className="flex items-center gap-3 text-xs font-medium">
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                                    <span>Approved</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-full bg-accent"></div>
                                    <span>Pending</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={usageData}>
                                    <defs>
                                        <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#FF8FAB" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#FF8FAB" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#BDB2FF" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#BDB2FF" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="time" fontSize={12} tickLine={false} axisLine={false} minTickGap={30} />
                                    <YAxis hide domain={[0, state.teacherCount + 1]} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        labelStyle={{ color: '#64748b' }}
                                    />
                                    <ReferenceLine y={state.teacherCount} stroke="#94a3b8" strokeDasharray="3 3" label={{ position: 'top', value: 'Max Capacity', fill: '#94a3b8', fontSize: 12 }} />
                                    
                                    {/* Stacked Areas */}
                                    <Area 
                                        type="monotone" 
                                        dataKey="approvedUsage" 
                                        stackId="1" 
                                        stroke="#FF8FAB" 
                                        fill="url(#colorApproved)" 
                                        name="Approved Load"
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="pendingUsage" 
                                        stackId="1" 
                                        stroke="#BDB2FF" 
                                        fill="url(#colorPending)" 
                                        name="Pending Load"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Active Bookings List */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="font-semibold text-lg">Schedule & Blocks</h3>
                             <div className="flex gap-2 items-center">
                                 <Button size="sm" onClick={() => setShowBookingModal(true)} className="text-xs h-8">
                                     <PlusCircle className="w-3 h-3 mr-1" /> Schedule Child
                                 </Button>
                                 <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setShowBlockModal(true)}>
                                     <Ban className="w-3 h-3 mr-1" /> Block Time
                                 </Button>
                                 <span className="text-sm font-medium bg-secondary/30 text-primary px-3 py-1 rounded-full">{activeBookings.length} total</span>
                             </div>
                        </div>
                        
                        {activeBookings.length === 0 ? (
                            <p className="text-slate-400 text-center py-8">No approved bookings for this day.</p>
                        ) : (
                            <div className="space-y-2">
                                {activeBookings.map(booking => {
                                    if (booking.type === 'BLOCKOUT') {
                                        return (
                                            <div key={booking.id} className="flex items-center justify-between p-3 bg-slate-100 border border-slate-200 rounded-xl transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-200 text-slate-500">
                                                        <Lock className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-700">{booking.parentName}</p>
                                                        <p className="text-xs text-slate-500">{booking.startTime} - {booking.endTime} • Capacity: {booking.customWeight}</p>
                                                    </div>
                                                </div>
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    className="text-slate-400 hover:text-red-500"
                                                    onClick={() => updateBookingStatus(booking.id, 'DENIED')}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={booking.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors border border-slate-100/50">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${AGE_GROUPS[booking.ageGroup].color}`}>
                                                    {booking.childName[0]}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-800">{booking.childName}</p>
                                                    <p className="text-xs text-slate-500">{booking.startTime} - {booking.endTime} • {booking.classroom}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-medium text-slate-500 block">{booking.ageGroup}</span>
                                                <span className="text-xs text-slate-400">{booking.parentName}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            ) : viewMode === 'OUTLOOK' ? (
                <OutlookView 
                    state={state} 
                    onSelectDate={goToDailyView} 
                    activeDate={selectedDate}
                    showAdminStats={true}
                />
            ) : viewMode === 'BREAKDOWN' ? (
                <div className="space-y-6">
                    {/* Controls */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                            {['DAY', 'WEEK', 'MONTH'].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setBreakdownScope(s as any)}
                                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${breakdownScope === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                            <Button variant="ghost" size="sm" onClick={() => changeDate(-1)}><ChevronLeft className="w-5 h-5" /></Button>
                            <span className="font-display font-bold text-slate-800 text-lg px-2">{formatBreakdownLabel()}</span>
                            <Button variant="ghost" size="sm" onClick={() => changeDate(1)}><ChevronRight className="w-5 h-5" /></Button>
                        </div>
                    </div>

                    {/* Metrics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Student Hours</p>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-display font-bold text-primary">{breakdownData.totalHours.toFixed(1)}</span>
                                <span className="text-slate-400 text-sm mb-1">hrs</span>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Unique Students</p>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-display font-bold text-slate-800">{breakdownData.uniqueStudentCount}</span>
                                <span className="text-slate-400 text-sm mb-1">children</span>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Avg Peak Load</p>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-display font-bold text-accent">{breakdownData.avgPeakLoad.toFixed(2)}</span>
                                <span className="text-slate-400 text-sm mb-1">staff req.</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Classroom Breakdown */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                             <h3 className="font-semibold text-slate-800 mb-6 flex items-center gap-2">
                                <School className="w-4 h-4 text-slate-400" /> Hours by Classroom
                             </h3>
                             <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={breakdownData.classroomData} layout="vertical" margin={{ left: 20 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                        <Bar dataKey="hours" radius={[0, 4, 4, 0]} barSize={30}>
                                            {breakdownData.classroomData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                             </div>
                        </div>

                         {/* Age Breakdown */}
                         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                             <h3 className="font-semibold text-slate-800 mb-6 flex items-center gap-2">
                                <Baby className="w-4 h-4 text-slate-400" /> Hours by Age Group
                             </h3>
                             <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={breakdownData.ageData} layout="vertical" margin={{ left: 20 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                        <Bar dataKey="hours" radius={[0, 4, 4, 0]} barSize={30} fill="#BDB2FF">
                                            {breakdownData.ageData.map((entry, index) => (
                                                 <Cell key={`cell-${index}`} fill={entry.name === 'Infant' ? '#9BF6FF' : entry.name === 'Toddler' ? '#CAFFBF' : '#FFC8DD'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                             </div>
                        </div>
                    </div>

                    {/* Time of Day Analysis */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                           <Clock className="w-4 h-4 text-slate-400" /> Average Daily Rhythm
                        </h3>
                        <p className="text-sm text-slate-500 mb-6">Average staffing load required per 5-minute interval across the selected period.</p>
                        
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={breakdownData.timeData}>
                                    <defs>
                                        <linearGradient id="avgUsageGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#FF8FAB" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#FF8FAB" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="time" fontSize={12} tickLine={false} axisLine={false} minTickGap={30} tick={{ fill: '#94a3b8' }} />
                                    <YAxis hide domain={[0, 'auto']} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        labelStyle={{ color: '#64748b' }}
                                        formatter={(value: number) => [value.toFixed(2), 'Avg Load']}
                                    />
                                    <Area type="monotone" dataKey="avgUsage" stroke="#FF8FAB" strokeWidth={3} fill="url(#avgUsageGradient)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            ) : (
                /* HISTORY VIEW */
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="font-display font-bold text-xl text-slate-800 mb-2">Past Enrollment Records</h3>
                        <p className="text-slate-500 text-sm">Review attendance and capacity statistics for previous days.</p>
                    </div>

                    {historyData.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                            <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-400 font-medium">No history available yet.</p>
                            <p className="text-slate-400 text-sm">Past days with bookings will appear here.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {historyData.map(day => (
                                <div key={day.date} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-primary/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center min-w-[80px]">
                                            <div className="text-xs text-slate-500 uppercase font-bold">{new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}</div>
                                            <div className="text-2xl font-display font-bold text-slate-800">{new Date(day.date + 'T00:00:00').getDate()}</div>
                                            <div className="text-xs text-slate-400">{new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-lg text-slate-700">
                                                {day.totalStudents} <span className="text-slate-400 text-base font-normal">Students</span>
                                            </h4>
                                            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                                <Users className="w-4 h-4" />
                                                <span>Peak Staffing Load: <strong>{day.peakUsage.toFixed(1)}</strong></span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => goToDailyView(day.date)}
                                        className="group-hover:bg-primary group-hover:text-white group-hover:border-primary whitespace-nowrap"
                                    >
                                        View Details <ArrowRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Sidebar: Pending Requests */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit sticky top-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center justify-between">
                <span>Pending Inbox</span>
                <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">{pendingBookings.length}</span>
            </h3>
            
            <div className="space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
                {pendingBookings.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm">
                        All caught up! <br/> No pending requests.
                    </div>
                ) : (
                    pendingBookings.map(booking => (
                        <div key={booking.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-slate-800">{booking.childName}</h4>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${AGE_GROUPS[booking.ageGroup].color}`}>
                                    {booking.ageGroup}
                                </span>
                            </div>
                            
                            <div className="text-sm text-slate-600 space-y-1 mb-4">
                                <p className="text-primary font-medium text-xs uppercase tracking-wider">{booking.date}</p>
                                <p>Parent: {booking.parentName}</p>
                                {booking.parentEmail && <p className="text-xs text-slate-400 break-all">{booking.parentEmail}</p>}
                                <p>Time: <span className="font-medium">{booking.startTime} - {booking.endTime}</span></p>
                                <p>Class: {booking.classroom}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                                    onClick={() => updateBookingStatus(booking.id, 'DENIED')}
                                >
                                    <X className="w-4 h-4 mr-1" /> Deny
                                </Button>
                                <Button 
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-600 text-white shadow-green-200"
                                    onClick={() => updateBookingStatus(booking.id, 'APPROVED')}
                                >
                                    <Check className="w-4 h-4 mr-1" /> Approve
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>

      {/* Block Time Modal */}
      {showBlockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6">
                  <div className="flex justify-between items-start mb-6">
                      <div>
                          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                              <Ban className="w-6 h-6 text-slate-400" /> Block Time
                          </h3>
                          <p className="text-sm text-slate-500 mt-1">Reserve capacity for non-student activities.</p>
                      </div>
                      <button onClick={() => setShowBlockModal(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-6 h-6" />
                      </button>
                  </div>

                  <form onSubmit={handleAddBlock} className="space-y-4">
                      <Input 
                        label="Reason" 
                        placeholder="e.g. Lunch, Meeting, Holiday" 
                        value={blockForm.reason}
                        onChange={(e) => setBlockForm({...blockForm, reason: e.target.value})}
                        required
                      />
                      <div className="grid grid-cols-2 gap-4">
                          <Select 
                              label="Start Time"
                              options={timeSlots.slice(0, -1).map(t => ({ value: t, label: t }))}
                              value={blockForm.startTime}
                              onChange={e => setBlockForm({...blockForm, startTime: e.target.value})}
                          />
                          <Select 
                              label="End Time"
                              options={timeSlots.slice(1).map(t => ({ value: t, label: t }))}
                              value={blockForm.endTime}
                              onChange={e => setBlockForm({...blockForm, endTime: e.target.value})}
                          />
                      </div>
                      <Input 
                        label="Capacity to Block" 
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="10"
                        value={blockForm.capacity}
                        onChange={(e) => setBlockForm({...blockForm, capacity: e.target.value})}
                        required
                        className="w-1/2"
                      />
                      
                      <div className="pt-2">
                        <Button type="submit" className="w-full justify-center" disabled={isBlocking}>
                            {isBlocking ? 'Blocking...' : 'Confirm Block'}
                        </Button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Schedule Child Modal */}
      {showBookingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-start mb-6">
                      <div>
                          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                              <PlusCircle className="w-6 h-6 text-slate-400" /> Schedule Child
                          </h3>
                          <p className="text-sm text-slate-500 mt-1">Directly schedule a child (one-time or recurring).</p>
                      </div>
                      <button onClick={() => setShowBookingModal(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-6 h-6" />
                      </button>
                  </div>

                  <form onSubmit={handleScheduleChild} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <Input 
                            label="Parent Name" 
                            value={bookingForm.parentName}
                            onChange={(e) => setBookingForm({...bookingForm, parentName: e.target.value})}
                            required
                          />
                          <Input 
                            label="Parent Email (Optional)" 
                            type="email"
                            value={bookingForm.parentEmail}
                            onChange={(e) => setBookingForm({...bookingForm, parentEmail: e.target.value})}
                          />
                      </div>
                      <Input 
                        label="Child Name" 
                        value={bookingForm.childName}
                        onChange={(e) => setBookingForm({...bookingForm, childName: e.target.value})}
                        required
                      />
                      <div className="grid grid-cols-2 gap-4">
                          <Input 
                              label="Date of Birth" 
                              type="date"
                              value={bookingForm.dob}
                              onChange={(e) => setBookingForm({...bookingForm, dob: e.target.value})}
                              required
                          />
                          <Select 
                              label="Classroom" 
                              options={[{ value: '', label: 'Select...' }, ...classroomOptions]}
                              value={bookingForm.classroom}
                              onChange={(e) => setBookingForm({...bookingForm, classroom: e.target.value})}
                              required
                          />
                      </div>

                      <div className="h-px bg-slate-100 my-2"></div>

                      <div className="grid grid-cols-2 gap-4">
                          <Input 
                              label="Start Date"
                              type="date"
                              value={bookingForm.startDate}
                              onChange={e => setBookingForm({...bookingForm, startDate: e.target.value})}
                              required
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Select 
                                label="From"
                                options={timeSlots.slice(0, -1).map(t => ({ value: t, label: t }))}
                                value={bookingForm.startTime}
                                onChange={e => setBookingForm({...bookingForm, startTime: e.target.value})}
                            />
                            <Select 
                                label="To"
                                options={timeSlots.slice(1).map(t => ({ value: t, label: t }))}
                                value={bookingForm.endTime}
                                onChange={e => setBookingForm({...bookingForm, endTime: e.target.value})}
                            />
                          </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                              <Repeat className="w-4 h-4" /> Recurrence
                          </h4>
                          <div className="flex gap-4">
                              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name="recurrence" 
                                    value="NONE"
                                    checked={bookingForm.recurrence === 'NONE'}
                                    onChange={() => setBookingForm({...bookingForm, recurrence: 'NONE'})}
                                    className="text-primary focus:ring-primary"
                                  />
                                  None
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name="recurrence" 
                                    value="WEEKLY"
                                    checked={bookingForm.recurrence === 'WEEKLY'}
                                    onChange={() => setBookingForm({...bookingForm, recurrence: 'WEEKLY'})}
                                    className="text-primary focus:ring-primary"
                                  />
                                  Weekly
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name="recurrence" 
                                    value="MONTHLY"
                                    checked={bookingForm.recurrence === 'MONTHLY'}
                                    onChange={() => setBookingForm({...bookingForm, recurrence: 'MONTHLY'})}
                                    className="text-primary focus:ring-primary"
                                  />
                                  Monthly
                              </label>
                          </div>

                          {bookingForm.recurrence !== 'NONE' && (
                              <div className="animate-in fade-in slide-in-from-top-2">
                                  <Input 
                                      label="Repeat Until"
                                      type="date"
                                      value={bookingForm.untilDate}
                                      onChange={e => setBookingForm({...bookingForm, untilDate: e.target.value})}
                                      required
                                  />
                                  <p className="text-xs text-slate-400 mt-2">
                                      Bookings will be created for every {bookingForm.recurrence === 'WEEKLY' ? 'week' : 'month'} starting from {bookingForm.startDate} until {bookingForm.untilDate}.
                                  </p>
                              </div>
                          )}
                      </div>
                      
                      <div className="pt-2">
                        <Button type="submit" className="w-full justify-center" disabled={isBooking}>
                            {isBooking ? 'Scheduling...' : 'Confirm Schedule'}
                        </Button>
                      </div>
                  </form>
              </div>
          </div>
      )}

    </div>
  );
};