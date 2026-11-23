'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { evaluatePasswordRules } from '../lib/validations/auth';

interface PasswordStrengthChecklistProps {
  password: string;
  confirmPassword?: string;
  dark?: boolean;
}

export default function PasswordStrengthChecklist({
  password,
  confirmPassword,
  dark = false,
}: PasswordStrengthChecklistProps) {
  const evaluation = evaluatePasswordRules(password);
  const showConfirmMatch =
    typeof confirmPassword === 'string' && confirmPassword.length > 0;
  const passwordsMatch = showConfirmMatch && password === confirmPassword;

  const barColor =
    evaluation.score <= 2
      ? 'bg-red-500'
      : evaluation.score === 3
        ? 'bg-amber-500'
        : evaluation.score === 4
          ? 'bg-amber-400'
          : 'bg-emerald-500';

  const labelColor =
    evaluation.score <= 2
      ? 'text-red-500'
      : evaluation.score <= 4
        ? 'text-amber-500'
        : 'text-emerald-500';

  return (
    <div
      className={`mt-2.5 rounded-lg border p-3 text-xs ${
        dark
          ? 'border-slate-800 bg-slate-950/70 text-slate-300'
          : 'border-ink/12 bg-paper/80 text-stone'
      }`}
      aria-live="polite"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider opacity-80">
          Password Security Strength
        </span>
        <span className={`font-mono text-[11px] font-semibold ${password ? labelColor : 'opacity-60'}`}>
          {evaluation.label} ({evaluation.score}/5)
        </span>
      </div>

      <div className="mb-3 grid grid-cols-5 gap-1.5" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={idx}
            className={`h-1.5 rounded-full transition-colors ${
              idx < evaluation.score
                ? barColor
                : dark
                  ? 'bg-slate-800'
                  : 'bg-ink/10'
            }`}
          />
        ))}
      </div>

      <ul className="space-y-1.5">
        {evaluation.rules.map((rule) => (
          <li
            key={rule.id}
            className={`flex items-center gap-2 transition-colors ${
              rule.passed
                ? dark
                  ? 'text-emerald-400 font-medium'
                  : 'text-moss font-medium'
                : dark
                  ? 'text-slate-400'
                  : 'text-stone'
            }`}
          >
            {rule.passed ? (
              <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
            ) : (
              <Circle size={14} className="shrink-0 opacity-45" />
            )}
            <span>{rule.label}</span>
          </li>
        ))}

        {showConfirmMatch && (
          <li
            className={`mt-1 flex items-center gap-2 border-t pt-1.5 ${
              dark ? 'border-slate-800' : 'border-ink/10'
            } ${
              passwordsMatch
                ? dark
                  ? 'text-emerald-400 font-medium'
                  : 'text-moss font-medium'
                : 'text-red-500 font-medium'
            }`}
          >
            {passwordsMatch ? (
              <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
            ) : (
              <Circle size={14} className="shrink-0 text-red-500" />
            )}
            <span>
              {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
