import { describe, expect, it } from "vitest";
import { getDocumentCheckingState } from "./documentCheckingState";
import type { Document } from "@marketplace/contracts";

function documentWith(
  overrides: Partial<
    Pick<Document, "processingFailureCode" | "processingStatus">
  >,
) {
  return {
    processingFailureCode: null,
    processingStatus: "queued",
    ...overrides,
  } satisfies Pick<Document, "processingFailureCode" | "processingStatus">;
}

describe("getDocumentCheckingState", () => {
  it.each(["not_started", "queued", "processing"] as const)(
    "maps %s to the author-facing checking state",
    (processingStatus) => {
      expect(
        getDocumentCheckingState(documentWith({ processingStatus })).kind,
      ).toBe("checking");
    },
  );

  it("maps successful processing to the ready state", () => {
    expect(
      getDocumentCheckingState(documentWith({ processingStatus: "succeeded" }))
        .titleKey,
    ).toBe("manuscripts.documentCheck.title.ready");
  });

  it("maps failure codes to safe user-facing failure messages", () => {
    const state = getDocumentCheckingState(
      documentWith({
        processingFailureCode: "parser_failed",
        processingStatus: "failed",
      }),
    );

    expect(state.kind).toBe("unreadable");
    expect(state.failureMessageKey).toBe(
      "manuscripts.documentCheck.failure.unreadable",
    );
    expect(state.failureMessageKey).not.toContain("parser");
  });

  it("maps scanner provider failures to temporary recovery language", () => {
    const state = getDocumentCheckingState(
      documentWith({
        processingFailureCode: "scanner_failed",
        processingStatus: "failed",
      }),
    );

    expect(state.kind).toBe("unreadable");
    expect(state.failureMessageKey).toBe(
      "manuscripts.documentCheck.failure.temporary",
    );
    expect(state.failureMessageKey).not.toContain("safety");
  });
});
