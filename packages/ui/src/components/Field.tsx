import type { InputHTMLAttributes, ReactNode } from 'react';

export interface FieldProps {
  label: ReactNode;
  htmlFor: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, children }: FieldProps) {
  return (
    <div className="hh-field">
      <label htmlFor={htmlFor} className="hh-field__label">
        {label}
      </label>
      {children}
    </div>
  );
}

export type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className, ...rest }: TextInputProps) {
  return <input className={`hh-field__input ${className ?? ''}`.trim()} {...rest} />;
}
