'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { Loader2, RefreshCw, ShieldAlert } from 'lucide-react';

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
  // Use direct static `import.meta.env.*` accesses so Vite statically inlines them in production builds
  const viteSiteKey =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_TURNSTILE_SITE_KEY ||
        import.meta.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      : undefined;

  const procSiteKey =
    typeof process !== 'undefined' && process.env
      ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
        process.env.VITE_TURNSTILE_SITE_KEY
      : undefined;

  const raw = String(viteSiteKey || procSiteKey || '').trim();

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
    const [widgetState, setWidgetState] = useState<
      'loading' | 'ready' | 'verified' | 'error'
    >('loading');

    const handleReset = () => {
      setWidgetState('loading');
      instanceRef.current?.reset();
    };

    useImperativeHandle(ref, () => ({
      reset() {
        handleReset();
      },
    }));

    // If no Turnstile site key is configured in the environment, do not block or clutter the form
    if (!siteKey) {
      return null;
    }

    return (
      <div className={`w-full space-y-2 ${className}`}>
        <div className="relative min-h-[65px] w-full overflow-x-auto rounded-lg">
          {widgetState === 'loading' && (
            <div className="mb-2 flex items-center gap-2 text-xs text-stone">
              <Loader2 size={14} className="animate-spin text-ochre" />
              <span>Initializing security check…</span>
            </div>
          )}

          <Turnstile
            ref={instanceRef}
            siteKey={siteKey}
            options={{
              theme,
              size: 'flexible',
              retry: 'auto',
              refreshExpired: 'auto',
            }}
            onWidgetLoad={() => {
              setWidgetState((prev) =>
                prev === 'verified' ? 'verified' : 'ready'
              );
            }}
            onSuccess={(token) => {
              setWidgetState('verified');
              onVerify(token);
            }}
            onExpire={() => {
              setWidgetState('ready');
              onExpire?.();
            }}
            onError={() => {
              setWidgetState('error');
              onError?.(
                'Completing security check — please wait a moment or refresh if blocked by an ad blocker.'
              );
            }}
          />
        </div>

        {widgetState === 'error' && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <span className="inline-flex items-center gap-1.5">
              <ShieldAlert size={14} className="shrink-0" />
              Security check could not load. If you use an ad blocker, please allow Cloudflare Turnstile and retry.
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-amber-500/40 px-2.5 py-1 font-semibold transition hover:bg-amber-500/15"
            >
              <RefreshCw size={12} />
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }
);

export default TurnstileWidget;
