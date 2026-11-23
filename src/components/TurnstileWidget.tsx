'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Loader2, RefreshCw, ShieldAlert } from 'lucide-react';

const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface CloudflareTurnstileRenderOptions {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
  action?: string;
  retry?: 'auto' | 'never';
  'refresh-expired'?: 'auto' | 'manual' | 'never';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: (errorCode?: string) => void;
  'timeout-callback'?: () => void;
}

interface CloudflareTurnstileApi {
  render: (
    container: HTMLElement | string,
    options: CloudflareTurnstileRenderOptions,
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: CloudflareTurnstileApi;
  }
}

let turnstileScriptPromise: Promise<CloudflareTurnstileApi> | null = null;

function loadTurnstileApi(): Promise<CloudflareTurnstileApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Browser environment required for Turnstile.'));
  }

  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise<CloudflareTurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
    );

    const waitForGlobal = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }
      let attempts = 0;
      const poll = window.setInterval(() => {
        attempts += 1;
        if (window.turnstile) {
          window.clearInterval(poll);
          resolve(window.turnstile);
        } else if (attempts >= 50) {
          window.clearInterval(poll);
          turnstileScriptPromise = null;
          reject(new Error('Cloudflare Turnstile failed to initialize.'));
        }
      }, 100);
    };

    if (existing) {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        existing.addEventListener('load', waitForGlobal, { once: true });
        existing.addEventListener(
          'error',
          () => {
            turnstileScriptPromise = null;
            reject(new Error('Failed to load Cloudflare Turnstile script.'));
          },
          { once: true },
        );
        // Also poll in case the existing script already finished loading
        waitForGlobal();
      }
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', waitForGlobal, { once: true });
    script.addEventListener(
      'error',
      () => {
        turnstileScriptPromise = null;
        reject(new Error('Failed to load Cloudflare Turnstile script.'));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

export interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (message: string) => void;
  onTimeout?: () => void;
  timeoutMs?: number;
  action?: string;
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
      action,
      theme = 'light',
      className = '',
    },
    ref,
  ) {
    const siteKey = getPublicTurnstileSiteKey();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);

    const onVerifyRef = useRef(onVerify);
    const onExpireRef = useRef(onExpire);
    const onErrorRef = useRef(onError);
    const onTimeoutRef = useRef(onTimeout);
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;
    onErrorRef.current = onError;
    onTimeoutRef.current = onTimeout;

    const [widgetState, setWidgetState] = useState<
      'loading' | 'ready' | 'verified' | 'expired' | 'error'
    >('loading');
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [renderGeneration, setRenderGeneration] = useState(0);

    const resetWidget = useCallback(() => {
      onExpireRef.current?.();
      setStatusMessage(null);
      if (widgetIdRef.current && window.turnstile) {
        try {
          setWidgetState('ready');
          window.turnstile.reset(widgetIdRef.current);
          return;
        } catch {
          // Fall through to full re-render if widget instance was detached
        }
      }
      setWidgetState('loading');
      setRenderGeneration((g) => g + 1);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        reset: resetWidget,
      }),
      [resetWidget],
    );

    useEffect(() => {
      if (!siteKey) return;
      let cancelled = false;

      setWidgetState('loading');
      setStatusMessage(null);

      void loadTurnstileApi()
        .then((api) => {
          if (cancelled || !containerRef.current) return;

          // Clear any prior widget instance before explicit render
          if (widgetIdRef.current) {
            try {
              api.remove(widgetIdRef.current);
            } catch {
              // ignore cleanup errors
            }
            widgetIdRef.current = null;
          }
          containerRef.current.innerHTML = '';

          const id = api.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            size: 'flexible',
            ...(action ? { action } : {}),
            retry: 'auto',
            'refresh-expired': 'auto',
            callback: (token: string) => {
              if (cancelled) return;
              setWidgetState('verified');
              setStatusMessage(null);
              onVerifyRef.current(token);
            },
            'expired-callback': () => {
              if (cancelled) return;
              setWidgetState('expired');
              setStatusMessage('Security check expired. Refreshing verification…');
              onExpireRef.current?.();
            },
            'timeout-callback': () => {
              if (cancelled) return;
              setWidgetState('expired');
              setStatusMessage('Security verification timed out. Please retry.');
              onExpireRef.current?.();
              onTimeoutRef.current?.();
            },
            'error-callback': () => {
              if (cancelled) return;
              const msg =
                'Security verification could not complete. Please retry or check your network.';
              setWidgetState('error');
              setStatusMessage(msg);
              onExpireRef.current?.();
              onErrorRef.current?.(msg);
            },
          });

          widgetIdRef.current = id;
          setWidgetState((prev) => (prev === 'verified' ? 'verified' : 'ready'));
        })
        .catch(() => {
          if (cancelled) return;
          const msg =
            'Unable to load security verification. Please disable script blockers and retry.';
          setWidgetState('error');
          setStatusMessage(msg);
          onExpireRef.current?.();
          onErrorRef.current?.(msg);
        });

      return () => {
        cancelled = true;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore unmount errors
          }
          widgetIdRef.current = null;
        }
      };
    }, [siteKey, theme, action, renderGeneration]);

    if (!siteKey) {
      return null;
    }

    return (
      <div className={`w-full min-w-0 max-w-full ${className}`}>
        <div className="flex w-full min-w-0 max-w-full flex-col items-center justify-center rounded-lg border border-ink/10 bg-paper/55 px-3 py-2.5">
          {widgetState === 'loading' && (
            <div className="mb-1.5 flex items-center gap-2 font-mono text-[11px] text-stone">
              <Loader2 size={13} className="animate-spin text-ochre" />
              <span>Loading security verification…</span>
            </div>
          )}

          <div
            ref={containerRef}
            className="flex min-h-[65px] w-full min-w-0 max-w-full items-center justify-center overflow-hidden"
          />

          {(widgetState === 'error' || widgetState === 'expired') && (
            <div className="mt-2 flex w-full flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-danger">
                <ShieldAlert size={13} className="shrink-0" />
                <span>{statusMessage || 'Verification expired. Please retry.'}</span>
              </span>
              <button
                type="button"
                onClick={resetWidget}
                className="inline-flex items-center gap-1 rounded-md border border-ink/15 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-ink transition hover:border-ochre hover:text-ochre"
              >
                <RefreshCw size={11} />
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    );
  },
);

export default TurnstileWidget;
