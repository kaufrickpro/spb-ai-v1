import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CandidateList } from "./MatchCandidateSummary";
import {
  createMatchCandidate,
  createMatchRunResponse,
} from "./matchTestFixtures";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values?.rank ? `${key}:${values.rank}` : key,
  }),
}));

describe("CandidateList", () => {
  it("shows generated explanation paragraphs for top-ten candidates only", () => {
    const markup = renderCandidateList([
      createMatchCandidate({
        id: "22222222-2222-4222-8222-222222222222",
        rank: 10,
        explanation: "Top ten generated explanation.",
        explanationStatus: "generated",
      }),
      createMatchCandidate({
        id: "77777777-7777-4777-8777-777777777777",
        rank: 11,
        explanation: "Rank eleven generated explanation should stay hidden.",
        explanationStatus: "generated",
      }),
      createMatchCandidate({
        id: "88888888-8888-4888-8888-888888888888",
        rank: 3,
        explanation: "Not requested explanation should stay hidden.",
        explanationStatus: "not_requested",
      }),
    ]);

    expect(markup).toContain("Top ten generated explanation.");
    expect(markup).not.toContain(
      "Rank eleven generated explanation should stay hidden.",
    );
    expect(markup).not.toContain(
      "Not requested explanation should stay hidden.",
    );
  });

  it("renders axis bands, profile links, manuscript links, and no stale intro placeholder", () => {
    const markup = renderCandidateList([createMatchCandidate()]);

    expect(markup).toContain("matches.axis.premise");
    expect(markup).toContain("matches.axis.voice");
    expect(markup).toContain("matches.axis.arc");
    expect(markup).toContain("/app/profiles/authors/");
    expect(markup).toContain("/app/profiles/manuscripts/");
    expect(markup).not.toContain("matches.step10IntroPlaceholder");
  });

  it("does not render redaction marker strings from explanation, reasons, penalties, or snippets", () => {
    const markup = renderCandidateList([
      createMatchCandidate({
        title: "[REDACTED_TITLE]",
        subtitle: "hidden subtitle",
        explanation: "[REDACTED_MANUSCRIPT_TEXT]",
        fitReasons: ["Clear fit", "[REDACTED_FIT]"],
        riskReasons: ["private risk"],
        penalties: [
          {
            code: "private_penalty",
            label: "[REDACTED_PENALTY]",
            severity: "high",
          },
        ],
        safeSnippets: [
          { label: "Safe", text: "Visible safe snippet." },
          { label: "Hidden", text: "[REDACTED_SNIPPET]" },
        ],
      }),
    ]);

    expect(markup).toContain("Clear fit");
    expect(markup).not.toContain("Visible safe snippet.");
    expect(markup).not.toMatch(/REDACTED|hidden subtitle|private risk/i);
  });

  it("keeps full detail-only evidence off compact cards", () => {
    const markup = renderCandidateList([
      createMatchCandidate({
        fitReasons: ["First fit", "Second fit", "Third full detail fit"],
        riskReasons: ["First risk", "Second risk", "Third full detail risk"],
        safeSnippets: [
          { label: "Guidelines", text: "Full source snippet belongs on detail." },
        ],
      }),
    ]);

    expect(markup).toContain("First fit");
    expect(markup).toContain("Second fit");
    expect(markup).not.toContain("Third full detail fit");
    expect(markup).not.toContain("Full source snippet belongs on detail.");
  });
});

function renderCandidateList(
  candidates: ReturnType<typeof createMatchCandidate>[],
) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <CandidateList
        run={createMatchRunResponse({
          candidates,
          run: createMatchRunResponse().run,
        })}
      />
    </MemoryRouter>,
  );
}
