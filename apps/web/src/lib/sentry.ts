import { useEffect } from "react";
import * as Sentry from "@sentry/react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import type { WebConfig } from "../modules/config/config";

const REDACTED = "[Filtered]";

const SENSITIVE_KEY_PARTS = [
  "authorization",
  "cookie",
  "token",
  "secret",
  "signature",
  "apikey",
  "signedurl",
  "downloadurl",
  "uploadurl",
  "sampleurl",
  "manuscripttext",
  "documenttext",
  "documentchunk",
  "chunktext",
  "rawtext",
  "fulltext",
  "extractedtext",
  "contact",
  "recipient",
  "email",
  "phone",
  "card",
  "cvv",
  "pan",
];

const SENSITIVE_QUERY_KEY_PARTS = [
  "token",
  "signature",
  "credential",
  "key",
  "secret",
  "x-goog-signature",
  "x-goog-credential",
  "x-goog-security-token",
];

let initialized = false;

export const SentryErrorBoundary = Sentry.ErrorBoundary;
export const SENTRY_REDACTED_VALUE = REDACTED;

export function initializeSentry(config: WebConfig): void {
  if (!config.sentryDsn || initialized) {
    return;
  }

  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.sentryEnvironment,
    release: config.sentryRelease,
    sendDefaultPii: false,
    tracesSampleRate: config.sentryTracesSampleRate,
    tracePropagationTargets: [config.apiBaseUrl],
    integrations: [
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });

  Sentry.setTag("service", "web");
  initialized = true;
}

export function scrubSentryEvent<T>(event: T): T {
  return scrubValue(event, new WeakSet<object>()) as T;
}

function scrubValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return scrubString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, seen));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (seen.has(value)) {
    return REDACTED;
  }

  seen.add(value);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      shouldRedactKey(key) ? REDACTED : scrubValue(nested, seen),
    ]),
  );
}

function shouldRedactKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function scrubString(value: string): string {
  if (
    value.includes("X-Goog-Signature") ||
    value.includes("X-Goog-Credential")
  ) {
    return REDACTED;
  }

  return scrubUrl(value);
}

function scrubUrl(value: string): string {
  try {
    const url = new URL(value);
    let changed = false;

    for (const key of Array.from(url.searchParams.keys())) {
      const normalized = key.toLowerCase();
      if (SENSITIVE_QUERY_KEY_PARTS.some((part) => normalized.includes(part))) {
        url.searchParams.set(key, REDACTED);
        changed = true;
      }
    }

    return changed ? url.toString() : value;
  } catch {
    return value;
  }
}
