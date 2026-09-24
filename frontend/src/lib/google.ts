export interface GoogleProviders {
  google: boolean;
  clientId?: string;
}

interface GoogleIdApi {
  initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
  renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

let loading: Promise<GoogleIdApi> | null = null;

export function loadGoogleIdentity(): Promise<GoogleIdApi> {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-google-gsi]");
    const onReady = () => {
      const api = window.google?.accounts.id;
      if (api) resolve(api);
      else reject(new Error("Google Identity failed to load."));
    };
    if (existing) {
      existing.addEventListener("load", onReady);
      existing.addEventListener("error", () => reject(new Error("Google Identity failed to load.")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset.googleGsi = "1";
    script.onload = onReady;
    script.onerror = () => reject(new Error("Google Identity failed to load."));
    document.head.appendChild(script);
  });
  return loading;
}
