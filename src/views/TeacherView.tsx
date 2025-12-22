import React, { useMemo, useState } from 'react';
import { AppState, Booking, AGE_GROUPS } from '../types';
import { getDailyUsageStats, getLocalISOString, formatDateDisplay, getTwoWeekOutlookStats } from '../utils';
import { Button } from '../components/Button';
import { Check, X, Users, Settings, ChevronLeft, ChevronRight, Calendar, BarChart3, LayoutGrid } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface TeacherViewProps {
  state: AppState;
  updateBookingStatus: (id: string, status: 'APPROVED' | 'DENIED') => void;
  setTeacherCount: (count: number) => void;
}

export const TeacherView: React.FC<TeacherViewProps> = ({ state, updateBookingStatus, setTeacherCount }) => {
  const [viewMode, setViewMode] = useState<'DAILY' | 'OUTLOOK'>('DAILY');
  const [selectedDate, setSelectedDate] = useState<string>(getLocalISOString());
  
  // Pending bookings are shown globally so teachers don't miss future requests, sorted by date then time
  const pendingBookings = state.bookings
    .filter(b => b.status === 'PENDING')
    .sort((a,b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.createdAt - b.createdAt;
    });

  // Active bookings filtered by the selected date
  const activeBookings = state.bookings
    .filter(b => b.status === 'APPROVED' && b.date === selectedDate);
  
  const usageData = useMemo(() => getDailyUsageStats(state.bookings, state.teacherCount, selectedDate), [state.bookings, state.teacherCount, selectedDate]);
  
  const outlookData = useMemo(() => getTwoWeekOutlookStats(state.bookings, state.teacherCount), [state.bookings, state.teacherCount]);

  const changeDate = (days: number) => {
    const d = new Date(selectedDate + 'T00:00:00'); // Force local time construction
    d.setDate(d.getDate() + days);
    setSelectedDate(getLocalISOString(d));
  };

  const goToDailyView = (date: string) => {
    setSelectedDate(date);
    setViewMode('DAILY');
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-8">
      
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

        <div className="md:col-span-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-2">
            <button 
                onClick={() => setViewMode('DAILY')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${viewMode === 'DAILY' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <BarChart3 className="w-5 h-5" />
                Daily Detail
            </button>
            <button 
                onClick={() => setViewMode('OUTLOOK')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${viewMode === 'OUTLOOK' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <LayoutGrid className="w-5 h-5" />
                2-Week Outlook
            </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
            
            {viewMode === 'DAILY' && (
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
                        <h3 className="font-semibold text-lg mb-6">Capacity Overview</h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={usageData}>
                                    <defs>
                                        <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#FF8FAB" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#FF8FAB" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="time" fontSize={12} tickLine={false} axisLine={false} minTickGap={30} />
                                    <YAxis hide domain={[0, state.teacherCount + 1]} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        labelStyle={{ color: '#64748b' }}
                                    />
                                    <ReferenceLine y={state.teacherCount} stroke="#94a3b8" strokeDasharray="3 3" label={{ position: 'top', value: 'Max Capacity', fill: '#94a3b8', fontSize: 12 }} />
                                    <Area type="monotone" dataKey="usage" stroke="#FF8FAB" fillOpacity={1} fill="url(#colorUsage)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Active Bookings List */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="font-semibold text-lg">Scheduled Students</h3>
                             <span className="text-sm font-medium bg-secondary/30 text-primary px-3 py-1 rounded-full">{activeBookings.length} total</span>
                        </div>
                        
                        {activeBookings.length === 0 ? (
                            <p className="text-slate-400 text-center py-8">No approved bookings for this day.</p>
                        ) : (
                            <div className="space-y-2">
                                {activeBookings.map(booking => (
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
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {viewMode === 'OUTLOOK' && (
                <div className="grid md:grid-cols-2 gap-4">
                    {outlookData.map(day => (
                        <div 
                            key={day.date}
                            onClick={() => goToDailyView(day.date)}
                            className={`p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-md active:scale-95 group
                                ${day.date === getLocalISOString() ? 'ring-2 ring-primary ring-offset-2 border-primary' : 'border-slate-200 bg-white hover:border-primary/50'}
                            `}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="font-bold text-slate-800">{day.label.split(' (')[0]}</div>
                                    <div className="text-xs text-slate-500">{day.date}</div>
                                </div>
                                <div className={`text-xs font-bold px-2 py-1 rounded-full
                                    ${day.percentage >= 100 ? 'bg-red-100 text-red-700' :
                                      day.percentage >= 80 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-green-100 text-green-700'}
                                `}>
                                    {Math.round(day.percentage)}% Peak
                                </div>
                            </div>
                            
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
                                <div 
                                    className={`h-full transition-all ${
                                        day.percentage >= 100 ? 'bg-red-500' :
                                        day.percentage >= 80 ? 'bg-yellow-500' :
                                        'bg-green-500'
                                    }`}
                                    style={{ width: `${Math.min(day.percentage, 100)}%` }}
                                />
                            </div>

                            <div className="flex gap-3 text-xs">
                                <span className="flex items-center gap-1 text-slate-600 font-medium">
                                    <Check className="w-3 h-3 text-green-500" />
                                    {day.activeCount} Approved
                                </span>
                                {day.pendingCount > 0 && (
                                    <span className="flex items-center gap-1 text-primary font-medium">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                                        {day.pendingCount} Pending
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
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
    </div>
  );
};