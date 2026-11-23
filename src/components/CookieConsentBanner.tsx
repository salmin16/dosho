'use client';

import { useEffect, useState } from 'react';
import { Cookie, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';

export const COOKIE_CONSENT_STORAGE_KEY = 'mineconnect_cookie_consent_v1';
export const OPEN_COOKIE_SETTINGS_EVENT = 'mineconnect:open-cookie-settings';
export const COOKIE_CONSENT_UPDATED_EVENT = 'mineconnect:cookie-consent-updated';

export interface CookieConsentPreferences {
  strictlyNecessary: true;
  preferences: boolean;
  analytics: boolean;
  updatedAt: string;
  version: '1.0';
}

export function getCookieConsent(): CookieConsentPreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsentPreferences>;
    if (typeof parsed.updatedAt !== 'string') return null;
    return {
      strictlyNecessary: true,
      preferences: Boolean(parsed.preferences),
      analytics: Boolean(parsed.analytics),
      updatedAt: parsed.updatedAt,
      version: '1.0',
    };
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  return Boolean(getCookieConsent()?.analytics);
}

export function hasPreferencesConsent(): boolean {
  return Boolean(getCookieConsent()?.preferences);
}

function clearNonEssentialPreferenceStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('mineconnect.currency.v1');
    window.localStorage.removeItem('dosho_preferred_currency');
    window.localStorage.removeItem('mc:lang');
    document.cookie = 'mc_currency=; path=/; max-age=0; SameSite=Lax';
  } catch {
    // ignore storage errors
  }
}

export function openCookieSettings(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT));
  }
}

function saveCookieConsent(next: {
  preferences: boolean;
  analytics: boolean;
}): CookieConsentPreferences {
  const record: CookieConsentPreferences = {
    strictlyNecessary: true,
    preferences: next.preferences,
    analytics: next.analytics,
    updatedAt: new Date().toISOString(),
    version: '1.0',
  };
  if (typeof window !== 'undefined') {
    try {
      if (!next.preferences) {
        clearNonEssentialPreferenceStorage();
      }
      window.localStorage.setItem(
        COOKIE_CONSENT_STORAGE_KEY,
        JSON.stringify(record)
      );
      window.dispatchEvent(
        new CustomEvent(COOKIE_CONSENT_UPDATED_EVENT, { detail: record })
      );
    } catch {
      // ignore storage errors
    }
  }
  return record;
}

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [allowPreferences, setAllowPreferences] = useState(true);
  const [allowAnalytics, setAllowAnalytics] = useState(false);

  useEffect(() => {
    const existing = getCookieConsent();
    if (!existing) {
      setVisible(true);
    } else {
      setAllowPreferences(existing.preferences);
      setAllowAnalytics(existing.analytics);
    }

    const handleOpenSettings = () => {
      const latest = getCookieConsent();
      setAllowPreferences(latest ? latest.preferences : true);
      setAllowAnalytics(latest ? latest.analytics : false);
      setShowPreferences(true);
      setVisible(true);
    };

    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleOpenSettings);
    return () => {
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleOpenSettings);
    };
  }, []);

  if (!visible) return null;

  const handleAcceptAll = () => {
    saveCookieConsent({ preferences: true, analytics: true });
    setAllowPreferences(true);
    setAllowAnalytics(true);
    setShowPreferences(false);
    setVisible(false);
  };

  const handleRejectNonEssential = () => {
    saveCookieConsent({ preferences: false, analytics: false });
    setAllowPreferences(false);
    setAllowAnalytics(false);
    setShowPreferences(false);
    setVisible(false);
  };

  const handleSaveCustom = () => {
    saveCookieConsent({
      preferences: allowPreferences,
      analytics: allowAnalytics,
    });
    setShowPreferences(false);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-modal={showPreferences ? 'true' : 'false'}
      aria-label="Privacy and Cookie Consent"
      className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:p-5"
    >
      <div className="surface-texture-dark mx-auto max-w-5xl rounded-xl border border-white/[0.09] bg-[#11161D]/96 text-[#F1F5F9] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_48px_-16px_rgba(0,0,0,0.65)] backdrop-blur-md">
        {!showPreferences ? (
          <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d97706]/40 bg-[#d97706]/15 text-[#d97706]">
                <Cookie size={20} />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-base font-semibold text-white">
                    Privacy &amp; Cookie Consent (GDPR &amp; Tanzania PDPA)
                  </h2>
                  <span className="rounded-full border border-[#d97706]/40 bg-[#d97706]/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-400">
                    Zero Dark Patterns
                  </span>
                </div>
                <p className="max-w-2xl text-xs leading-relaxed text-slate-300">
                  Mine Connect uses strictly necessary cookies for Supabase Auth sessions and Cloudflare Turnstile security. Non-essential preference and analytics storage remains blocked until you provide explicit consent.
                </p>
              </div>
            </div>

            {/* Equally prominent first-layer actions */}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:shrink-0">
              <button
                type="button"
                onClick={handleRejectNonEssential}
                className="min-h-[44px] rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-100 transition hover:border-slate-400 hover:bg-slate-800"
              >
                Reject Non-Essential
              </button>
              <button
                type="button"
                onClick={() => setShowPreferences(true)}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-[#d97706]/60 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-amber-400 transition hover:bg-[#d97706]/15"
              >
                <SlidersHorizontal size={14} />
                Manage Preferences
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="min-h-[44px] rounded-lg bg-[#C69214] px-4 py-2.5 text-xs font-semibold text-[#11161D] transition duration-150 hover:bg-[#A8790D] hover:text-white"
              >
                Accept All
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 text-amber-400">
                  <ShieldCheck size={16} />
                  <span className="font-mono text-[11px] uppercase tracking-wider">
                    Granular Consent Preferences
                  </span>
                </div>
                <h2 className="mt-1 font-display text-lg font-semibold text-white">
                  Manage Your Privacy &amp; Cookie Settings
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPreferences(false);
                  if (getCookieConsent()) setVisible(false);
                }}
                aria-label="Close cookie preferences"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition hover:bg-slate-900 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {/* Strictly Necessary */}
              <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      Strictly Necessary
                    </span>
                    <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] uppercase text-emerald-400">
                      Always Active
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Required for Supabase Auth session persistence, Row Level Security tokens, and Cloudflare Turnstile bot protection.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked
                  disabled
                  aria-label="Strictly necessary cookies always active"
                  className="mt-1 h-5 w-5 accent-[#d97706] opacity-60"
                />
              </div>

              {/* Preferences */}
              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4 transition hover:border-[#d97706]/40">
                <div>
                  <span className="text-sm font-semibold text-white">
                    Preferences
                  </span>
                  <p className="mt-1 text-xs text-slate-400">
                    Remembers your selected display currency (TZS/USD/EUR) and interface language (EN/SW/ES) across visits.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={allowPreferences}
                  onChange={(e) => setAllowPreferences(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-[#d97706]"
                />
              </label>

              {/* Analytics */}
              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4 transition hover:border-[#d97706]/40">
                <div>
                  <span className="text-sm font-semibold text-white">
                    Analytics
                  </span>
                  <p className="mt-1 text-xs text-slate-400">
                    Helps us measure marketplace performance and improve reliability. Disabled by default until you opt in.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={allowAnalytics}
                  onChange={(e) => setAllowAnalytics(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-[#d97706]"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col justify-end gap-2 border-t border-slate-800 pt-4 sm:flex-row">
              <button
                type="button"
                onClick={handleRejectNonEssential}
                className="min-h-[44px] rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
              >
                Reject Non-Essential
              </button>
              <button
                type="button"
                onClick={handleSaveCustom}
                className="min-h-[44px] rounded-lg border border-[#d97706] bg-[#d97706]/15 px-4 py-2.5 text-xs font-semibold text-amber-400 hover:bg-[#d97706]/25"
              >
                Save Preferences
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="min-h-[44px] rounded-lg bg-[#d97706] px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-amber-500"
              >
                Accept All
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
