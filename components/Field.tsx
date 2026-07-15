"use client";

import { forwardRef } from "react";

type BaseProps = {
  label: string;
  hint?: string;
  error?: boolean;
};

type InputProps = BaseProps &
  React.InputHTMLAttributes<HTMLInputElement> & { as?: "input" };
type TextareaProps = BaseProps &
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { as: "textarea" };

const fieldClass = (error?: boolean) =>
  `w-full font-sans text-sm text-[var(--ink)] bg-[var(--field)] border rounded-[10px] px-3 py-2.5 outline-none transition-colors focus:ring-2 ${
    error
      ? "border-[var(--danger)] ring-2 ring-[var(--danger-soft)] focus:border-[var(--danger)] focus:ring-[var(--danger-soft)]"
      : "border-[var(--field-bd)] focus:border-[var(--accent)] focus:ring-[var(--accent-line)]"
  }`;

export const Field = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps | TextareaProps>(
  function Field(props, ref) {
    const { label, hint, error, as, ...rest } = props;
    return (
      <div>
        <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1.5">
          {label}
        </label>
        {as === "textarea" ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            className={`${fieldClass(error)} resize-y min-h-[74px] leading-relaxed`}
            {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            type="text"
            className={fieldClass(error)}
            {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
          />
        )}
        {hint && <p className="text-xs text-[var(--faint)] mt-1">{hint}</p>}
      </div>
    );
  }
);
