import React, { useState, useEffect } from 'react';
import { AppState, Booking, ParentProfile } from './types';
import { ParentView } from './views/ParentView';
import { TeacherView } from './views/TeacherView';
import { LoginView } from './views/LoginView';
import { ParentLoginView } from './views/ParentLoginView';
import { Sprout } from 'lucide-react';
import { getLocalISOString } from './utils';
import { subscribeToBookings, subscribeToTeacherCount, addBooking, updateBookingStatus, setTeacherCount as saveTeacherCount } from './services';

const INITIAL_STATE: AppState = {
  bookings: [],
  teacherCount: 2,
  currentDate: getLocalISOString(),
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'HOME' | 'PARENT' | 'TEACHER'>('HOME');
  const [appState, setAppState] = useState<AppState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [isTeacherAuthenticated, setIsTeacherAuthenticated] = useState(false);
  const [currentParent, setCurrentParent] = useState<ParentProfile | null>(null);
  const [showParentLogin, setShowParentLogin] = useState(false);

  // Subscribe to Firebase Data
  useEffect(() => {
    const unsubBookings = subscribeToBookings((bookings) => {
      setAppState(prev => ({ ...prev, bookings }));
    });

    const unsubConfig = subscribeToTeacherCount((count) => {
      setAppState(prev => ({ ...prev, teacherCount: count }));
      setLoading(false);
    });

    return () => {
      unsubBookings();
      unsubConfig();
    };
  }, []);

  const handleAddBooking = async (booking: Booking) => {
    try {
        await addBooking(booking);
    } catch (e: any) {
        alert(e.message || "Failed to book");
        throw e;
    }
  };

  const handleUpdateStatus = async (id: string, status: 'APPROVED' | 'DENIED') => {
    const booking = appState.bookings.find(b => b.id === id);
    if (!booking) return;
    await updateBookingStatus(booking, status);
  };

  const handleSetTeacherCount = (count: number) => {
      saveTeacherCount(count);
  };

  if (loading) {
      return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading scheduler...</div>;
  }

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
                    MAC<span className="text-primary">(Multi-age classroom)</span>
                </h1>
            </div>

            <div className="flex gap-2">
                <button 
                    onClick={() => { setCurrentView('PARENT'); setShowParentLogin(false); }}
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
                    Manage capacity, approve requests, and keep your classrooms happy with MAC (Multi-age Classroom) Scheduler.
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
            showParentLogin && !currentParent ? (
                <ParentLoginView 
                    onLogin={(profile) => { setCurrentParent(profile); setShowParentLogin(false); }} 
                    onCancel={() => setShowParentLogin(false)}
                />
            ) : (
                <ParentView 
                    state={appState} 
                    addBooking={handleAddBooking} 
                    parentProfile={currentParent}
                    onLogout={() => setCurrentParent(null)}
                    onLoginClick={() => setShowParentLogin(true)}
                />
            )
        )}

        {currentView === 'TEACHER' && (
            !isTeacherAuthenticated ? (
                <LoginView onSuccess={() => setIsTeacherAuthenticated(true)} />
            ) : (
                <TeacherView state={appState} updateBookingStatus={handleUpdateStatus} setTeacherCount={handleSetTeacherCount} />
            )
        )}

      </main>

    </div>
  );
};

export default App;