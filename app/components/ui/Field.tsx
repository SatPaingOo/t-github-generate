'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function TextInput({ className = '', error, ...rest }: TextInputProps) {
  return (
    <input
      className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:ring-2 ${
        error
          ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
          : 'border-slate-300 focus:border-indigo-400 focus:ring-indigo-100'
      } ${className}`}
      {...rest}
    />
  );
}
