import React, { useMemo } from 'react';
import { AppState, AGE_GROUPS } from '../types';
import { getTwoWeekOutlookStats, getLocalISOString } from '../utils';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

interface OutlookViewProps {
  state: AppState;
  onSelectDate: (date: string) => void;
  activeDate?: string;
  showAdminStats?: boolean;
}

export const OutlookView: React.FC<OutlookViewProps> = ({ 
  state, 
  onSelectDate, 
  activeDate,
  showAdminStats = false 
}) => {
  const outlookData = useMemo(() => 
    getTwoWeekOutlookStats(state.bookings, state.teacherCount),
  [state.bookings, state.teacherCount]);

  const today = getLocalISOString();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {outlookData.map(day => {
        const isFull = day.availableSlots === 0;
        const isSelected = day.date === activeDate;
        const isToday = day.date === today;

        return (
          <div 
            key={day.date}
            onClick={() => onSelectDate(day.date)}
            className={`p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-lg active:scale-95 group flex flex-col h-full
              ${isSelected ? 'ring-2 ring-primary ring-offset-2 border-primary bg-white shadow-md' : 'border-slate-200 bg-white hover:border-primary/50'}
              ${isToday && !isSelected ? 'border-primary/30' : ''}
              ${isFull && !isSelected ? 'bg-red-50/30' : ''}
            `}
          >
            <div className="flex justify-between items-start mb-1">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                {day.label.split(' (')[0]}
                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" title="Today"></span>}
              </span>
              
              {/* Removed Peak Percentage Badge as requested */}
            </div>
            <span className="text-xs text-slate-400 mb-3">{day.date}</span>
            
            {/* Sparkline Capacity Graph - Kept for visual trend but simplified color */}
            <div className="h-16 w-full mb-3 pointer-events-none opacity-50">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={day.usageData}>
                  <YAxis hide domain={[0, state.teacherCount]} />
                  <Area 
                    type="monotone" 
                    dataKey="usage" 
                    stroke={isFull ? '#F87171' : '#94A3B8'} 
                    fill={isFull ? '#FECACA' : '#E2E8F0'} 
                    fillOpacity={0.4}
                    strokeWidth={2}
                    isAnimationActive={true}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Admin Stats Overlay */}
            {showAdminStats && (
              <div className="flex gap-2 mb-3">
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                  {day.activeCount} Approved
                </span>
                {day.pendingCount > 0 && (
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                    {day.pendingCount} Pending
                  </span>
                )}
              </div>
            )}

            <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between">
              {/* Slots Count instead of 'At Capacity' */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <div className={`w-2 h-2 rounded-full ${isFull ? 'bg-red-400' : 'bg-green-400'}`}></div>
                {day.availableSlots === 0 ? 'No slots open' : `${day.availableSlots} slots open`}
              </div>
              
              <div className="text-primary font-bold text-xs group-hover:translate-x-1 transition-transform">
                {showAdminStats ? 'Details →' : 'Book →'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};