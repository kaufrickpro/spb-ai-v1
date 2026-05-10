import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiConfig } from "../config/config.js";
import {
  getSupabaseMatchCandidate,
  runSupabaseMatch,
} from "./supabaseMatchingService.js";

const mocks = vi.hoisted(() => ({
  createServiceRoleSupabaseClient: vi.fn(),
  runAiMatching: vi.fn(),
}));

vi.mock("../supabase/client.js", () => ({
  createServiceRoleSupabaseClient: mocks.createServiceRoleSupabaseClient,
}));

vi.mock("./aiClient.js", () => ({
  runAiMatching: mocks.runAiMatching,
}));

const NOW = "2026-05-08T10:00:00.000Z";
const RUN_ID = "11111111-1111-4111-8111-111111111111";
const AUTHOR_USER_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_PROFILE_ID = "33333333-3333-4333-8333-333333333333";
const MANUSCRIPT_ID = "44444444-4444-4444-8444-444444444444";
const DOCUMENT_ID = "55555555-5555-4555-8555-555555555555";
const PUBLISHER_PROFILE_ID = "66666666-6666-4666-8666-666666666666";
const CANDIDATE_ID = "77777777-7777-4777-8777-777777777777";

const config: ApiConfig = {
  appConfigMode: "staging",
  authMode: "supabase",
  host: "127.0.0.1",
  logLevel: "silent",
  port: 4000,
  storageProvider: "gcs",
  documentProcessingProvider: "cloud_tasks",
  googleCloudProject: "project",
  googleCloudRegion: "europe-west3",
  gcsBucketPrivateUploads: "bucket",
  cloudTasksIngestionQueue: "queue",
  cloudTasksServiceAccountEmail: "tasks@example.com",
  webAppUrl: "https://spb-ai.dev",
  sentryEnvironment: "staging",
  sentryTracesSampleRate: 0,
  documentScannerMode: "real",
  documentScannerProvider: "http-clamav",
  supabaseUrl: "https://example.supabase.co",
  supabaseAnonKey: "anon",
  supabaseServiceRoleKey: "service-role",
  aiServiceBaseUrl: "https://ai.internal",
};

describe("runSupabaseMatch", () => {
  let db: MockSupabaseDb;

  beforeEach(() => {
    db = new MockSupabaseDb();
    mocks.createServiceRoleSupabaseClient.mockReturnValue(db);
    mocks.runAiMatching.mockReset();
  });

  it("reads AI-persisted candidates and does not insert API tracer candidates", async () => {
    mocks.runAiMatching.mockImplementation(async () => {
      db.persistAiCandidate({
        id: CANDIDATE_ID,
        match_run_id: RUN_ID,
        rank: 1,
        candidate_profile_id: PUBLISHER_PROFILE_ID,
        candidate_manuscript_id: null,
        candidate_type: "publisher",
        score_band: "strong",
        axis_bands: { premise: "strong", voice: "moderate", arc: "strong" },
        explanation: "Persisted by AI service.",
        explanation_status: "generated",
        fit_reasons: ["Editorial focus overlaps."],
        risk_reasons: [],
        score_details: {
          title: "Persisted Publisher",
          subtitle: "Publisher profile",
          profilePath: `/app/profiles/publishers/${PUBLISHER_PROFILE_ID}`,
          manuscriptProfilePath: null,
          penalties: [],
        },
        safe_snippets: [
          { label: "Guidelines", text: "Send literary fiction." },
        ],
      });
      return {
        status: "succeeded",
        candidate_count: 25,
        failure_code: null,
      };
    });

    const response = await runSupabaseMatch({
      config,
      request: {
        direction: "author_to_publisher",
        manuscriptId: MANUSCRIPT_ID,
      },
      user: {
        userId: AUTHOR_USER_ID,
        jwt: "jwt",
        authAssuranceLevel: null,
      },
    });

    expect(mocks.runAiMatching).toHaveBeenCalledWith({
      config,
      matchRunId: RUN_ID,
    });
    expect(db.insertCalls.match_candidates).toBeUndefined();
    expect(response.run.status).toBe("succeeded");
    expect(response.run.candidateCount).toBe(1);
    expect(response.candidates).toHaveLength(1);
    expect(response.candidates[0].id).toBe(CANDIDATE_ID);
  });

  it("marks the run failed with zero candidates when AI matching fails", async () => {
    mocks.runAiMatching.mockResolvedValue({
      status: "failed",
      candidate_count: 0,
      failure_code: "ai_service_timeout",
    });

    const response = await runSupabaseMatch({
      config,
      request: {
        direction: "author_to_publisher",
        manuscriptId: MANUSCRIPT_ID,
      },
      user: {
        userId: AUTHOR_USER_ID,
        jwt: "jwt",
        authAssuranceLevel: null,
      },
    });

    expect(db.insertCalls.match_candidates).toBeUndefined();
    expect(response.run.status).toBe("failed");
    expect(response.run.candidateCount).toBe(0);
    expect(response.run.failureCode).toBe("ai_service_timeout");
    expect(response.candidates).toEqual([]);
  });
});

describe("getSupabaseMatchCandidate", () => {
  let db: MockSupabaseDb;

  beforeEach(() => {
    db = new MockSupabaseDb();
    mocks.createServiceRoleSupabaseClient.mockReturnValue(db);
    db.rows.runs.push({
      id: RUN_ID,
      direction: "author_to_publisher",
      requester_profile_id: AUTHOR_PROFILE_ID,
      source_manuscript_id: MANUSCRIPT_ID,
      source_publisher_profile_id: null,
      status: "succeeded",
      stale: false,
      candidate_count: 1,
      failure_code: null,
      input_fingerprint: "fingerprint",
      input_snapshot: { title: "Persisted Manuscript" },
      created_at: NOW,
      updated_at: NOW,
    });
  });

  it("returns stored detail snapshots only from the candidate detail path", async () => {
    db.persistAiCandidate(
      persistedCandidate({ detail_snapshot: detailSnapshot() }),
    );

    const response = await getSupabaseMatchCandidate({
      candidateId: CANDIDATE_ID,
      config,
      matchRunId: RUN_ID,
      user: {
        userId: AUTHOR_USER_ID,
        jwt: "jwt",
        authAssuranceLevel: null,
      },
    });

    expect(response.candidate.detail.comparison[0]?.status).toBe("match");
    expect(JSON.stringify(response)).not.toMatch(
      /scoreDebug|finalScore|downloadUrl|signedUrl|privateContact|documentChunks/i,
    );
  });

  it("uses an honest limited fallback for old rows without detail snapshots", async () => {
    db.persistAiCandidate(persistedCandidate());

    const response = await getSupabaseMatchCandidate({
      candidateId: CANDIDATE_ID,
      config,
      matchRunId: RUN_ID,
      user: {
        userId: AUTHOR_USER_ID,
        jwt: "jwt",
        authAssuranceLevel: null,
      },
    });

    expect(response.candidate.detail.limitations).toEqual([
      "detail_snapshot_unavailable",
    ]);
    expect(response.candidate.detail.evidence.safeSnippets[0]?.sourceType).toBe(
      "unknown",
    );
  });
});

type QueryResult = {
  count?: number | null;
  data?: unknown;
  error: unknown;
};

class MockSupabaseDb {
  readonly insertCalls: Record<string, number> = {};
  readonly rows = {
    candidates: [] as Array<Record<string, unknown>>,
    documents: [
      {
        id: DOCUMENT_ID,
        processing_status: "succeeded",
        eligibility_status: "eligible",
      },
    ],
    manuscripts: [
      {
        id: MANUSCRIPT_ID,
        author_id: AUTHOR_USER_ID,
        title: "Persisted Manuscript",
        genre: "Roman",
        language: "tr",
        word_count: 42000,
        eligibility_status: "eligible",
        sample_document_id: DOCUMENT_ID,
        logline: "A durable test logline.",
        synopsis: "A durable test synopsis.",
        manuscript_form: "novel",
        arc_summary: "A durable test arc.",
      },
    ],
    profiles: [
      {
        id: AUTHOR_PROFILE_ID,
        user_id: AUTHOR_USER_ID,
        role: "author",
        display_name: "Author",
        eligibility_status: "eligible",
      },
    ],
    runs: [] as Array<Record<string, unknown>>,
  };

  from(table: string) {
    return new MockQueryBuilder(this, table);
  }

  persistAiCandidate(row: Record<string, unknown>) {
    this.rows.candidates.push(row);
  }
}

function persistedCandidate(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: CANDIDATE_ID,
    match_run_id: RUN_ID,
    rank: 1,
    candidate_profile_id: PUBLISHER_PROFILE_ID,
    candidate_manuscript_id: null,
    candidate_type: "publisher",
    score_band: "strong",
    axis_bands: { premise: "strong", voice: "moderate", arc: "strong" },
    explanation: "Persisted by AI service.",
    explanation_status: "generated",
    fit_reasons: ["Editorial focus overlaps."],
    risk_reasons: [],
    score_details: {
      title: "Persisted Publisher",
      subtitle: "Publisher profile",
      profilePath: `/app/profiles/publishers/${PUBLISHER_PROFILE_ID}`,
      manuscriptProfilePath: null,
      penalties: [],
    },
    safe_snippets: [{ label: "Guidelines", text: "Send literary fiction." }],
    ...overrides,
  };
}

function detailSnapshot() {
  return {
    pair: {
      manuscriptId: MANUSCRIPT_ID,
      manuscriptTitle: "Persisted Manuscript",
      publisherProfileId: PUBLISHER_PROFILE_ID,
      publisherName: "Persisted Publisher",
      sourceSide: "manuscript",
    },
    publisherContext: {
      acceptedGenres: ["Roman"],
      acceptedAudienceCategories: ["adult"],
      acceptedManuscriptForms: ["novel"],
      excludedTopics: [],
      guidelinesSummary: "Send literary fiction.",
      wishlistSummary: null,
      catalogSummary: null,
    },
    manuscriptContext: {
      genre: "Roman",
      subgenres: [],
      audienceCategories: ["adult"],
      manuscriptForm: "novel",
      language: "tr",
      wordCount: 42000,
      themes: [],
      declaredContentWarnings: [],
      logline: "A durable test logline.",
      teaser: null,
    },
    comparison: [
      {
        key: "genre",
        status: "match",
        manuscriptValues: ["Roman"],
        publisherValues: ["Roman"],
        noteCode: "matches.comparisonNotes.genre.match",
        noteParams: {},
      },
    ],
    axisEvidence: {
      premise: {
        band: "strong",
        manuscriptSignal: "premise",
        publisherSignal: "guidelines",
        manuscriptSummary: "A durable test logline.",
        publisherSummary: "Send literary fiction.",
        reasons: ["Editorial focus overlaps."],
      },
      voice: {
        band: "moderate",
        manuscriptSignal: "voice",
        publisherSignal: "wishlist",
        manuscriptSummary: null,
        publisherSummary: null,
        reasons: ["Editorial focus overlaps."],
      },
      arc: {
        band: "strong",
        manuscriptSignal: "arc",
        publisherSignal: "catalog",
        manuscriptSummary: "A durable test arc.",
        publisherSummary: null,
        reasons: ["Editorial focus overlaps."],
      },
    },
    evidence: {
      fitReasons: ["Editorial focus overlaps."],
      watchOuts: [],
      safeSnippets: [
        {
          label: "Guidelines",
          text: "Send literary fiction.",
          sourceType: "publisher_guidelines",
        },
      ],
    },
    limitations: [],
  };
}

class MockQueryBuilder implements PromiseLike<QueryResult> {
  private filters: Array<{ column: string; value: unknown }> = [];
  private insertValue: Record<string, unknown> | null = null;
  private operation: "insert" | "select" | "update" = "select";
  private orderColumn: string | null = null;
  private selectOptions: { count?: "exact"; head?: boolean } | undefined;
  private updateValue: Record<string, unknown> | null = null;

  constructor(
    private readonly db: MockSupabaseDb,
    private readonly table: string,
  ) {}

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  insert(value: Record<string, unknown>) {
    this.operation = "insert";
    this.insertValue = value;
    this.db.insertCalls[this.table] =
      (this.db.insertCalls[this.table] ?? 0) + 1;
    return this;
  }

  limit() {
    return this;
  }

  maybeSingle() {
    const rows = this.selectRows();
    return Promise.resolve({
      data: rows[0] ?? null,
      error: null,
    });
  }

  order(column: string) {
    this.orderColumn = column;
    return this;
  }

  select(_columns?: string, options?: { count?: "exact"; head?: boolean }) {
    this.operation = this.operation === "insert" ? "insert" : "select";
    this.selectOptions = options;
    return this;
  }

  single() {
    return Promise.resolve(this.execute());
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  update(value: Record<string, unknown>) {
    this.operation = "update";
    this.updateValue = value;
    return this;
  }

  private execute(): QueryResult {
    if (this.operation === "insert") {
      return {
        data: this.insertRow(),
        error: null,
      };
    }

    if (this.operation === "update") {
      this.updateRows();
      return { data: null, error: null };
    }

    const rows = this.selectRows();
    if (this.selectOptions?.head) {
      return { count: rows.length, data: null, error: null };
    }

    return { data: rows, error: null };
  }

  private insertRow() {
    if (this.table !== "match_runs" || !this.insertValue) {
      return this.insertValue;
    }

    const row = {
      ...this.insertValue,
      id: RUN_ID,
      candidate_count: 0,
      failure_code: null,
      stale: false,
      created_at: NOW,
      updated_at: NOW,
    };
    this.db.rows.runs.push(row);
    return row;
  }

  private selectRows() {
    const rows = this.rowsForTable().filter((row) =>
      this.filters.every((filter) => row[filter.column] === filter.value),
    );
    if (this.orderColumn) {
      return rows.sort((a, b) =>
        Number(a[this.orderColumn!]) > Number(b[this.orderColumn!]) ? 1 : -1,
      );
    }
    return rows;
  }

  private rowsForTable() {
    if (this.table === "documents") return this.db.rows.documents;
    if (this.table === "manuscripts") return this.db.rows.manuscripts;
    if (this.table === "match_candidates") return this.db.rows.candidates;
    if (this.table === "match_runs") return this.db.rows.runs;
    if (this.table === "profiles") return this.db.rows.profiles;
    return [];
  }

  private updateRows() {
    if (this.table !== "match_runs" || !this.updateValue) {
      return;
    }
    for (const row of this.db.rows.runs) {
      if (this.filters.every((filter) => row[filter.column] === filter.value)) {
        Object.assign(row, this.updateValue, { updated_at: NOW });
      }
    }
  }
}
