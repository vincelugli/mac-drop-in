import React, { useState } from 'react';
import { UserCircle2, ArrowRight, UserPlus, LogIn, ChevronLeft, Mail, Lock } from 'lucide-react';
import { Button } from '../components/Button';
import { Input, Select } from '../components/Input';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, User, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getParentProfile, updateParentProfile } from '../services';
import { ParentProfile, CLASSROOM_OPTIONS } from '../types';

interface ParentLoginViewProps {
  onLogin: (profile: ParentProfile) => void;
  onCancel: () => void;
}

export const ParentLoginView: React.FC<ParentLoginViewProps> = ({ onLogin, onCancel }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Auth Mode: Login vs Signup
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Onboarding State (for new users)
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [profileData, setProfileData] = useState({
    parentName: '',
    childName: '',
    childDob: '',
    childClassroom: ''
  });

  const classroomOptions = CLASSROOM_OPTIONS.map(c => ({ value: c, label: c }));

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      checkProfileAndProceed(user);
    } catch (err: any) {
      console.error(err);
      setError("Google authentication failed. Please try again.");
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let userCredential;
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Signup success -> go to onboarding
        setAuthUser(userCredential.user);
        setProfileData(prev => ({ ...prev, parentName: '' })); // No display name from email signup
        setShowOnboarding(true);
        setIsLoading(false);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        checkProfileAndProceed(userCredential.user);
      }
    } catch (err: any) {
      console.error(err);
      let msg = "Authentication failed.";
      if (err.code === 'auth/invalid-credential') msg = "Invalid email or password.";
      if (err.code === 'auth/email-already-in-use') msg = "Email already in use. Please log in.";
      if (err.code === 'auth/weak-password') msg = "Password should be at least 6 characters.";
      setError(msg);
      setIsLoading(false);
    }
  };

  const checkProfileAndProceed = async (user: User) => {
    try {
      const existingProfile = await getParentProfile(user.uid);
      
      if (existingProfile) {
        onLogin(existingProfile);
      } else {
        // New user, show onboarding
        setAuthUser(user);
        setProfileData(prev => ({ ...prev, parentName: user.displayName || '' }));
        setShowOnboarding(true);
      }
    } catch (err) {
      setError("Failed to retrieve profile.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;

    setError('');
    setIsLoading(true);

    try {
      const newProfile: ParentProfile = {
        name: profileData.parentName || 'Parent',
        email: authUser.email || '',
        children: [{
          name: profileData.childName,
          dob: profileData.childDob,
          classroom: profileData.childClassroom
        }]
      };
      
      await updateParentProfile(authUser.uid, newProfile);
      onLogin(newProfile);
    } catch (err: any) {
      setError("Failed to create profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-12 md:py-20 animate-in fade-in zoom-in duration-300 relative">
      <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 w-full max-w-md">
        
        {!showOnboarding && (
            <button 
                onClick={onCancel}
                className="absolute top-4 left-4 md:left-auto md:right-full md:mr-8 flex items-center text-slate-500 hover:text-slate-800 transition-colors"
            >
                <ChevronLeft className="w-5 h-5 mr-1" /> Back
            </button>
        )}

        <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-secondary/20 text-secondary rounded-full mb-4">
                <UserCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-3xl font-display font-bold text-slate-800 mb-2">
              {showOnboarding ? 'One last step...' : (isSignUp ? 'Create Account' : 'Welcome Back')}
            </h2>
            <p className="text-slate-500 text-sm">
              {showOnboarding 
                ? 'Complete your profile to start booking.' 
                : (isSignUp ? 'Sign up to manage your drop-in schedule.' : 'Sign in to manage your drop-in schedule.')}
            </p>
        </div>

        {showOnboarding ? (
            <form onSubmit={handleCompleteProfile} className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      <UserPlus className="w-4 h-4" /> Profile Information
                    </h4>
                    <Input 
                      label="Parent Name" 
                      value={profileData.parentName}
                      onChange={(e) => setProfileData({...profileData, parentName: e.target.value})}
                      placeholder="Your full name"
                      required
                    />
                    <div className="h-px bg-slate-200 my-2"></div>
                    <Input 
                      label="Child Name" 
                      value={profileData.childName}
                      onChange={(e) => setProfileData({...profileData, childName: e.target.value})}
                      required
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Input 
                          label="Date of Birth" 
                          type="date"
                          value={profileData.childDob}
                          onChange={(e) => setProfileData({...profileData, childDob: e.target.value})}
                          required
                      />
                      <Select 
                          label="Classroom" 
                          options={[{ value: '', label: 'Select...' }, ...classroomOptions]}
                          value={profileData.childClassroom}
                          onChange={(e) => setProfileData({...profileData, childClassroom: e.target.value})}
                          required
                      />
                    </div>
                </div>

                {error && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{error}</div>}

                <Button type="submit" className="w-full justify-center py-3 text-lg mt-2" disabled={isLoading}>
                    {isLoading ? 'Saving...' : <span className="flex items-center gap-2">Complete Profile <ArrowRight className="w-4 h-4"/></span>}
                </Button>
            </form>
        ) : (
            <div className="space-y-4">
                {/* Google Login */}
                <button 
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl transition-all shadow-sm"
                >
                    <div className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-600">G</div>
                    Continue with Google
                </button>

                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-slate-400">or with email</span>
                    </div>
                </div>

                {/* Email Form */}
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div className="space-y-3">
                    <Input 
                      label="Email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      icon={<Mail className="w-4 h-4 text-slate-400" />}
                    />
                    <Input 
                      label="Password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      icon={<Lock className="w-4 h-4 text-slate-400" />}
                    />
                  </div>

                  {error && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{error}</div>}

                  <Button type="submit" className="w-full justify-center py-3" disabled={isLoading}>
                    {isLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
                  </Button>
                </form>

                <div className="text-center text-sm">
                  <button 
                    type="button"
                    onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
                    className="text-primary hover:text-primary/80 font-medium"
                  >
                    {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                  </button>
                </div>

                <div className="text-center pt-2">
                    <button onClick={onCancel} className="text-slate-400 text-xs hover:text-slate-600">
                        Continue as Guest
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};