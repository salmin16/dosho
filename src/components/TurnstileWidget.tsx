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
  'error-callback'?: (errorCode?: string | number) => void;
  'timeout-callback'?: () => void;
}

interface CloudflareTurnstileApi {
  ready?: (callback: () => void) => void;
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

function removeExistingTurnstileScripts(): void {
  if (typeof document === 'undefined') return;
  const scripts = document.querySelectorAll<HTMLScriptElement>(
    'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
  );
  scripts.forEach((el) => el.remove());
}

function loadTurnstileApi(
  options: { forceReload?: boolean } = {},
): Promise<CloudflareTurnstileApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Browser environment required for Turnstile.'));
  }

  if (options.forceReload && !window.turnstile) {
    removeExistingTurnstileScripts();
    turnstileScriptPromise = null;
  }

  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise<CloudflareTurnstileApi>((resolve, reject) => {
    let settled = false;
    const finishResolve = (api: CloudflareTurnstileApi) => {
      if (settled) return;
      settled = true;
      resolve(api);
    };
    const finishReject = (reason: Error) => {
      if (settled) return;
      settled = true;
      turnstileScriptPromise = null;
      reject(reason);
    };

    const pollForApi = () => {
      if (window.turnstile) {
        finishResolve(window.turnstile);
        return;
      }
      let attempts = 0;
      const poll = window.setInterval(() => {
        attempts += 1;
        if (window.turnstile) {
          window.clearInterval(poll);
          finishResolve(window.turnstile);
        } else if (attempts >= 80) {
          window.clearInterval(poll);
          removeExistingTurnstileScripts();
          finishReject(new Error('TURNSTILE_INIT_TIMEOUT'));
        }
      }, 100);
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
    );

    if (existing) {
      if (existing.dataset.turnstileFailed === 'true') {
        existing.remove();
      } else {
        existing.addEventListener('load', pollForApi, { once: true });
        existing.addEventListener(
          'error',
          () => {
            existing.dataset.turnstileFailed = 'true';
            existing.remove();
            finishReject(new Error('TURNSTILE_SCRIPT_BLOCKED'));
          },
          { once: true },
        );
        pollForApi();
        return;
      }
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.dataset.mineconnectTurnstile = 'true';
    script.addEventListener('load', pollForApi, { once: true });
    script.addEventListener(
      'error',
      () => {
        script.dataset.turnstileFailed = 'true';
        script.remove();
        finishReject(new Error('TURNSTILE_SCRIPT_BLOCKED'));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

function describeTurnstileError(rawCode?: string | number): {
  message: string;
  codeHint?: string;
} {
  const code = rawCode !== undefined && rawCode !== null ? String(rawCode).trim() : '';
  if (!code) {
    return {
      message: 'Security verification could not complete. Please retry.',
    };
  }
  if (code === '110200') {
    return {
      message: 'Security verification domain mismatch. Please contact support or retry.',
      codeHint: 'Code 110200 (hostname not allowlisted)',
    };
  }
  if (code === '110100' || code === '110110') {
    return {
      message: 'Security widget key configuration error. Please contact support.',
      codeHint: `Code ${code} (sitekey configuration)`,
    };
  }
  if (code === 'TURNSTILE_SCRIPT_BLOCKED') {
    return {
      message: 'Unable to load security verification. Please disable script blockers and retry.',
      codeHint: 'Script blocked or network error',
    };
  }
  if (code === 'TURNSTILE_INIT_TIMEOUT') {
    return {
      message: 'Security verification timed out while loading. Please retry.',
      codeHint: 'Initialization timeout',
    };
  }
  return {
    message: 'Security verification could not complete. Please retry.',
    codeHint: `Code ${code}`,
  };
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
      ? (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim() ||
        (import.meta.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '').trim()
      : '';

  const procSiteKey =
    typeof process !== 'undefined' && process.env
      ? (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '').trim() ||
        (process.env.VITE_TURNSTILE_SITE_KEY || '').trim()
      : '';

  const raw = (viteSiteKey || procSiteKey)
    .replace(/[\r\n]+/g, '')
    .replace(/^["']|["']$/g, '')
    .trim();

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
    const forceReloadNextRef = useRef<boolean>(false);

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
    const [diagnosticHint, setDiagnosticHint] = useState<string | null>(null);
    const [renderGeneration, setRenderGeneration] = useState(0);

    const resetWidget = useCallback(() => {
      onExpireRef.current?.();
      setStatusMessage(null);
      setDiagnosticHint(null);

      if (widgetIdRef.current && window.turnstile) {
        try {
          setWidgetState('ready');
          window.turnstile.reset(widgetIdRef.current);
          return;
        } catch {
          // Fall through to full re-render if widget instance was detached
        }
      }

      // If window.turnstile failed to load, clean stale script tag and reload fresh
      if (!window.turnstile) {
        forceReloadNextRef.current = true;
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
      const shouldForceReload = forceReloadNextRef.current;
      forceReloadNextRef.current = false;

      setWidgetState('loading');
      setStatusMessage(null);
      setDiagnosticHint(null);

      const mountWidget = (api: CloudflareTurnstileApi) => {
        if (cancelled || !containerRef.current) return;

        if (widgetIdRef.current) {
          try {
            api.remove(widgetIdRef.current);
          } catch {
            // ignore cleanup errors
          }
          widgetIdRef.current = null;
        }
        containerRef.current.innerHTML = '';

        try {
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
              setDiagnosticHint(null);
              onVerifyRef.current(token);
            },
            'expired-callback': () => {
              if (cancelled) return;
              setWidgetState('expired');
              setStatusMessage('Security check expired. Refreshing verification…');
              setDiagnosticHint(null);
              onExpireRef.current?.();
            },
            'timeout-callback': () => {
              if (cancelled) return;
              setWidgetState('expired');
              setStatusMessage('Security verification timed out. Please retry.');
              setDiagnosticHint('Challenge timeout');
              onExpireRef.current?.();
              onTimeoutRef.current?.();
            },
            'error-callback': (errorCode?: string | number) => {
              if (cancelled) return;
              const described = describeTurnstileError(errorCode);
              console.warn('[MineConnect Turnstile] Widget error:', {
                errorCode,
                action,
                hostname: typeof window !== 'undefined' ? window.location.hostname : '',
              });
              setWidgetState('error');
              setStatusMessage(described.message);
              setDiagnosticHint(described.codeHint ?? null);
              onExpireRef.current?.();
              onErrorRef.current?.(described.message);
            },
          });

          widgetIdRef.current = id;
          setWidgetState((prev) => (prev === 'verified' ? 'verified' : 'ready'));
        } catch (renderErr) {
          const errMsg =
            renderErr instanceof Error ? renderErr.message : 'Render error';
          console.warn('[MineConnect Turnstile] Render exception:', errMsg);
          setWidgetState('error');
          setStatusMessage('Security verification failed to render. Please retry.');
          setDiagnosticHint(errMsg);
          onExpireRef.current?.();
          onErrorRef.current?.('Security verification failed to render. Please retry.');
        }
      };

      void loadTurnstileApi({ forceReload: shouldForceReload })
        .then((api) => {
          if (cancelled) return;
          if (typeof api.ready === 'function') {
            api.ready(() => mountWidget(api));
          } else {
            mountWidget(api);
          }
        })
        .catch((err) => {
          if (cancelled) return;
          const code = err instanceof Error ? err.message : 'TURNSTILE_SCRIPT_BLOCKED';
          const described = describeTurnstileError(code);
          console.warn('[MineConnect Turnstile] Script load failed:', code);
          setWidgetState('error');
          setStatusMessage(described.message);
          setDiagnosticHint(described.codeHint ?? null);
          onExpireRef.current?.();
          onErrorRef.current?.(described.message);
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
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-start gap-1.5 text-danger">
                  <ShieldAlert size={13} className="mt-0.5 shrink-0" />
                  <span>{statusMessage || 'Verification expired. Please retry.'}</span>
                </span>
                {diagnosticHint && (
                  <span className="mt-0.5 block pl-5 font-mono text-[10px] text-stone">
                    {diagnosticHint}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={resetWidget}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-ink/15 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-ink transition hover:border-ochre hover:text-ochre"
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
