from app.modules.matching_signals import (
    build_manuscript_signal_writes,
    build_publisher_signal_writes,
    fingerprint_signal,
    upsert_publisher_signals,
)
from app.modules.repositories import MatchSignalSourceWrite


class CapturingMatchingRepository:
    def __init__(self) -> None:
        self.signals: list[MatchSignalSourceWrite] = []

    def upsert_match_signal_source(self, signal: MatchSignalSourceWrite) -> str:
        self.signals.append(signal)
        return f"signal-{len(self.signals)}"


def test_builds_three_manuscript_signals_with_reference_only_embeddings() -> None:
    signals = build_manuscript_signal_writes(
        manuscript={
            "title": "Kayıp Şehir",
            "genre": "Roman",
            "audience_categories": ["adult"],
            "manuscript_form": "novel",
            "logline": "A family mystery across Istanbul.",
            "declared_themes": ["memory"],
            "arc_summary": "The protagonist uncovers a hidden archive.",
        },
        manuscript_id="10000000-0000-4000-8000-000000000001",
        owner_profile_id="20000000-0000-4000-8000-000000000001",
    )

    assert [signal.signal_type for signal in signals] == ["premise", "voice", "arc"]
    assert all(signal.status == "current" for signal in signals)
    assert all(signal.embedding is not None for signal in signals)
    assert signals[0].summary is not None
    assert "Kayıp Şehir" in signals[0].summary
    assert signals[0].metadata == {
        "provider": "ai-service-reference",
        "source_type": "manuscript",
        "vector_storage": "external_reference_only",
        "has_vector_array": False,
    }
    assert signals[0].embedding is not None
    assert signals[0].embedding.metadata == {
        "provider": "ai-service-reference",
        "signal_type": "premise",
        "has_vector_array": False,
    }
    assert "vector" not in signals[0].embedding.metadata


def test_builds_missing_optional_publisher_signals_without_embedding_reference() -> None:
    signals = build_publisher_signal_writes(
        publisher={
            "publisherName": "Bridge Publishing",
            "acceptedPrimaryGenres": ["Roman"],
            "submissionGuidelines": "Literary fiction with strong editorial arc.",
        },
        publisher_profile_id="30000000-0000-4000-8000-000000000001",
        owner_profile_id="30000000-0000-4000-8000-000000000001",
    )

    by_type = {signal.signal_type: signal for signal in signals}
    assert by_type["guidelines"].status == "current"
    assert by_type["guidelines"].embedding is not None
    assert by_type["wishlist"].status == "missing_optional"
    assert by_type["wishlist"].summary is None
    assert by_type["wishlist"].embedding is None
    assert by_type["catalog"].status == "missing_optional"
    assert by_type["catalog"].summary is None
    assert by_type["catalog"].embedding is None


def test_signal_fingerprint_changes_when_summary_changes() -> None:
    first = fingerprint_signal("premise", "literary mystery")
    second = fingerprint_signal("premise", "historical romance")

    assert first != second
    assert len(first) == 32


def test_upsert_publisher_signals_uses_repository_boundary() -> None:
    repository = CapturingMatchingRepository()

    ids = upsert_publisher_signals(
        repository,
        publisher={
            "publisherName": "Bridge Publishing",
            "acceptedPrimaryGenres": ["Roman"],
            "editorWishlist": "Voice-led novels.",
        },
        publisher_profile_id="30000000-0000-4000-8000-000000000001",
        owner_profile_id="30000000-0000-4000-8000-000000000001",
    )

    assert ids == ["signal-1", "signal-2", "signal-3"]
    assert [signal.signal_type for signal in repository.signals] == [
        "guidelines",
        "wishlist",
        "catalog",
    ]
