import json
from dataclasses import dataclass
from typing import Literal, Protocol

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.modules.config import AiServiceConfig

EXPLANATION_PROMPT_VERSION = "match-explanation-json-v1"
FORBIDDEN_EVIDENCE_TERMS = (
    "downloadUrl",
    "signedUrl",
    "service_role",
    "admin note",
    "provider_payload",
    "sample text",
    "raw_payload",
)


class MatchSnippetEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=360)


class MatchPenaltyEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=160)
    severity: Literal["low", "medium", "high"]


class MatchCandidateEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidate_id: str
    rank: int = Field(ge=1, le=10)
    title: str = Field(min_length=1, max_length=200)
    candidate_type: Literal["publisher", "manuscript"]
    score_band: Literal["strong", "moderate", "weak"]
    axis_bands: dict[Literal["premise", "voice", "arc"], Literal["strong", "moderate", "weak"]]
    fit_reasons: list[str] = Field(max_length=8)
    risk_reasons: list[str] = Field(max_length=8)
    penalties: list[MatchPenaltyEvidence] = Field(max_length=8)
    safe_snippets: list[MatchSnippetEvidence] = Field(max_length=6)


class MatchExplanation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidate_id: str
    paragraph: str = Field(min_length=40, max_length=1200)


@dataclass(frozen=True)
class ExplanationBatchResult:
    explanations: list[MatchExplanation]
    model: str
    prompt_version: str
    provider: str


class ExplanationProvider(Protocol):
    def explain_top_candidates(
        self, evidence: list[MatchCandidateEvidence]
    ) -> ExplanationBatchResult:
        """Generate one validated paragraph for every top-10 candidate."""


class ExplanationSafetyError(Exception):
    """Raised when explanation evidence or provider output is unsafe."""


class LocalExplanationProvider:
    def explain_top_candidates(
        self, evidence: list[MatchCandidateEvidence]
    ) -> ExplanationBatchResult:
        return ExplanationBatchResult(
            explanations=[
                MatchExplanation(
                    candidate_id=item.candidate_id,
                    paragraph=(
                        "Local matching found enough safe profile and manuscript "
                        "metadata overlap to keep this candidate visible for testing."
                    ),
                )
                for item in evidence
            ],
            model="local-explanation-reference-v1",
            prompt_version="local-match-explanation-v1",
            provider="local",
        )


class VertexGeminiExplanationProvider:
    def __init__(
        self,
        config: AiServiceConfig,
        http_client: httpx.Client | None = None,
    ) -> None:
        if not config.vertex_project_id or not config.vertex_location:
            raise ExplanationSafetyError("Vertex project and location are required")
        if not config.gemini_explanation_model:
            raise ExplanationSafetyError("Gemini explanation model is required")
        self.config = config
        self.http_client = http_client or httpx.Client(timeout=30)

    def explain_top_candidates(
        self, evidence: list[MatchCandidateEvidence]
    ) -> ExplanationBatchResult:
        if not evidence:
            return ExplanationBatchResult(
                explanations=[],
                model=self.config.gemini_explanation_model or "",
                prompt_version=EXPLANATION_PROMPT_VERSION,
                provider="vertex_gemini",
            )
        prompt = build_explanation_prompt(evidence)
        token = self._metadata_access_token()
        response = self.http_client.post(
            self._generate_content_url(),
            headers={"authorization": f"Bearer {token}"},
            json={
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.2,
                },
            },
        )
        response.raise_for_status()
        explanations = parse_vertex_json_response(response.json(), evidence)
        return ExplanationBatchResult(
            explanations=explanations,
            model=self.config.gemini_explanation_model or "",
            prompt_version=EXPLANATION_PROMPT_VERSION,
            provider="vertex_gemini",
        )

    def _metadata_access_token(self) -> str:
        response = self.http_client.get(
            "http://metadata.google.internal/computeMetadata/v1/"
            "instance/service-accounts/default/token",
            headers={"Metadata-Flavor": "Google"},
        )
        response.raise_for_status()
        token = response.json().get("access_token")
        if not isinstance(token, str) or not token:
            raise ExplanationSafetyError("Metadata server did not return an access token")
        return token

    def _generate_content_url(self) -> str:
        return (
            f"https://{self.config.vertex_location}-aiplatform.googleapis.com/v1/"
            f"projects/{self.config.vertex_project_id}/locations/"
            f"{self.config.vertex_location}/publishers/google/models/"
            f"{self.config.gemini_explanation_model}:generateContent"
        )


def build_explanation_prompt(evidence: list[MatchCandidateEvidence]) -> str:
    payload = [item.model_dump(mode="json") for item in evidence]
    serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    lowered = serialized.lower()
    for term in FORBIDDEN_EVIDENCE_TERMS:
        if term.lower() in lowered:
            raise ExplanationSafetyError(f"Forbidden explanation evidence: {term}")
    return (
        "Write one concise, grounded match explanation per candidate. "
        "Use only the JSON evidence. Do not mention private contact, samples, "
        "providers, admin notes, or unavailable data. Return JSON array items "
        "with candidate_id and paragraph.\n"
        f"Evidence: {serialized}"
    )


def parse_vertex_json_response(
    payload: object,
    expected: list[MatchCandidateEvidence],
) -> list[MatchExplanation]:
    try:
        text = (
            payload["candidates"][0]["content"]["parts"][0]["text"]  # type: ignore[index]
        )
        parsed = json.loads(text)
        explanations = [MatchExplanation.model_validate(item) for item in parsed]
    except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValidationError) as exc:
        raise ExplanationSafetyError("Invalid Gemini explanation response") from exc

    expected_ids = [item.candidate_id for item in expected]
    returned_ids = [item.candidate_id for item in explanations]
    if returned_ids != expected_ids:
        raise ExplanationSafetyError("Gemini explanation response missed top candidates")
    return explanations
