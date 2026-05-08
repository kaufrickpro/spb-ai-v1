import json
from typing import Any

import httpx
import pytest

from app.modules.config import AiServiceConfig
from app.modules.embeddings import VertexAdapterError, VertexTextEmbeddingAdapter
from app.modules.retrieval import (
    VectorDatapoint,
    VectorRestrict,
    VertexVectorSearchAdapter,
)


def test_vertex_embedding_adapter_maps_predict_request_and_response() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if "metadata.google.internal" in str(request.url):
            return httpx.Response(200, json={"access_token": "token"})
        assert request.headers["authorization"] == "Bearer token"
        assert request.url.path.endswith("/models/gemini-embedding-001:predict")
        assert json.loads(request.content) == {
            "instances": [
                {
                    "content": "A literary manuscript about memory.",
                    "task_type": "RETRIEVAL_DOCUMENT",
                }
            ],
            "parameters": {"outputDimensionality": 768},
        }
        return httpx.Response(
            200,
            json={"predictions": [{"embeddings": {"values": [0.1, 0.2, 0.3]}}]},
        )

    adapter = VertexTextEmbeddingAdapter(
        vertex_config(),
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    vector = adapter.embed_signal_text(
        "A literary manuscript about memory.",
        output_dimensionality=768,
    )

    assert vector == [0.1, 0.2, 0.3]
    assert any("metadata.google.internal" in str(request.url) for request in requests)


def test_vertex_embedding_adapter_rejects_unbounded_signal_text() -> None:
    adapter = VertexTextEmbeddingAdapter(
        vertex_config(),
        http_client=httpx.Client(
            transport=httpx.MockTransport(
                lambda _request: httpx.Response(500, json={})
            )
        ),
    )

    with pytest.raises(VertexAdapterError) as exc:
        adapter.embed_signal_text("x" * 8_001)

    assert exc.value.safe_failure_code == "vertex_embedding_input_invalid"


def test_vertex_embedding_adapter_wraps_provider_errors() -> None:
    adapter = VertexTextEmbeddingAdapter(
        vertex_config(),
        http_client=httpx.Client(
            transport=httpx.MockTransport(
                lambda _request: httpx.Response(503, json={"error": "unavailable"})
            )
        ),
        access_token_provider=lambda: "token",
    )

    with pytest.raises(VertexAdapterError) as exc:
        adapter.embed_signal_text("A bounded signal.")

    assert exc.value.safe_failure_code == "vertex_embedding_provider_error"


def test_vector_search_adapter_upserts_datapoints_with_metadata_and_restricts() -> None:
    posted_payloads: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        posted_payloads.append(json.loads(request.content))
        assert request.headers["authorization"] == "Bearer token"
        assert request.url.path.endswith("/indexes/6107839868853813248:upsertDatapoints")
        return httpx.Response(200, json={})

    adapter = VertexVectorSearchAdapter(
        vertex_config(),
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
        access_token_provider=lambda: "token",
    )

    adapter.upsert_datapoints(
        [
            VectorDatapoint(
                datapoint_id="signal-publisher-1-guidelines",
                feature_vector=[0.1, 0.2, 0.3],
                restricts=[
                    VectorRestrict(namespace="signal_axis", allow_list=["premise"]),
                    VectorRestrict(namespace="role", allow_list=["publisher"]),
                ],
                metadata={
                    "signal_source_id": "source-1",
                    "candidate_id": "publisher-1",
                    "has_vector_array": False,
                },
            )
        ]
    )

    assert posted_payloads == [
        {
            "datapoints": [
                {
                    "datapointId": "signal-publisher-1-guidelines",
                    "featureVector": [0.1, 0.2, 0.3],
                    "restricts": [
                        {"namespace": "signal_axis", "allowList": ["premise"]},
                        {"namespace": "role", "allowList": ["publisher"]},
                    ],
                    "embeddingMetadata": {
                        "signal_source_id": "source-1",
                        "candidate_id": "publisher-1",
                        "has_vector_array": False,
                    },
                }
            ]
        }
    ]


def test_vector_search_adapter_finds_neighbors_by_signal_axis() -> None:
    posted_payloads: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        posted_payloads.append(json.loads(request.content))
        assert request.url.host == "10.42.1.2"
        assert request.url.path.endswith("/indexEndpoints/737156575726141440:findNeighbors")
        return httpx.Response(
            200,
            json={
                "nearestNeighbors": [
                    {
                        "neighbors": [
                            {
                                "datapoint": {
                                    "datapointId": "candidate-1-guidelines",
                                    "embeddingMetadata": {
                                        "candidate_id": "candidate-1",
                                        "signal_source_id": "source-1",
                                    },
                                },
                                "distance": 0.12,
                            }
                        ]
                    }
                ]
            },
        )

    adapter = VertexVectorSearchAdapter(
        vertex_config(vector_search_query_host="https://10.42.1.2"),
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
        access_token_provider=lambda: "token",
    )

    neighbors = adapter.find_neighbors(
        [0.1, 0.2, 0.3],
        signal_axis="voice",
        limit=5,
        restricts=[VectorRestrict(namespace="role", allow_list=["publisher"])],
    )

    assert neighbors[0].datapoint_id == "candidate-1-guidelines"
    assert neighbors[0].metadata["candidate_id"] == "candidate-1"
    assert posted_payloads[0] == {
        "deployedIndexId": "publisher_author_staging_v1",
        "queries": [
            {
                "datapoint": {
                    "featureVector": [0.1, 0.2, 0.3],
                    "restricts": [
                        {"namespace": "signal_axis", "allowList": ["voice"]},
                        {"namespace": "role", "allowList": ["publisher"]},
                    ],
                },
                "neighborCount": 5,
            }
        ],
        "returnFullDatapoint": True,
    }


def test_vector_search_adapter_wraps_query_errors() -> None:
    adapter = VertexVectorSearchAdapter(
        vertex_config(),
        http_client=httpx.Client(
            transport=httpx.MockTransport(
                lambda _request: httpx.Response(500, json={"error": "unavailable"})
            )
        ),
        access_token_provider=lambda: "token",
    )

    with pytest.raises(VertexAdapterError) as exc:
        adapter.find_neighbors([0.1], signal_axis="premise", limit=10)

    assert exc.value.safe_failure_code == "vertex_vector_query_failed"


def vertex_config(**overrides: object) -> AiServiceConfig:
    values: dict[str, Any] = {
        "provider_mode": "vertex",
        "vertex_project_id": "spb-ai",
        "vertex_location": "europe-west3",
        "embedding_model": "gemini-embedding-001",
        "vector_index_name": "publisher-author-staging-vector-index",
        "vector_index_id": "6107839868853813248",
        "vector_index_endpoint_id": "737156575726141440",
        "vector_deployed_index_id": "publisher_author_staging_v1",
        "vector_psc_network": "projects/spb-ai/global/networks/spb-ai-staging-vpc",
        "vector_search_query_host": "vector-search.example.test",
    }
    values.update(overrides)
    return AiServiceConfig(**values)
