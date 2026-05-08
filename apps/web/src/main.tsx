import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { AuthProvider } from "./modules/auth/AuthContext";
import { getWebConfig } from "./modules/config/config";
import { i18n } from "./modules/i18n/i18n";
import { initializeSentry, SentryErrorBoundary } from "./lib/sentry";
import "./styles.css";

const rootElement = document.getElementById("root");
const queryClient = new QueryClient();
const webConfig = getWebConfig();

if (!rootElement) {
  throw new Error("Missing #root element");
}

initializeSentry(webConfig);

function AppCrashFallback() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-red-700">
          Smart Publishing Bridge
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Something went wrong.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The team has been notified. Refresh the page to try again.
        </p>
      </div>
    </main>
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <SentryErrorBoundary fallback={<AppCrashFallback />}>
              <App />
            </SentryErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </I18nextProvider>
  </StrictMode>,
);
