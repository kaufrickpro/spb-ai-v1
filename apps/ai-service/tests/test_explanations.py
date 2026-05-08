import json

import httpx
import pytest

from app.modules.config import AiServiceConfig
from app.modules.explanations import (
    ExplanationSafetyError,
    MatchCandidateEvidence,
    VertexGeminiExplanationProvider,
    build_explanation_prompt,
    parse_vertex_json_response,
)


def test_prompt_uses_bounded_allowlisted_evidence() -> None:
    prompt = build_explanation_prompt([candidate_evidence()])

    assert "downloadUrl" not in prompt
    assert "sample text" not in prompt
    assert "provider_payload" not in prompt
    assert "Good metadata overlap." in prompt


def test_prompt_rejects_forbidden_evidence() -> None:
    evidence = candidate_evidence(
        safe_snippets=[{"label": "Unsafe", "text": "downloadUrl=https://x"}]
    )

    with pytest.raises(ExplanationSafetyError, match="downloadUrl"):
        build_explanation_prompt([evidence])


def test_vertex_response_must_include_every_top_candidate() -> None:
    evidence = [candidate_evidence()]
    payload = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps(
                                [
                                    {
                                        "candidate_id": "other",
                                        "paragraph": (
                                            "This response is long enough but for "
                                            "the wrong candidate."
                                        ),
                                    }
                                ]
                            )
                        }
                    ]
                }
            }
        ]
    }

    with pytest.raises(ExplanationSafetyError, match="missed"):
        parse_vertex_json_response(payload, evidence)


def test_vertex_provider_calls_metadata_and_generate_content() -> None:
    requests: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        if "metadata.google.internal" in str(request.url):
            return httpx.Response(200, json={"access_token": "token"})
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        [
                                            {
                                                "candidate_id": "candidate-1",
                                                "paragraph": (
                                                    "This candidate is a strong fit "
                                                    "because the supplied metadata, "
                                                    "snippets, and watch-outs align "
                                                    "clearly."
                                                ),
                                            }
                                        ]
                                    )
                                }
                            ]
                        }
                    }
                ]
            },
        )

    provider = VertexGeminiExplanationProvider(
        AiServiceConfig(
            explanation_provider="vertex_gemini",
            vertex_project_id="project-1",
            vertex_location="europe-west1",
            gemini_explanation_model="gemini-2.5-flash",
        ),
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    result = provider.explain_top_candidates([candidate_evidence()])

    assert result.provider == "vertex_gemini"
    assert result.explanations[0].candidate_id == "candidate-1"
    assert any("metadata.google.internal" in url for url in requests)
    assert any("gemini-2.5-flash:generateContent" in url for url in requests)


def candidate_evidence(**overrides: object) -> MatchCandidateEvidence:
    payload: dict[str, object] = {
        "candidate_id": "candidate-1",
        "rank": 1,
        "title": "Candidate",
        "candidate_type": "publisher",
        "score_band": "strong",
        "axis_bands": {
            "premise": "strong",
            "voice": "moderate",
            "arc": "strong",
        },
        "fit_reasons": ["Good metadata overlap."],
        "risk_reasons": [],
        "penalties": [],
        "safe_snippets": [{"label": "Source", "text": "A bounded safe snippet."}],
    }
    payload.update(overrides)
    return MatchCandidateEvidence.model_validate(payload)
