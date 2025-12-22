import React, { useState, useEffect } from 'react';
import { AppState, Booking } from './types';
import { ParentView } from './views/ParentView';
import { TeacherView } from './views/TeacherView';
import { Sprout } from 'lucide-react';
import { getLocalISOString } from './utils';

const INITIAL_STATE: AppState = {
  bookings: [],
  teacherCount: 2,
  currentDate: getLocalISOString(),
};

const App: React.FC = () => {
  // Simple view routing state
  const [currentView, setCurrentView] = useState<'HOME' | 'PARENT' | 'TEACHER'>('HOME');
  
  // App Domain State
  // In a real app, this would persist to a DB. For this demo, we use local state.
  const [appState, setAppState] = useState<AppState>(INITIAL_STATE);

  const addBooking = (booking: Booking) => {
    setAppState(prev => ({
      ...prev,
      bookings: [...prev.bookings, booking]
    }));
  };

  const updateBookingStatus = (id: string, status: 'APPROVED' | 'DENIED') => {
    setAppState(prev => ({
      ...prev,
      bookings: prev.bookings.map(b => b.id === id ? { ...b, status } : b)
    }));
  };

  const setTeacherCount = (count: number) => {
      setAppState(prev => ({ ...prev, teacherCount: count }));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* Navigation / Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div 
                className="flex items-center gap-2 cursor-pointer" 
                onClick={() => setCurrentView('HOME')}
            >
                <div className="bg-primary text-white p-1.5 rounded-lg">
                    <Sprout className="w-6 h-6" />
                </div>
                <h1 className="text-xl font-display font-bold text-slate-800 tracking-tight">
                    Little<span className="text-primary">Sprouts</span>
                </h1>
            </div>

            <div className="flex gap-2">
                <button 
                    onClick={() => setCurrentView('PARENT')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${currentView === 'PARENT' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    Parents
                </button>
                <button 
                    onClick={() => setCurrentView('TEACHER')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${currentView === 'TEACHER' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    Teachers
                </button>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-8">
        
        {currentView === 'HOME' && (
            <div className="max-w-4xl mx-auto text-center py-20">
                <div className="inline-flex items-center justify-center p-4 bg-primary/10 text-primary rounded-full mb-6">
                    <Sprout className="w-12 h-12" />
                </div>
                <h1 className="text-5xl font-display font-bold text-slate-900 mb-6">
                    Drop-in scheduling <br/> made <span className="text-primary">simple</span>.
                </h1>
                <p className="text-xl text-slate-500 mb-10 max-w-xl mx-auto">
                    Manage capacity, approve requests, and keep your classrooms happy with LittleSprouts Scheduler.
                </p>
                <div className="flex gap-4 justify-center">
                    <button 
                        onClick={() => setCurrentView('PARENT')}
                        className="px-8 py-4 bg-primary text-white text-lg font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-[#FF7AA0] transition-all transform hover:-translate-y-1"
                    >
                        I'm a Parent
                    </button>
                    <button 
                        onClick={() => setCurrentView('TEACHER')}
                        className="px-8 py-4 bg-white text-slate-700 border-2 border-slate-200 text-lg font-bold rounded-xl hover:border-primary hover:text-primary transition-colors"
                    >
                        Teacher Admin
                    </button>
                </div>
            </div>
        )}

        {currentView === 'PARENT' && (
            <ParentView state={appState} addBooking={addBooking} />
        )}

        {currentView === 'TEACHER' && (
            <TeacherView state={appState} updateBookingStatus={updateBookingStatus} setTeacherCount={setTeacherCount} />
        )}

      </main>

    </div>
  );
};

export default App;