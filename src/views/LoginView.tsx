import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Lock } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

interface LoginViewProps {
  onSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate network delay for realistic feel
    await new Promise(resolve => setTimeout(resolve, 800));

    // Demo password check
    if (password === 'admin') {
        onSuccess();
    } else {
        setError('Invalid passcode. (Hint: admin)');
        setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-12 md:py-20 animate-in fade-in zoom-in duration-300">
      <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 w-full max-w-md relative overflow-hidden">
        
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary"></div>
        
        <div className="text-center mb-8 relative z-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 text-primary rounded-3xl mb-5 transform rotate-3 transition-transform hover:rotate-0">
                <ShieldCheck className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-display font-bold text-slate-800 mb-2">Staff Portal</h2>
            <p className="text-slate-500 text-sm">Secure access for scheduling administration.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <Input 
            label="Access Code" 
            type="password" 
            placeholder="Enter passcode..." 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
            required
            autoFocus
            className="text-lg"
          />
          
          <Button 
            type="submit" 
            className="w-full justify-center py-4 text-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all" 
            disabled={isLoading}
          >
            {isLoading ? (
                <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                    Verifying...
                </span>
            ) : (
                <span className="flex items-center gap-2">
                    Login to Dashboard <ArrowRight className="w-5 h-5" />
                </span>
            )}
          </Button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-slate-50 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <Lock className="w-3 h-3" />
                <span>Authorized personnel only</span>
            </div>
        </div>
      </div>
    </div>
  );
};