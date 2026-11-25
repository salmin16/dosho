'use client';

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';

const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface CloudflareTurnstileRenderOptions {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
  appearance?: 'always' | 'execute' | 'interaction-only';
  execution?: 'render' | 'execute';
  action?: string;
  retry?: 'auto' | 'never';
  'refresh-expired'?: 'auto' | 'manual' | 'never';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: (errorCode?: string | number) => void;
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

  if (options.forceReload && typeof window.turnstile?.render !== 'function') {
    removeExistingTurnstileScripts();
    turnstileScriptPromise = null;
  }

  if (typeof window.turnstile?.render === 'function') {
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
      if (typeof window.turnstile?.render === 'function') {
        finishResolve(window.turnstile);
        return;
      }
      let attempts = 0;
      const poll = window.setInterval(() => {
        attempts += 1;
        if (typeof window.turnstile?.render === 'function') {
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
    script.async = false;
    script.defer = false;
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
      codeHint: 'Code 110200 (domain configuration)',
    };
  }
  if (code === '110100' || code === '110110') {
    return {
      message: 'Security verification is temporarily unavailable. Please contact support.',
      codeHint: `Code ${code}`,
    };
  }
  if (code === 'TURNSTILE_SCRIPT_BLOCKED') {
    return {
      message: 'Unable to load security verification. Please disable script blockers and retry.',
      codeHint: 'Network or script blocker',
    };
  }
  if (code === 'TURNSTILE_INIT_TIMEOUT') {
    return {
      message: 'Security verification timed out while loading. Please retry.',
      codeHint: 'Load timeout',
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
  /** Called if mobile/cellular Turnstile stalls past timeoutMs or fails so authenticated flows stay non-blocking */
  onFallbackReady?: (reason: 'timeout_or_mobile_challenge') => void;
  /** Enables non-blocking fallback UX when widget stalls on mobile/in-app browsers */
  allowMobileFallback?: boolean;
  /** Incrementing this counter declaratively clears the token and resets the widget */
  resetKey?: number;
  timeoutMs?: number;
  appearance?: 'always' | 'execute' | 'interaction-only';
  execution?: 'render' | 'execute';
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

const TurnstileWidgetInner = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget(
    {
      onVerify,
      onExpire,
      onError,
      onTimeout,
      onFallbackReady,
      allowMobileFallback = false,
      resetKey,
      timeoutMs = 8000,
      appearance = 'interaction-only',
      execution = 'render',
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
    const prevResetKeyRef = useRef<number | undefined>(resetKey);
    const autoRetriedRef = useRef<boolean>(false);

    const onVerifyRef = useRef(onVerify);
    const onExpireRef = useRef(onExpire);
    const onErrorRef = useRef(onError);
    const onTimeoutRef = useRef(onTimeout);
    const onFallbackReadyRef = useRef(onFallbackReady);
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;
    onErrorRef.current = onError;
    onTimeoutRef.current = onTimeout;
    onFallbackReadyRef.current = onFallbackReady;

    const [widgetState, setWidgetState] = useState<
      'loading' | 'ready' | 'verified' | 'expired' | 'error' | 'fallback'
    >('loading');
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [diagnosticHint, setDiagnosticHint] = useState<string | null>(null);
    const [renderGeneration, setRenderGeneration] = useState(0);

    const activateFallbackOrError = useCallback(
      (fallbackMsg: string, hint?: string | null) => {
        if (allowMobileFallback) {
          setWidgetState('fallback');
          setStatusMessage(
            'Mobile browser verification took too long — secured via your signed-in account.',
          );
          setDiagnosticHint(hint ?? 'Mobile fallback active');
          onFallbackReadyRef.current?.('timeout_or_mobile_challenge');
          onTimeoutRef.current?.();
          return;
        }
        setWidgetState('expired');
        setStatusMessage(fallbackMsg);
        setDiagnosticHint(hint ?? null);
        onTimeoutRef.current?.();
      },
      [allowMobileFallback],
    );

    const resetWidget = useCallback(() => {
      autoRetriedRef.current = false;
      onExpireRef.current?.();
      setStatusMessage(null);
      setDiagnosticHint(null);

      if (widgetIdRef.current && typeof window.turnstile?.reset === 'function') {
        try {
          setWidgetState('ready');
          window.turnstile.reset(widgetIdRef.current);
          return;
        } catch {
          // Fall through to clean re-render if instance was detached
        }
      }

      if (typeof window.turnstile?.render !== 'function') {
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

    // Declarative reset support whenever parent increments `resetKey`
    useEffect(() => {
      if (resetKey === undefined) return;
      if (prevResetKeyRef.current !== undefined && prevResetKeyRef.current !== resetKey) {
        resetWidget();
      }
      prevResetKeyRef.current = resetKey;
    }, [resetKey, resetWidget]);

    // 8-second watchdog: auto-retry once around halfway, then trigger non-blocking fallback/retry UI
    useEffect(() => {
      if (!siteKey) return;
      if (widgetState !== 'loading' && widgetState !== 'ready') return;

      const halfDelay = Math.max(3000, Math.round(timeoutMs * 0.55));
      const retryTimer = window.setTimeout(() => {
        if (
          !autoRetriedRef.current &&
          widgetIdRef.current &&
          typeof window.turnstile?.reset === 'function'
        ) {
          autoRetriedRef.current = true;
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch {
            // ignore transient reset error
          }
        }
      }, halfDelay);

      const fallbackTimer = window.setTimeout(() => {
        activateFallbackOrError(
          'Security verification timed out on this network. Please retry.',
          'Challenge timeout (8s)',
        );
      }, timeoutMs);

      return () => {
        window.clearTimeout(retryTimer);
        window.clearTimeout(fallbackTimer);
      };
    }, [siteKey, widgetState, timeoutMs, activateFallbackOrError]);

    useEffect(() => {
      if (!siteKey) return;
      let cancelled = false;
      autoRetriedRef.current = false;
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
            appearance,
            execution,
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
              onExpireRef.current?.();
              setWidgetState('ready');
              setStatusMessage(null);
              setDiagnosticHint(null);
              if (widgetIdRef.current && typeof api.reset === 'function') {
                try {
                  api.reset(widgetIdRef.current);
                } catch {
                  activateFallbackOrError('Security check expired. Please retry.');
                }
              } else {
                activateFallbackOrError('Security check expired. Please retry.');
              }
            },
            'timeout-callback': () => {
              if (cancelled) return;
              onExpireRef.current?.();
              activateFallbackOrError(
                'Security verification timed out. Please retry.',
                'Challenge timeout',
              );
            },
            'error-callback': (errorCode?: string | number) => {
              if (cancelled) return;
              const described = describeTurnstileError(errorCode);
              console.warn('[MineConnect Turnstile] Widget error:', {
                errorCode,
                action,
              });
              onExpireRef.current?.();
              if (
                !autoRetriedRef.current &&
                widgetIdRef.current &&
                typeof api.reset === 'function'
              ) {
                autoRetriedRef.current = true;
                try {
                  api.reset(widgetIdRef.current);
                  return;
                } catch {
                  // fall through to fallback/error state
                }
              }
              if (allowMobileFallback) {
                activateFallbackOrError(described.message, described.codeHint);
              } else {
                setWidgetState('error');
                setStatusMessage(described.message);
                setDiagnosticHint(described.codeHint ?? null);
                onErrorRef.current?.(described.message);
              }
            },
          });

          widgetIdRef.current = id;
          setWidgetState((prev) => (prev === 'verified' ? 'verified' : 'ready'));
        } catch (renderErr) {
          console.warn('[MineConnect Turnstile] Render exception:', renderErr);
          onExpireRef.current?.();
          if (allowMobileFallback) {
            activateFallbackOrError(
              'Security verification failed to render.',
              'Render fallback',
            );
          } else {
            setWidgetState('error');
            setStatusMessage('Security verification failed to render. Please retry.');
            setDiagnosticHint(null);
            onErrorRef.current?.('Security verification failed to render. Please retry.');
          }
        }
      };

      void loadTurnstileApi({ forceReload: shouldForceReload })
        .then((api) => {
          if (cancelled) return;
          mountWidget(api);
        })
        .catch((err) => {
          if (cancelled) return;
          const code = err instanceof Error ? err.message : 'TURNSTILE_SCRIPT_BLOCKED';
          const described = describeTurnstileError(code);
          console.warn('[MineConnect Turnstile] Script load failed:', code);
          onExpireRef.current?.();
          if (allowMobileFallback) {
            activateFallbackOrError(described.message, described.codeHint);
          } else {
            setWidgetState('error');
            setStatusMessage(described.message);
            setDiagnosticHint(described.codeHint ?? null);
            onErrorRef.current?.(described.message);
          }
        });

      return () => {
        cancelled = true;
        if (widgetIdRef.current && typeof window.turnstile?.remove === 'function') {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore unmount errors
          }
          widgetIdRef.current = null;
        }
      };
    }, [
      siteKey,
      theme,
      appearance,
      execution,
      action,
      renderGeneration,
      allowMobileFallback,
      activateFallbackOrError,
    ]);

    if (!siteKey) {
      return null;
    }

    return (
      <div className={`w-full min-w-0 max-w-full ${className}`}>
        <div
          className={
            widgetState === 'fallback'
              ? 'flex w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-lg border border-moss/25 bg-moss-light/50 px-3 py-2 text-xs'
              : 'relative flex min-h-[68px] w-full min-w-0 max-w-full flex-col items-center justify-center rounded-lg bg-paper/55 px-2.5 py-2 ring-1 ring-inset ring-ink/8'
          }
        >
          {widgetState === 'loading' && (
            <div
              aria-live="polite"
              className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 font-mono text-[11px] text-stone"
            >
              <Loader2 size={13} className="animate-spin text-ochre" />
              <span>Verifying security…</span>
            </div>
          )}

          <div
            ref={containerRef}
            className={
              widgetState === 'fallback'
                ? 'hidden'
                : 'flex min-h-[60px] w-full min-w-0 max-w-full items-center justify-center overflow-hidden'
            }
          />

          {widgetState === 'fallback' && (
            <>
              <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 font-mono text-[11px] font-medium text-moss">
                <CheckCircle2 size={13} className="shrink-0" />
                <span className="truncate">
                  Verified via signed-in session
                </span>
              </span>
              <button
                type="button"
                onClick={resetWidget}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-moss/30 bg-white px-2 py-1 font-mono text-[10px] font-semibold text-ink transition hover:border-ochre hover:text-ochre"
              >
                <RefreshCw size={10} />
                Retry
              </button>
            </>
          )}

          {(widgetState === 'error' || widgetState === 'expired') && (
            <div className="mt-2 flex w-full flex-wrap items-center justify-between gap-2 border-t border-ink/8 pt-2 text-xs">
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
                Retry Verification
              </button>
            </div>
          )}
        </div>
      </div>
    );
  },
);

const TurnstileWidget = memo(TurnstileWidgetInner);
export default TurnstileWidget;
