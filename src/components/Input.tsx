import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, className = '', ...props }) => {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {icon}
          </div>
        )}
        <input 
          className={`w-full py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 transition-shadow
            ${icon ? 'pl-10 pr-3' : 'px-3'}
            ${error ? 'border-red-300 focus:ring-red-200' : 'border-slate-200 focus:border-primary focus:ring-secondary'}
          `}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, error, options, className = '', ...props }) => {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <select 
        className={`px-3 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 transition-shadow
          ${error ? 'border-red-300 focus:ring-red-200' : 'border-slate-200 focus:border-primary focus:ring-secondary'}
        `}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
};