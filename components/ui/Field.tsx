import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";

type FieldWrapperProps = {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
};

export function FieldWrapper({ label, hint, error, htmlFor, children }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-meta text-[11px] uppercase tracking-wide text-graphite">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-graphite">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-vermilion">
          {error}
        </p>
      )}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput(props, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className="border border-carbon/30 bg-white/40 px-3 py-2 font-ui text-sm text-carbon outline-none focus:border-cobalt"
      />
    );
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea(props, ref) {
    return (
      <textarea
        ref={ref}
        {...props}
        className="border border-carbon/30 bg-white/40 px-3 py-2 font-ui text-sm text-carbon outline-none focus:border-cobalt"
      />
    );
  },
);
