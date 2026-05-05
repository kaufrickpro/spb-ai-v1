import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminDashboardResponse,
  AdminJobRun,
  AdminPaymentEvent,
  AdminTrustSignal,
} from "@marketplace/contracts";
import {
  mapDbAdminAuditLog,
  mapDbAdminJobRun,
  mapDbAdminPaymentEvent,
  mapDbAdminReview,
  mapDbAdminTrustSignal,
} from "./mappers.js";
import type { AdminTestState } from "./testState.js";

type CountQuery = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;
type AdminDashboardSummary = AdminDashboardResponse["summary"];

export async function countRows(
  db: SupabaseClient,
  table: string,
  filter: (query: CountQuery) => void,
): Promise<number> {
  const query: CountQuery = db
    .from(table)
    .select("*", { count: "exact", head: true });
  filter(query);
  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function getAdminJobHealth(db: SupabaseClient): Promise<{
  summary: {
    queued: number;
    running: number;
    failed: number;
    lastRunAt: string | null;
  };
  runs: AdminJobRun[];
}> {
  const [queued, running, failed, ingestionJobs] = await Promise.all([
    countRows(db, "admin_job_runs", (query) => {
      query.eq("status", "queued");
    }),
    countRows(db, "admin_job_runs", (query) => {
      query.eq("status", "running");
    }),
    countRows(db, "admin_job_runs", (query) => {
      query.eq("status", "failed");
    }),
    getRecentDocumentProcessingJobs(db),
  ]);

  const { data, error } = await db
    .from("admin_job_runs")
    .select()
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  const runs = [...(data ?? []).map(mapDbAdminJobRun), ...ingestionJobs].sort(
    (left, right) => right.updatedAt.localeCompare(left.updatedAt),
  );
  const ingestionQueued = ingestionJobs.filter(
    (job) => job.status === "queued",
  ).length;
  const ingestionRunning = ingestionJobs.filter(
    (job) => job.status === "running",
  ).length;
  const ingestionFailed = ingestionJobs.filter(
    (job) => job.status === "failed",
  ).length;

  return {
    summary: {
      queued: queued + ingestionQueued,
      running: running + ingestionRunning,
      failed: failed + ingestionFailed,
      lastRunAt: runs[0]?.updatedAt ?? null,
    },
    runs: runs.slice(0, 20),
  };
}

async function getRecentDocumentProcessingJobs(
  db: SupabaseClient,
): Promise<AdminJobRun[]> {
  const { data, error } = await db
    .from("document_processing_jobs")
    .select()
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) =>
    mapDbAdminJobRun({
      ...row,
      job_type: "document_ingestion",
      status: row.status === "cancelled" ? "failed" : row.status,
      source: row.idempotency_key,
    }),
  );
}

export async function getAdminPaymentHealth(db: SupabaseClient): Promise<{
  summary: { recentFailures: number; lastEventAt: string | null };
  events: AdminPaymentEvent[];
}> {
  const recentFailures = await countRows(
    db,
    "admin_payment_events",
    (query) => {
      query.eq("status", "failed");
    },
  );

  const { data, error } = await db
    .from("admin_payment_events")
    .select()
    .order("occurred_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  const events = (data ?? []).map(mapDbAdminPaymentEvent);
  return {
    summary: {
      recentFailures,
      lastEventAt: events[0]?.occurredAt ?? null,
    },
    events,
  };
}

export async function getAdminTrustSafety(db: SupabaseClient): Promise<{
  summary: {
    pendingProfiles: number;
    rejectedProfiles: number;
    flaggedProfiles: number;
  };
  signals: AdminTrustSignal[];
}> {
  const [pendingProfiles, rejectedProfiles, flaggedProfiles] =
    await Promise.all([
      countRows(db, "profiles", (query) => {
        query
          .eq("eligibility_status", "limited")
          .eq("review_outcome", "needs_review");
      }),
      countRows(db, "profiles", (query) => {
        query.eq("eligibility_status", "blocked");
      }),
      countRows(db, "admin_trust_signals", (query) => {
        query.eq("status", "open");
      }),
    ]);

  const { data, error } = await db
    .from("admin_trust_signals")
    .select()
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return {
    summary: {
      pendingProfiles,
      rejectedProfiles,
      flaggedProfiles,
    },
    signals: (data ?? []).map(mapDbAdminTrustSignal),
  };
}

export async function getAdminDashboardSummary(
  db: SupabaseClient,
): Promise<AdminDashboardSummary> {
  const [
    pendingQueueCount,
    highRiskQueueCount,
    needsReview,
    quarantine,
    autoApprovedProfiles,
    needsReviewProfiles,
    quarantinedProfiles,
  ] = await Promise.all([
    countRows(db, "admin_reviews", (query) => {
      query.eq("status", "pending");
    }),
    countRows(db, "admin_reviews", (query) => {
      query.eq("status", "pending").eq("risk_level", "high");
    }),
    countRows(db, "admin_reviews", (query) => {
      query.eq("status", "pending").eq("exception_queue", "needs_review");
    }),
    countRows(db, "admin_reviews", (query) => {
      query.eq("status", "pending").eq("exception_queue", "quarantine");
    }),
    countRows(db, "profiles", (query) => {
      query.eq("review_outcome", "auto_approved");
    }),
    countRows(db, "profiles", (query) => {
      query.eq("review_outcome", "needs_review");
    }),
    countRows(db, "profiles", (query) => {
      query.eq("review_outcome", "quarantined");
    }),
  ]);

  const [jobsHealth, paymentsHealth, trustSafety, recentAuditLogs, hotlist] =
    await Promise.all([
      getAdminJobHealth(db),
      getAdminPaymentHealth(db),
      getAdminTrustSafety(db),
      getAdminRecentAuditLogs(db),
      getAdminRiskHotlist(db),
    ]);
  const automationTotal =
    autoApprovedProfiles + needsReviewProfiles + quarantinedProfiles;

  return {
    exceptionQueues: {
      needsReview,
      quarantine,
      reports: trustSafety.summary.flaggedProfiles,
      systemFailures:
        jobsHealth.summary.failed + paymentsHealth.summary.recentFailures,
    },
    automationHealth: {
      autoApproved: autoApprovedProfiles,
      needsReview: needsReviewProfiles,
      quarantined: quarantinedProfiles,
      autoApprovalRate:
        automationTotal === 0 ? 0 : autoApprovedProfiles / automationTotal,
    },
    riskHotlist: hotlist,
    systemHealth: {
      failedJobs: jobsHealth.summary.failed,
      paymentFailures: paymentsHealth.summary.recentFailures,
      openTrustSignals: trustSafety.summary.flaggedProfiles,
    },
    reviewQueue: {
      pendingCount: pendingQueueCount,
      highRiskCount: highRiskQueueCount,
    },
    jobHealth: jobsHealth.summary,
    paymentHealth: paymentsHealth.summary,
    trustSafety: trustSafety.summary,
    recentAuditLogs,
  };
}

export function getTestAdminDashboardSummary(state: AdminTestState) {
  const pendingCount = state.reviews.filter(
    (review) => review.status === "pending",
  ).length;
  const highRiskCount = state.reviews.filter(
    (review) => review.status === "pending" && review.riskLevel === "high",
  ).length;
  const queued = state.jobRuns.filter((run) => run.status === "queued").length;
  const running = state.jobRuns.filter(
    (run) => run.status === "running",
  ).length;
  const failed = state.jobRuns.filter((run) => run.status === "failed").length;
  const recentFailures = state.paymentEvents.filter(
    (event) => event.status === "failed",
  ).length;
  const flaggedProfiles = state.trustSignals.filter(
    (signal) => signal.status === "open",
  ).length;
  const needsReview = state.reviews.filter(
    (review) =>
      review.status === "pending" && review.exceptionQueue === "needs_review",
  ).length;
  const quarantine = state.reviews.filter(
    (review) =>
      review.status === "pending" && review.exceptionQueue === "quarantine",
  ).length;
  const autoApproved = state.reviews.filter(
    (review) => review.reviewOutcome === "auto_approved",
  ).length;
  const quarantined = state.reviews.filter(
    (review) => review.reviewOutcome === "quarantined",
  ).length;
  const automationTotal = autoApproved + needsReview + quarantined;

  return {
    exceptionQueues: {
      needsReview,
      quarantine,
      reports: flaggedProfiles,
      systemFailures: failed + recentFailures,
    },
    automationHealth: {
      autoApproved,
      needsReview,
      quarantined,
      autoApprovalRate:
        automationTotal === 0 ? 0 : autoApproved / automationTotal,
    },
    riskHotlist: state.reviews
      .filter((review) => review.status === "pending")
      .slice()
      .sort((left, right) => {
        const risk = riskRank(right.riskLevel) - riskRank(left.riskLevel);
        if (risk !== 0) return risk;
        return left.submittedAt.localeCompare(right.submittedAt);
      })
      .slice(0, 5),
    systemHealth: {
      failedJobs: failed,
      paymentFailures: recentFailures,
      openTrustSignals: flaggedProfiles,
    },
    reviewQueue: { pendingCount, highRiskCount },
    jobHealth: {
      queued,
      running,
      failed,
      lastRunAt: latestValue(state.jobRuns.map((run) => run.updatedAt)),
    },
    paymentHealth: {
      recentFailures,
      lastEventAt: latestValue(
        state.paymentEvents.map((event) => event.occurredAt),
      ),
    },
    trustSafety: {
      pendingProfiles: pendingCount,
      rejectedProfiles: 0,
      flaggedProfiles,
    },
    recentAuditLogs: state.auditLogs.slice(0, 10),
  };
}

async function getAdminRiskHotlist(db: SupabaseClient) {
  const { data, error } = await db
    .from("admin_reviews")
    .select()
    .eq("status", "pending")
    .order("risk_level", { ascending: false })
    .order("submitted_at", { ascending: true })
    .limit(5);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapDbAdminReview);
}

function riskRank(value: string) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

export function getTestAdminJobHealth(
  state: AdminTestState,
  extraRuns: AdminJobRun[] = [],
) {
  const allRuns = [...state.jobRuns, ...extraRuns];
  return {
    summary: {
      queued: allRuns.filter((run) => run.status === "queued").length,
      running: allRuns.filter((run) => run.status === "running").length,
      failed: allRuns.filter((run) => run.status === "failed").length,
      lastRunAt: latestValue(allRuns.map((run) => run.updatedAt)),
    },
    runs: allRuns,
  };
}

export function getTestAdminPaymentHealth(state: AdminTestState) {
  return {
    summary: {
      recentFailures: state.paymentEvents.filter(
        (event) => event.status === "failed",
      ).length,
      lastEventAt: latestValue(
        state.paymentEvents.map((event) => event.occurredAt),
      ),
    },
    events: state.paymentEvents,
  };
}

export function getTestAdminTrustSafety(state: AdminTestState) {
  return {
    summary: {
      pendingProfiles: state.reviews.filter(
        (review) =>
          review.entityType === "profile" && review.status === "pending",
      ).length,
      rejectedProfiles: state.reviews.filter(
        (review) =>
          review.entityType === "profile" && review.status === "rejected",
      ).length,
      flaggedProfiles: state.trustSignals.filter(
        (signal) => signal.status === "open",
      ).length,
    },
    signals: state.trustSignals,
  };
}

async function getAdminRecentAuditLogs(db: SupabaseClient) {
  const { data, error } = await db
    .from("admin_audit_logs")
    .select()
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapDbAdminAuditLog);
}

function latestValue(values: string[]): string | null {
  return [...values].sort().at(-1) ?? null;
}
