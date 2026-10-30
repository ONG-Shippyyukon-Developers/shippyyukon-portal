import { InputHTMLAttributes } from "react";

export function Input({
  label,
  error,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <input
        className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none transition focus:ring-2 focus:ring-brand-500 ${
          error ? "border-red-400" : "border-slate-300"
        } ${className}`}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
