import json
from dataclasses import dataclass
from hashlib import sha256
from typing import Any, Protocol

from app.modules.embeddings import VertexTextEmbeddingAdapter
from app.modules.repositories import (
    EmbeddingRecordWrite,
    MatchSignalSourceWrite,
    MatchSignalType,
)
from app.modules.retrieval import VectorDatapoint, VectorRestrict, VertexVectorSearchAdapter

MATCH_SIGNAL_VECTOR_INDEX = "match-signal-reference-index"
MATCH_SIGNAL_EMBEDDING_MODEL = "reference-only-local"


class SignalSourceRepository(Protocol):
    def upsert_match_signal_source(self, signal: MatchSignalSourceWrite) -> str:
        """Persist one match signal source."""


class SignalEmbeddingProvider(Protocol):
    def create_signal_embedding(
        self,
        *,
        signal_type: MatchSignalType,
        source_id: str,
        source_type: str,
        fingerprint: str,
        text: str,
    ) -> EmbeddingRecordWrite:
        """Embed/upsert a current signal and return its durable external reference."""


@dataclass(frozen=True)
class LocalSignalEmbeddingProvider:
    vector_index_name: str = MATCH_SIGNAL_VECTOR_INDEX
    embedding_model: str = MATCH_SIGNAL_EMBEDDING_MODEL

    def create_signal_embedding(
        self,
        *,
        signal_type: MatchSignalType,
        source_id: str,
        source_type: str,
        fingerprint: str,
        text: str,
    ) -> EmbeddingRecordWrite:
        del text
        return build_embedding_reference(
            signal_type=signal_type,
            source_id=source_id,
            source_type=source_type,
            fingerprint=fingerprint,
            vector_index_name=self.vector_index_name,
            embedding_model=self.embedding_model,
        )


DEFAULT_SIGNAL_EMBEDDING_PROVIDER = LocalSignalEmbeddingProvider()


@dataclass(frozen=True)
class VertexSignalEmbeddingProvider:
    embedding_adapter: VertexTextEmbeddingAdapter
    vector_search_adapter: VertexVectorSearchAdapter
    vector_index_name: str

    def create_signal_embedding(
        self,
        *,
        signal_type: MatchSignalType,
        source_id: str,
        source_type: str,
        fingerprint: str,
        text: str,
    ) -> EmbeddingRecordWrite:
        vector = self.embedding_adapter.embed_signal_text(text)
        reference = build_embedding_reference(
            signal_type=signal_type,
            source_id=source_id,
            source_type=source_type,
            fingerprint=fingerprint,
            vector_index_name=self.vector_index_name,
            embedding_model=self.embedding_adapter.config.embedding_model,
            provider="vertex",
        )
        self.vector_search_adapter.upsert_datapoints(
            [
                VectorDatapoint(
                    datapoint_id=reference.vector_datapoint_id,
                    feature_vector=vector,
                    restricts=[
                        VectorRestrict(namespace="signal_axis", allow_list=[signal_type]),
                        VectorRestrict(namespace="source_type", allow_list=[source_type]),
                    ],
                    metadata={
                        "source_id": source_id,
                        "source_type": source_type,
                        "signal_type": signal_type,
                    },
                )
            ]
        )
        return reference


def upsert_manuscript_signals(
    repository: SignalSourceRepository,
    manuscript: dict[str, object],
    manuscript_id: str,
    owner_profile_id: str,
    embedding_provider: SignalEmbeddingProvider = DEFAULT_SIGNAL_EMBEDDING_PROVIDER,
) -> list[str]:
    signals = build_manuscript_signal_writes(
        manuscript=normalize_manuscript_for_signals(manuscript),
        manuscript_id=manuscript_id,
        owner_profile_id=owner_profile_id,
        embedding_provider=embedding_provider,
    )
    return [repository.upsert_match_signal_source(signal) for signal in signals]


def upsert_publisher_signals(
    repository: SignalSourceRepository,
    publisher: dict[str, object],
    publisher_profile_id: str,
    owner_profile_id: str,
    embedding_provider: SignalEmbeddingProvider = DEFAULT_SIGNAL_EMBEDDING_PROVIDER,
) -> list[str]:
    signals = build_publisher_signal_writes(
        publisher=normalize_publisher_for_signals(publisher),
        publisher_profile_id=publisher_profile_id,
        owner_profile_id=owner_profile_id,
        embedding_provider=embedding_provider,
    )
    return [repository.upsert_match_signal_source(signal) for signal in signals]


def build_manuscript_signal_writes(
    manuscript: dict[str, object],
    manuscript_id: str,
    owner_profile_id: str,
    embedding_provider: SignalEmbeddingProvider = DEFAULT_SIGNAL_EMBEDDING_PROVIDER,
) -> list[MatchSignalSourceWrite]:
    normalized = normalize_manuscript_for_signals(manuscript)
    signals = [
        build_signal("premise", normalized, PREMISE_KEYS, optional=False),
        build_signal("voice", normalized, VOICE_KEYS, optional=False),
        build_signal("arc", normalized, ARC_KEYS, optional=False),
    ]
    return [
        build_signal_source_write(
            signal=signal,
            owner_profile_id=owner_profile_id,
            manuscript_id=manuscript_id,
            publisher_profile_id=None,
            source_type="manuscript",
            source_id=manuscript_id,
            embedding_provider=embedding_provider,
        )
        for signal in signals
    ]


def build_publisher_signal_writes(
    publisher: dict[str, object],
    publisher_profile_id: str,
    owner_profile_id: str,
    embedding_provider: SignalEmbeddingProvider = DEFAULT_SIGNAL_EMBEDDING_PROVIDER,
) -> list[MatchSignalSourceWrite]:
    normalized = normalize_publisher_for_signals(publisher)
    signals = [
        build_signal("guidelines", normalized, GUIDELINES_KEYS, optional=False),
        build_signal("wishlist", normalized, WISHLIST_KEYS, optional=True),
        build_signal("catalog", normalized, CATALOG_KEYS, optional=True),
    ]
    return [
        build_signal_source_write(
            signal=signal,
            owner_profile_id=owner_profile_id,
            manuscript_id=None,
            publisher_profile_id=publisher_profile_id,
            source_type="publisher_profile",
            source_id=publisher_profile_id,
            embedding_provider=embedding_provider,
        )
        for signal in signals
    ]


def normalize_manuscript_for_signals(manuscript: dict[str, object]) -> dict[str, object]:
    return {
        **manuscript,
        "primaryGenre": manuscript.get("primaryGenre") or manuscript.get("genre"),
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
        "arcSummary": manuscript.get("arcSummary") or manuscript.get("arc_summary"),
        "chapterSummaries": manuscript.get("chapterSummaries")
        or manuscript.get("chapter_summaries")
        or [],
        "shortTeaser": manuscript.get("shortTeaser") or manuscript.get("short_teaser"),
        "profileTeaser": manuscript.get("profileTeaser")
        or manuscript.get("profile_teaser"),
    }


def normalize_publisher_for_signals(publisher: dict[str, object]) -> dict[str, object]:
    return {
        **publisher,
        "publisherName": publisher.get("publisherName")
        or publisher.get("publisher_name")
        or publisher.get("display_name"),
        "displayName": publisher.get("displayName") or publisher.get("display_name"),
        "focusGenres": publisher.get("focusGenres") or publisher.get("focus_genres") or [],
        "acceptedPrimaryGenres": publisher.get("acceptedPrimaryGenres")
        or publisher.get("accepted_primary_genres")
        or publisher.get("focus_genres")
        or [],
        "acceptedAudienceCategories": publisher.get("acceptedAudienceCategories")
        or publisher.get("accepted_audience_categories")
        or [],
        "acceptedManuscriptForms": publisher.get("acceptedManuscriptForms")
        or publisher.get("accepted_manuscript_forms")
        or [],
        "submissionGuidelines": publisher.get("submissionGuidelines")
        or publisher.get("submission_guidelines"),
        "whatWeAreLookingFor": publisher.get("whatWeAreLookingFor")
        or publisher.get("what_we_are_looking_for"),
        "excludedTopics": publisher.get("excludedTopics")
        or publisher.get("excluded_topics")
        or [],
        "editorWishlist": publisher.get("editorWishlist")
        or publisher.get("editor_wishlist"),
        "imprintTone": publisher.get("imprintTone") or publisher.get("imprint_tone"),
        "marketPositioning": publisher.get("marketPositioning")
        or publisher.get("market_positioning"),
        "recentAcquisitions": publisher.get("recentAcquisitions")
        or publisher.get("recent_acquisitions")
        or [],
        "bestSellingBooks": publisher.get("bestSellingBooks")
        or publisher.get("best_selling_books")
        or [],
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
    if not bounded_summary:
        return {
            "fingerprint": fingerprint_signal(signal_type, None),
            "signal_type": signal_type,
            "status": "stale",
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
    embedding_provider: SignalEmbeddingProvider = DEFAULT_SIGNAL_EMBEDDING_PROVIDER,
) -> MatchSignalSourceWrite:
    summary = signal["summary"]
    signal_type = signal["signal_type"]
    embedding = (
        embedding_provider.create_signal_embedding(
            signal_type=signal_type,
            source_id=source_id,
            source_type=source_type,
            fingerprint=signal["fingerprint"],
            text=summary,
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
            "provider": (
                "ai-service-reference"
                if embedding is None
                else str(embedding.metadata.get("provider", "ai-service-reference"))
            ),
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
    vector_index_name: str = MATCH_SIGNAL_VECTOR_INDEX,
    embedding_model: str = MATCH_SIGNAL_EMBEDDING_MODEL,
    provider: str = "ai-service-reference",
) -> EmbeddingRecordWrite:
    vector_datapoint_id = (
        f"match-signal-{signal_type}-{source_id}-{fingerprint}"
    )[:200]
    return EmbeddingRecordWrite(
        source_type=source_type,
        source_id=source_id,
        vector_index_name=vector_index_name,
        vector_datapoint_id=vector_datapoint_id,
        embedding_model=embedding_model,
        metadata={
            "provider": provider,
            "signal_type": signal_type,
            "has_vector_array": False,
        },
    )
