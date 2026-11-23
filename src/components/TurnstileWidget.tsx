'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { ShieldCheck } from 'lucide-react';

export interface TurnstileWidgetHandle {
  reset: () => void;
}

export interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (message: string) => void;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

export function getPublicTurnstileSiteKey(): string | null {
  const metaEnv =
    (import.meta as unknown as { env?: Record<string, string | undefined> })
      .env ?? {};
  const procEnv =
    typeof process !== 'undefined' && process.env ? process.env : {};

  const raw = (
    metaEnv.VITE_TURNSTILE_SITE_KEY ||
    metaEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    procEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    ''
  ).trim();

  if (!raw || raw.includes('your-turnstile-site-key')) {
    return null;
  }
  return raw;
}

export function isTurnstileEnabled(): boolean {
  return getPublicTurnstileSiteKey() !== null;
}

const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget(
    { onVerify, onExpire, onError, theme = 'dark', className = '' },
    ref
  ) {
    const instanceRef = useRef<TurnstileInstance | null>(null);
    const siteKey = getPublicTurnstileSiteKey();

    useImperativeHandle(ref, () => ({
      reset() {
        instanceRef.current?.reset();
      },
    }));

    if (!siteKey) {
      return (
        <div
          className={`flex min-h-[44px] items-center gap-2 rounded-lg border border-amber-500/25 bg-slate-900/5 px-3 py-2 text-xs text-stone ${className}`}
        >
          <ShieldCheck size={15} className="shrink-0 text-amber-600" />
          <span>
            Cloudflare Turnstile ready — set{' '}
            <code className="font-mono text-[11px]">NEXT_PUBLIC_TURNSTILE_SITE_KEY</code>{' '}
            in Vercel to enforce live CAPTCHA verification.
          </span>
        </div>
      );
    }

    return (
      <div className={`min-h-[65px] w-full overflow-x-auto ${className}`}>
        <Turnstile
          ref={instanceRef}
          siteKey={siteKey}
          options={{
            theme,
            size: 'flexible',
          }}
          onSuccess={(token) => onVerify(token)}
          onExpire={() => {
            onExpire?.();
          }}
          onError={() => {
            onError?.('Security check failed to load. Please retry.');
          }}
        />
      </div>
    );
  }
);

export default TurnstileWidget;
