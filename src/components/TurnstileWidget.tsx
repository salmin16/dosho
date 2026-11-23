'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { Loader2 } from 'lucide-react';

export interface TurnstileWidgetHandle {
  reset: () => void;
}

export interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (message: string) => void;
  onTimeout?: () => void;
  timeoutMs?: number;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

export function getPublicTurnstileSiteKey(): string | null {
  // Static `import.meta.env.*` accesses so Vite statically inlines them in production builds
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
    {
      onVerify,
      onExpire,
      onError,
      onTimeout,
      timeoutMs = 3000,
      theme = 'dark',
      className = '',
    },
    ref
  ) {
    const instanceRef = useRef<TurnstileInstance | null>(null);
    const siteKey = getPublicTurnstileSiteKey();
    const [widgetState, setWidgetState] = useState<
      'loading' | 'ready' | 'verified' | 'timed_out'
    >('loading');

    const onTimeoutRef = useRef(onTimeout);
    onTimeoutRef.current = onTimeout;

    // Strict 3-second fail-open timeout so network latency or ad blockers never hang the UI
    useEffect(() => {
      if (!siteKey || widgetState !== 'loading') return;

      const timer = window.setTimeout(() => {
        setWidgetState((current) => {
          if (current === 'loading') {
            onTimeoutRef.current?.();
            return 'timed_out';
          }
          return current;
        });
      }, timeoutMs);

      return () => window.clearTimeout(timer);
    }, [siteKey, timeoutMs, widgetState]);

    useImperativeHandle(ref, () => ({
      reset() {
        setWidgetState('loading');
        instanceRef.current?.reset();
      },
    }));

    // If no site key is configured or Turnstile failed open after timeout/error, render nothing non-blockingly
    if (!siteKey || widgetState === 'timed_out') {
      return null;
    }

    return (
      <div className={`w-full ${className}`}>
        <div className="relative min-h-[65px] w-full overflow-x-auto rounded-lg">
          {widgetState === 'loading' && (
            <div className="mb-2 flex items-center gap-2 text-xs text-stone">
              <Loader2 size={14} className="animate-spin text-ochre" />
              <span>Verifying browser security…</span>
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
              // Fail open cleanly if blocked by an ad blocker, privacy shield, or hostname mismatch
              setWidgetState('timed_out');
              onTimeoutRef.current?.();
              onError?.('');
            }}
          />
        </div>
      </div>
    );
  }
);

export default TurnstileWidget;
