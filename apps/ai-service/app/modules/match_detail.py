import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.modules.matching_scoring import MatchScoringResult
from app.modules.repositories import MatchRunRecord

ScoreBand = Literal["strong", "moderate", "weak"]
ComparisonStatus = Literal["match", "partial", "mismatch", "unknown"]
SourceType = Literal[
    "manuscript_metadata",
    "manuscript_sample",
    "publisher_guidelines",
    "publisher_wishlist",
    "publisher_catalog",
    "unknown",
]

FORBIDDEN_KEYS = {
    "scoreDebug",
    "rawScore",
    "finalScore",
    "vector",
    "vectors",
    "embedding",
    "embeddings",
    "embeddingId",
    "providerPayload",
    "prompt",
    "signedUrl",
    "downloadUrl",
    "privateContact",
    "email",
    "phone",
    "adminNotes",
    "billingState",
    "documentChunks",
    "fullManuscriptText",
    "fullSynopsis",
    "chapterSummaries",
}

FORBIDDEN_TEXT = re.compile(
    r"https?://\S*(?:signed|download|token)\S*|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}",
    re.IGNORECASE,
)


class DetailPair(BaseModel):
    model_config = ConfigDict(extra="forbid")

    manuscriptId: str | None
    manuscriptTitle: str | None = Field(max_length=200)
    publisherProfileId: str | None
    publisherName: str | None = Field(max_length=200)
    sourceSide: Literal["manuscript", "publisher"]


class PublisherContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    acceptedGenres: list[str] = Field(max_length=20)
    acceptedAudienceCategories: list[str] = Field(max_length=20)
    acceptedManuscriptForms: list[str] = Field(max_length=20)
    excludedTopics: list[str] = Field(max_length=20)
    guidelinesSummary: str | None = Field(max_length=420)
    wishlistSummary: str | None = Field(max_length=420)
    catalogSummary: str | None = Field(max_length=420)


class ManuscriptContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    genre: str | None = Field(max_length=120)
    subgenres: list[str] = Field(max_length=20)
    audienceCategories: list[str] = Field(max_length=20)
    manuscriptForm: str | None = Field(max_length=120)
    language: str | None = Field(max_length=40)
    wordCount: int | None = Field(ge=0)
    themes: list[str] = Field(max_length=20)
    declaredContentWarnings: list[str] = Field(max_length=20)
    logline: str | None = Field(max_length=360)
    teaser: str | None = Field(max_length=360)


class ComparisonRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: Literal[
        "genre",
        "audience",
        "manuscript_form",
        "language",
        "word_count",
        "themes",
        "content_warnings",
    ]
    status: ComparisonStatus
    manuscriptValues: list[str] = Field(max_length=12)
    publisherValues: list[str] = Field(max_length=12)
    noteCode: str = Field(min_length=1, max_length=100)
    noteParams: dict[str, str | int | float | bool] = Field(default_factory=dict)


class AxisEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    band: ScoreBand
    manuscriptSignal: Literal["premise", "voice", "arc"]
    publisherSignal: Literal["guidelines", "wishlist", "catalog", "unknown"]
    manuscriptSummary: str | None = Field(max_length=420)
    publisherSummary: str | None = Field(max_length=420)
    reasons: list[str] = Field(max_length=6)


class DetailSnippet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=360)
    sourceType: SourceType


class DetailEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fitReasons: list[str] = Field(max_length=8)
    watchOuts: list[str] = Field(max_length=8)
    safeSnippets: list[DetailSnippet] = Field(max_length=6)


class MatchDetailSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pair: DetailPair
    publisherContext: PublisherContext | None
    manuscriptContext: ManuscriptContext | None
    comparison: list[ComparisonRow] = Field(max_length=12)
    axisEvidence: dict[Literal["premise", "voice", "arc"], AxisEvidence]
    evidence: DetailEvidence
    limitations: list[str] = Field(max_length=8)

    @field_validator("*", mode="before")
    @classmethod
    def reject_sensitive_values(cls, value: object) -> object:
        reject_forbidden(value)
        return value

    @model_validator(mode="after")
    def require_all_axes(self) -> "MatchDetailSnapshot":
        if set(self.axisEvidence) != {"premise", "voice", "arc"}:
            raise ValueError("axisEvidence must include premise, voice, and arc")
        return self


def build_detail_snapshot(
    *,
    run: MatchRunRecord,
    source: dict[str, object],
    candidate: dict[str, object],
    result: MatchScoringResult,
    candidate_profile_id: str,
    candidate_manuscript_id: str | None,
    is_manuscript: bool,
) -> dict[str, object]:
    manuscript = candidate if is_manuscript else source
    publisher = source if is_manuscript else candidate
    snapshot = MatchDetailSnapshot.model_validate(
        {
            "pair": {
                "manuscriptId": candidate_manuscript_id or text_value(manuscript, "id"),
                "manuscriptTitle": bounded(text_value(manuscript, "title"), 200),
                "publisherProfileId": (
                    text_value(publisher, "id") if is_manuscript else candidate_profile_id
                ),
                "publisherName": bounded(
                    text_value(publisher, "publisherName")
                    or text_value(publisher, "displayName"),
                    200,
                ),
                "sourceSide": (
                    "publisher"
                    if run.direction == "publisher_to_manuscript"
                    else "manuscript"
                ),
            },
            "publisherContext": publisher_context(publisher),
            "manuscriptContext": manuscript_context(manuscript),
            "comparison": comparison_rows(manuscript, publisher),
            "axisEvidence": axis_evidence(manuscript, publisher, result),
            "evidence": {
                "fitReasons": bounded_list(result.fit_reasons, 240, 8),
                "watchOuts": bounded_list(result.risk_reasons, 240, 8),
                "safeSnippets": [
                    {
                        "label": bounded(snippet.label, 80),
                        "text": bounded(snippet.text, 360),
                        "sourceType": snippet_source_type(snippet.label, run.direction),
                    }
                    for snippet in result.safe_snippets[:6]
                ],
            },
            "limitations": [],
        }
    )
    return snapshot.model_dump(mode="json")


def reject_forbidden(value: object) -> None:
    if isinstance(value, dict):
        for key, nested in value.items():
            if key in FORBIDDEN_KEYS:
                raise ValueError(f"detail_snapshot contains forbidden key {key}")
            reject_forbidden(nested)
        return
    if isinstance(value, list):
        for nested in value:
            reject_forbidden(nested)
        return
    if isinstance(value, str) and FORBIDDEN_TEXT.search(value):
        raise ValueError("detail_snapshot contains forbidden text")


def publisher_context(publisher: dict[str, object]) -> dict[str, object]:
    return {
        "acceptedGenres": list_values(publisher, "acceptedPrimaryGenres", "focusGenres"),
        "acceptedAudienceCategories": list_values(publisher, "acceptedAudienceCategories"),
        "acceptedManuscriptForms": list_values(publisher, "acceptedManuscriptForms"),
        "excludedTopics": list_values(publisher, "excludedTopics"),
        "guidelinesSummary": bounded(text_value(publisher, "submissionGuidelines"), 420),
        "wishlistSummary": bounded(
            text_value(publisher, "whatWeAreLookingFor")
            or text_value(publisher, "editorWishlist"),
            420,
        ),
        "catalogSummary": bounded(join_values(publisher.get("recentAcquisitions")), 420),
    }


def manuscript_context(manuscript: dict[str, object]) -> dict[str, object]:
    return {
        "genre": bounded(
            text_value(manuscript, "primaryGenre") or text_value(manuscript, "genre"),
            120,
        ),
        "subgenres": list_values(manuscript, "subgenres"),
        "audienceCategories": list_values(manuscript, "audienceCategories"),
        "manuscriptForm": bounded(text_value(manuscript, "manuscriptForm"), 120),
        "language": bounded(text_value(manuscript, "language"), 40),
        "wordCount": int_value(manuscript, "wordCount", "word_count"),
        "themes": list_values(manuscript, "declaredThemes"),
        "declaredContentWarnings": list_values(manuscript, "declaredContentWarnings"),
        "logline": bounded(text_value(manuscript, "logline"), 360),
        "teaser": bounded(
            text_value(manuscript, "shortTeaser")
            or text_value(manuscript, "profileTeaser"),
            360,
        ),
    }


def comparison_rows(
    manuscript: dict[str, object], publisher: dict[str, object]
) -> list[dict[str, object]]:
    return [
        compare_values(
            "genre",
            list_values(manuscript, "primaryGenre", "genre", "subgenres"),
            list_values(publisher, "acceptedPrimaryGenres", "focusGenres"),
        ),
        compare_values(
            "audience",
            list_values(manuscript, "audienceCategories"),
            list_values(publisher, "acceptedAudienceCategories"),
        ),
        compare_values(
            "manuscript_form",
            list_values(manuscript, "manuscriptForm"),
            list_values(publisher, "acceptedManuscriptForms"),
        ),
        compare_values(
            "language",
            list_values(manuscript, "language"),
            list_values(publisher, "preferredLanguages"),
        ),
        word_count_row(manuscript),
        compare_values(
            "themes",
            list_values(manuscript, "declaredThemes"),
            list_values(publisher, "whatWeAreLookingFor", "editorWishlist"),
        ),
        compare_values(
            "content_warnings",
            list_values(manuscript, "declaredContentWarnings"),
            list_values(publisher, "excludedTopics"),
            conflict_means_mismatch=True,
        ),
    ]


def compare_values(
    key: str,
    manuscript_values: list[str],
    publisher_values: list[str],
    *,
    conflict_means_mismatch: bool = False,
) -> dict[str, object]:
    if not manuscript_values or not publisher_values:
        status: ComparisonStatus = "unknown"
    else:
        overlap = has_overlap(manuscript_values, publisher_values)
        if conflict_means_mismatch:
            status = "mismatch" if overlap else "match"
        elif overlap and not all_values_overlap(manuscript_values, publisher_values):
            status = "partial"
        else:
            status = "match" if overlap else "mismatch"
    return {
        "key": key,
        "status": status,
        "manuscriptValues": manuscript_values[:12],
        "publisherValues": publisher_values[:12],
        "noteCode": f"matches.comparisonNotes.{key}.{status}",
        "noteParams": {},
    }


def word_count_row(manuscript: dict[str, object]) -> dict[str, object]:
    word_count = int_value(manuscript, "wordCount", "word_count")
    values = [str(word_count)] if word_count is not None else []
    return {
        "key": "word_count",
        "status": "unknown",
        "manuscriptValues": values,
        "publisherValues": [],
        "noteCode": "matches.comparisonNotes.word_count.unknown",
        "noteParams": {"wordCount": word_count} if word_count is not None else {},
    }


def axis_evidence(
    manuscript: dict[str, object],
    publisher: dict[str, object],
    result: MatchScoringResult,
) -> dict[str, dict[str, object]]:
    publisher_signals = {
        "premise": "guidelines",
        "voice": "wishlist",
        "arc": "catalog",
    }
    manuscript_summaries = {
        "premise": text_value(manuscript, "logline") or text_value(manuscript, "synopsis"),
        "voice": text_value(manuscript, "shortTeaser")
        or join_values(manuscript.get("declaredThemes")),
        "arc": text_value(manuscript, "arcSummary"),
    }
    publisher_summaries = {
        "premise": text_value(publisher, "submissionGuidelines"),
        "voice": text_value(publisher, "whatWeAreLookingFor")
        or text_value(publisher, "editorWishlist"),
        "arc": join_values(publisher.get("recentAcquisitions"))
        or text_value(publisher, "submissionGuidelines"),
    }
    return {
        axis: {
            "band": result.axis_bands[axis],
            "manuscriptSignal": axis,
            "publisherSignal": publisher_signals[axis],
            "manuscriptSummary": bounded(manuscript_summaries[axis], 420),
            "publisherSummary": bounded(publisher_summaries[axis], 420),
            "reasons": bounded_list(result.fit_reasons or result.risk_reasons, 220, 3),
        }
        for axis in ("premise", "voice", "arc")
    }


def snippet_source_type(
    label: str,
    direction: Literal["author_to_publisher", "publisher_to_manuscript"],
) -> SourceType:
    normalized = label.lower()
    if "arc" in normalized:
        return "manuscript_metadata"
    if "candidate" in normalized and direction == "author_to_publisher":
        return "publisher_wishlist"
    if "source" in normalized and direction == "author_to_publisher":
        return "manuscript_metadata"
    if "source" in normalized:
        return "publisher_guidelines"
    if "candidate" in normalized:
        return "manuscript_metadata"
    return "unknown"


def has_overlap(left: list[str], right: list[str]) -> bool:
    right_tokens = {token for item in right for token in tokens(item)}
    return any(token in right_tokens for item in left for token in tokens(item))


def all_values_overlap(left: list[str], right: list[str]) -> bool:
    right_tokens = {token for item in right for token in tokens(item)}
    left_tokens = {token for item in left for token in tokens(item)}
    return bool(left_tokens) and left_tokens.issubset(right_tokens)


def tokens(value: str) -> list[str]:
    return [
        token
        for token in re.split(r"[^a-z0-9çğıöşü]+", value.lower())
        if len(token) >= 2
    ]


def list_values(row: dict[str, object], *keys: str) -> list[str]:
    values: list[str] = []
    for key in keys:
        value = row.get(key)
        if isinstance(value, list):
            values.extend(str(item).strip() for item in value if str(item).strip())
        elif isinstance(value, str) and value.strip():
            values.append(value.strip())
    return bounded_list(list(dict.fromkeys(values)), 120, 20)


def text_value(row: dict[str, object], key: str) -> str | None:
    value = row.get(key)
    if not isinstance(value, str):
        return None
    trimmed = re.sub(r"\s+", " ", value).strip()
    return trimmed or None


def int_value(row: dict[str, object], *keys: str) -> int | None:
    for key in keys:
        value = row.get(key)
        if isinstance(value, int) and value >= 0:
            return value
        if isinstance(value, float) and value >= 0:
            return int(value)
    return None


def join_values(value: object) -> str | None:
    if isinstance(value, list):
        return bounded("; ".join(str(item).strip() for item in value if str(item).strip()), 420)
    if isinstance(value, str):
        return bounded(value, 420)
    return None


def bounded(value: str | None, limit: int) -> str | None:
    if value is None:
        return None
    trimmed = re.sub(r"\s+", " ", value).strip()
    if not trimmed:
        return None
    return trimmed[:limit]


def bounded_list(values: list[Any], item_limit: int, list_limit: int) -> list[str]:
    bounded_values = [bounded(str(value), item_limit) for value in values]
    return [value for value in bounded_values if value is not None][:list_limit]
