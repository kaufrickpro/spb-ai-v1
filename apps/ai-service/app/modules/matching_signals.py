import json
from hashlib import sha256
from typing import Any, Protocol

from app.modules.repositories import (
    EmbeddingRecordWrite,
    MatchSignalSourceWrite,
    MatchSignalType,
)

MATCH_SIGNAL_VECTOR_INDEX = "match-signal-reference-index"
MATCH_SIGNAL_EMBEDDING_MODEL = "reference-only-local"


class SignalSourceRepository(Protocol):
    def upsert_match_signal_source(self, signal: MatchSignalSourceWrite) -> str:
        """Persist one match signal source."""


def upsert_manuscript_signals(
    repository: SignalSourceRepository,
    manuscript: dict[str, object],
    manuscript_id: str,
    owner_profile_id: str,
) -> list[str]:
    signals = build_manuscript_signal_writes(
        manuscript=normalize_manuscript_for_signals(manuscript),
        manuscript_id=manuscript_id,
        owner_profile_id=owner_profile_id,
    )
    return [repository.upsert_match_signal_source(signal) for signal in signals]


def upsert_publisher_signals(
    repository: SignalSourceRepository,
    publisher: dict[str, object],
    publisher_profile_id: str,
    owner_profile_id: str,
) -> list[str]:
    signals = build_publisher_signal_writes(
        publisher=publisher,
        publisher_profile_id=publisher_profile_id,
        owner_profile_id=owner_profile_id,
    )
    return [repository.upsert_match_signal_source(signal) for signal in signals]


def build_manuscript_signal_writes(
    manuscript: dict[str, object],
    manuscript_id: str,
    owner_profile_id: str,
) -> list[MatchSignalSourceWrite]:
    signals = [
        build_signal("premise", manuscript, PREMISE_KEYS, optional=False),
        build_signal("voice", manuscript, VOICE_KEYS, optional=False),
        build_signal("arc", manuscript, ARC_KEYS, optional=False),
    ]
    return [
        build_signal_source_write(
            signal=signal,
            owner_profile_id=owner_profile_id,
            manuscript_id=manuscript_id,
            publisher_profile_id=None,
            source_type="manuscript",
            source_id=manuscript_id,
        )
        for signal in signals
    ]


def build_publisher_signal_writes(
    publisher: dict[str, object],
    publisher_profile_id: str,
    owner_profile_id: str,
) -> list[MatchSignalSourceWrite]:
    signals = [
        build_signal("guidelines", publisher, GUIDELINES_KEYS, optional=False),
        build_signal("wishlist", publisher, WISHLIST_KEYS, optional=True),
        build_signal("catalog", publisher, CATALOG_KEYS, optional=True),
    ]
    return [
        build_signal_source_write(
            signal=signal,
            owner_profile_id=owner_profile_id,
            manuscript_id=None,
            publisher_profile_id=publisher_profile_id,
            source_type="publisher_profile",
            source_id=publisher_profile_id,
        )
        for signal in signals
    ]


def normalize_manuscript_for_signals(manuscript: dict[str, object]) -> dict[str, object]:
    return {
        **manuscript,
        "audienceCategories": manuscript.get("audienceCategories")
        or manuscript.get("audience_categories")
        or [],
        "declaredContentWarnings": manuscript.get("declaredContentWarnings")
        or manuscript.get("declared_content_warnings")
        or [],
        "declaredThemes": manuscript.get("declaredThemes")
        or manuscript.get("declared_themes")
        or [],
        "manuscriptForm": manuscript.get("manuscriptForm")
        or manuscript.get("manuscript_form"),
        "profileTeaser": manuscript.get("profileTeaser")
        or manuscript.get("profile_teaser"),
    }


def fingerprint_signal(signal_type: MatchSignalType, summary: str | None) -> str:
    payload = {"signalType": signal_type, "summary": summary or ""}
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return sha256(serialized.encode()).hexdigest()[:32]


def normalize_values(value: object) -> list[str]:
    if isinstance(value, list):
        normalized: list[str] = []
        for item in value:
            normalized.extend(normalize_values(item))
        return normalized
    if isinstance(value, (int, float)):
        return [str(value)]
    if not isinstance(value, str):
        return []
    trimmed = " ".join(value.split())
    return [trimmed] if trimmed else []


PREMISE_KEYS = [
    "title",
    "genre",
    "subgenres",
    "audienceCategories",
    "manuscriptForm",
    "logline",
    "synopsis",
]
VOICE_KEYS = [
    "styleStatement",
    "influences",
    "declaredThemes",
    "shortTeaser",
    "profileTeaser",
]
ARC_KEYS = [
    "arcSummary",
    "chapterSummaries",
    "declaredContentWarnings",
]
GUIDELINES_KEYS = [
    "publisherName",
    "displayName",
    "focusGenres",
    "acceptedPrimaryGenres",
    "acceptedAudienceCategories",
    "acceptedManuscriptForms",
    "submissionGuidelines",
    "whatWeAreLookingFor",
    "excludedTopics",
]
WISHLIST_KEYS = [
    "editorWishlist",
    "imprintTone",
    "marketPositioning",
]
CATALOG_KEYS = [
    "recentAcquisitions",
    "bestSellingBooks",
]


def build_signal(
    signal_type: MatchSignalType,
    source: dict[str, object],
    keys: list[str],
    *,
    optional: bool,
) -> dict[str, Any]:
    summary = " ".join(
        value
        for key in keys
        for value in normalize_values(source.get(key))
    )
    bounded_summary = " ".join(summary.split())[:900]
    if not bounded_summary and optional:
        return {
            "fingerprint": fingerprint_signal(signal_type, None),
            "signal_type": signal_type,
            "status": "missing_optional",
            "summary": None,
        }
    fallback_summary = bounded_summary or "No declared signal text yet."
    return {
        "fingerprint": fingerprint_signal(signal_type, fallback_summary),
        "signal_type": signal_type,
        "status": "current",
        "summary": fallback_summary,
    }


def build_signal_source_write(
    *,
    signal: dict[str, Any],
    owner_profile_id: str,
    manuscript_id: str | None,
    publisher_profile_id: str | None,
    source_type: str,
    source_id: str,
) -> MatchSignalSourceWrite:
    summary = signal["summary"]
    signal_type = signal["signal_type"]
    embedding = (
        build_embedding_reference(
            signal_type=signal_type,
            source_id=source_id,
            source_type=source_type,
            fingerprint=signal["fingerprint"],
        )
        if summary is not None
        else None
    )
    return MatchSignalSourceWrite(
        owner_profile_id=owner_profile_id,
        manuscript_id=manuscript_id,
        publisher_profile_id=publisher_profile_id,
        signal_type=signal_type,
        fingerprint=signal["fingerprint"],
        source_fingerprint=signal["fingerprint"],
        status=signal["status"],
        summary=summary,
        embedding=embedding,
        metadata={
            "provider": "ai-service-reference",
            "source_type": source_type,
            "vector_storage": "external_reference_only",
            "has_vector_array": False,
        },
    )


def build_embedding_reference(
    *,
    signal_type: MatchSignalType,
    source_id: str,
    source_type: str,
    fingerprint: str,
) -> EmbeddingRecordWrite:
    vector_datapoint_id = (
        f"match-signal-{signal_type}-{source_id}-{fingerprint}"
    )[:200]
    return EmbeddingRecordWrite(
        source_type=source_type,
        source_id=source_id,
        vector_index_name=MATCH_SIGNAL_VECTOR_INDEX,
        vector_datapoint_id=vector_datapoint_id,
        embedding_model=MATCH_SIGNAL_EMBEDDING_MODEL,
        metadata={
            "provider": "ai-service-reference",
            "signal_type": signal_type,
            "has_vector_array": False,
        },
    )
