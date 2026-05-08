import re
from dataclasses import dataclass
from hashlib import sha256
from typing import Literal

ScoreBand = Literal["strong", "moderate", "weak"]
CandidateKind = Literal["publisher", "manuscript"]
PenaltySeverity = Literal["low", "medium", "high"]

VISIBLE_SCORE_THRESHOLD = 0.35


@dataclass(frozen=True)
class MatchPenalty:
    code: str
    label: str
    severity: PenaltySeverity


@dataclass(frozen=True)
class MatchSafeSnippet:
    label: str
    text: str


@dataclass(frozen=True)
class MatchScoringResult:
    axis_bands: dict[str, ScoreBand]
    final_score: float
    score_band: ScoreBand
    fit_reasons: list[str]
    risk_reasons: list[str]
    penalties: list[MatchPenalty]
    safe_snippets: list[MatchSafeSnippet]


def score_match_candidate(
    *,
    candidate_kind: CandidateKind,
    rank_seed: str,
    source: dict[str, object],
    candidate: dict[str, object],
    retrieval_scores: dict[str, float] | None = None,
) -> MatchScoringResult:
    axis_hints = retrieval_scores or {}
    premise = bounded_score(
        weighted_axis_score(
            source,
            candidate,
            [
                "genre",
                "primaryGenre",
                "subgenres",
                "audienceCategories",
                "manuscriptForm",
                "logline",
                "synopsis",
                "focusGenres",
                "acceptedPrimaryGenres",
                "acceptedAudienceCategories",
                "acceptedManuscriptForms",
                "submissionGuidelines",
            ],
            axis_hints.get("premise"),
        )
        + seeded_jitter(rank_seed, "premise")
    )
    voice = bounded_score(
        weighted_axis_score(
            source,
            candidate,
            [
                "styleStatement",
                "influences",
                "declaredThemes",
                "shortTeaser",
                "imprintTone",
                "marketPositioning",
                "whatWeAreLookingFor",
            ],
            axis_hints.get("voice"),
        )
        + seeded_jitter(rank_seed, "voice")
    )
    arc = bounded_score(
        weighted_axis_score(
            source,
            candidate,
            [
                "arcSummary",
                "chapterSummaries",
                "editorWishlist",
                "recentAcquisitions",
                "submissionGuidelines",
            ],
            axis_hints.get("arc"),
        )
        + seeded_jitter(rank_seed, "arc")
    )

    penalties = build_penalties(source, candidate)
    penalty_total = sum(penalty_value(penalty.severity) for penalty in penalties)
    final_score = bounded_score(premise * 0.42 + voice * 0.25 + arc * 0.33 - penalty_total)

    return MatchScoringResult(
        axis_bands={
            "premise": score_band(premise),
            "voice": score_band(voice),
            "arc": score_band(arc),
        },
        final_score=final_score,
        score_band=score_band(final_score),
        fit_reasons=build_fit_reasons(candidate_kind, premise, voice, arc),
        risk_reasons=[penalty.label for penalty in penalties][:8],
        penalties=penalties,
        safe_snippets=build_safe_snippets(source, candidate),
    )


def is_visible_match(result: MatchScoringResult) -> bool:
    return result.final_score >= VISIBLE_SCORE_THRESHOLD


def weighted_axis_score(
    source: dict[str, object],
    candidate: dict[str, object],
    keys: list[str],
    retrieval_score: float | None,
) -> float:
    lexical = overlap_score(collect_text(source, keys), collect_text(candidate, keys))
    if retrieval_score is None:
        return lexical
    return lexical * 0.35 + bounded_score(retrieval_score) * 0.65


def build_fit_reasons(
    candidate_kind: CandidateKind,
    premise: float,
    voice: float,
    arc: float,
) -> list[str]:
    reasons: list[str] = []
    if premise >= 0.55:
        reasons.append("Premise and market signals overlap.")
    if voice >= 0.55:
        reasons.append("Voice and positioning signals are compatible.")
    if arc >= 0.55:
        reasons.append("Story arc and acquisition signals line up.")
    if not reasons:
        reasons.append(
            "Publisher metadata has a limited but usable overlap."
            if candidate_kind == "publisher"
            else "Manuscript metadata has a limited but usable overlap."
        )
    return reasons[:8]


def build_penalties(
    source: dict[str, object],
    candidate: dict[str, object],
) -> list[MatchPenalty]:
    penalties: list[MatchPenalty] = []
    if not arrays_overlap(
        source,
        candidate,
        ["genre", "primaryGenre"],
        ["focusGenres", "acceptedPrimaryGenres", "genre"],
    ):
        penalties.append(
            MatchPenalty(
                code="genre_gap",
                label="Primary genre is not a direct declared overlap.",
                severity="low",
            )
        )
    if not arrays_overlap(
        source,
        candidate,
        ["audienceCategories"],
        ["acceptedAudienceCategories", "audienceCategories"],
    ):
        penalties.append(
            MatchPenalty(
                code="audience_gap",
                label="Audience category needs closer editorial review.",
                severity="low",
            )
        )
    if not arrays_overlap(
        source,
        candidate,
        ["manuscriptForm"],
        ["acceptedManuscriptForms", "manuscriptForm"],
    ):
        penalties.append(
            MatchPenalty(
                code="form_gap",
                label="Manuscript form is not explicitly listed as accepted.",
                severity="medium",
            )
        )

    source_warnings = normalize_tokens(source.get("declaredContentWarnings"))
    excluded = normalize_tokens(candidate.get("excludedTopics"))
    if any(warning in excluded for warning in source_warnings):
        penalties.append(
            MatchPenalty(
                code="excluded_topic_overlap",
                label="Declared content overlaps with an excluded topic.",
                severity="high",
            )
        )
    return penalties[:8]


def build_safe_snippets(
    source: dict[str, object],
    candidate: dict[str, object],
) -> list[MatchSafeSnippet]:
    snippets = [
        snippet("Source", source.get("logline") or source.get("submissionGuidelines")),
        snippet("Candidate", candidate.get("whatWeAreLookingFor") or candidate.get("logline")),
        snippet("Arc", source.get("arcSummary") or candidate.get("arcSummary")),
    ]
    return [item for item in snippets if item is not None][:6]


def snippet(label: str, value: object) -> MatchSafeSnippet | None:
    if not isinstance(value, str):
        return None
    trimmed = re.sub(r"\s+", " ", value).strip()
    if not trimmed:
        return None
    return MatchSafeSnippet(label=label, text=trimmed[:360])


def collect_text(row: dict[str, object], keys: list[str]) -> str:
    return " ".join(token for key in keys for token in normalize_tokens(row.get(key)))


def overlap_score(left: str, right: str) -> float:
    left_tokens = unique_tokens(left)
    right_tokens = unique_tokens(right)
    if not left_tokens or not right_tokens:
        return 0.4
    right_set = set(right_tokens)
    overlap = len([token for token in left_tokens if token in right_set])
    return 0.45 + overlap / max(len(left_tokens), len(right_tokens))


def arrays_overlap(
    source: dict[str, object],
    candidate: dict[str, object],
    source_keys: list[str],
    candidate_keys: list[str],
) -> bool:
    source_tokens = [token for key in source_keys for token in normalize_tokens(source.get(key))]
    candidate_tokens = [
        token for key in candidate_keys for token in normalize_tokens(candidate.get(key))
    ]
    if not source_tokens or not candidate_tokens:
        return True
    candidate_set = set(candidate_tokens)
    return any(token in candidate_set for token in source_tokens)


def normalize_tokens(value: object) -> list[str]:
    if isinstance(value, list):
        return [token for item in value for token in normalize_tokens(item)]
    if isinstance(value, (int, float)):
        return [str(value)]
    if not isinstance(value, str):
        return []
    return unique_tokens(value)


def unique_tokens(value: str) -> list[str]:
    normalized = [
        token.strip()
        for token in re.split(r"[^a-z0-9çğıöşü]+", value.lower())
        if len(token.strip()) >= 2
    ]
    return list(dict.fromkeys(normalized))


def seeded_jitter(seed: str, axis: str) -> float:
    hex_value = sha256(f"{seed}:{axis}".encode()).hexdigest()[:4]
    return (int(hex_value, 16) / 0xFFFF) * 0.08


def bounded_score(value: float) -> float:
    return max(0.0, min(1.0, round(value, 4)))


def score_band(score: float) -> ScoreBand:
    if score >= 0.7:
        return "strong"
    if score >= 0.5:
        return "moderate"
    return "weak"


def penalty_value(severity: PenaltySeverity) -> float:
    if severity == "high":
        return 0.2
    if severity == "medium":
        return 0.12
    return 0.06
