from dataclasses import dataclass, field
from typing import Protocol
from urllib.parse import urlparse

import httpx

from app.modules.config import AiServiceConfig
from app.modules.embeddings import (
    AccessTokenProvider,
    MetadataServerTokenProvider,
    VertexAdapterError,
)


class RetrievalService(Protocol):
    def retrieve_candidates(self, manuscript_id: str, limit: int) -> list[str]:
        """Return candidate profile IDs once vector retrieval is implemented."""


@dataclass(frozen=True)
class VectorRestrict:
    namespace: str
    allow_list: list[str] = field(default_factory=list)
    deny_list: list[str] = field(default_factory=list)

    def to_vertex_payload(self) -> dict[str, object]:
        payload: dict[str, object] = {"namespace": self.namespace}
        if self.allow_list:
            payload["allowList"] = self.allow_list
        if self.deny_list:
            payload["denyList"] = self.deny_list
        return payload


@dataclass(frozen=True)
class VectorDatapoint:
    datapoint_id: str
    feature_vector: list[float]
    restricts: list[VectorRestrict] = field(default_factory=list)
    metadata: dict[str, object] = field(default_factory=dict)

    def to_vertex_payload(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "datapointId": self.datapoint_id,
            "featureVector": self.feature_vector,
        }
        if self.restricts:
            payload["restricts"] = [
                restrict.to_vertex_payload() for restrict in self.restricts
            ]
        if self.metadata:
            payload["embeddingMetadata"] = self.metadata
        return payload


@dataclass(frozen=True)
class VectorSearchNeighbor:
    datapoint_id: str
    distance: float | None
    metadata: dict[str, object]


class VertexVectorSearchAdapter:
    def __init__(
        self,
        config: AiServiceConfig,
        http_client: httpx.Client | None = None,
        access_token_provider: AccessTokenProvider | None = None,
    ) -> None:
        required = (
            config.vertex_project_id,
            config.vertex_location,
            config.vector_index_id,
            config.vector_index_endpoint_id,
            config.vector_deployed_index_id,
        )
        if not all(required):
            raise VertexAdapterError("vertex_config_missing")
        self.config = config
        self.http_client = http_client or httpx.Client(timeout=30)
        self.access_token_provider = access_token_provider or MetadataServerTokenProvider(
            self.http_client
        )

    def upsert_datapoints(self, datapoints: list[VectorDatapoint]) -> None:
        if not datapoints:
            return
        try:
            response = self.http_client.post(
                self._upsert_url(),
                headers={"authorization": f"Bearer {self.access_token_provider()}"},
                json={
                    "datapoints": [
                        datapoint.to_vertex_payload() for datapoint in datapoints
                    ]
                },
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise VertexAdapterError("vertex_vector_upsert_failed") from exc

    def find_neighbors(
        self,
        feature_vector: list[float],
        *,
        signal_axis: str,
        limit: int,
        restricts: list[VectorRestrict] | None = None,
    ) -> list[VectorSearchNeighbor]:
        if not feature_vector or limit <= 0:
            raise VertexAdapterError("vertex_vector_query_invalid")

        query_restricts = [
            VectorRestrict(namespace="signal_axis", allow_list=[signal_axis]),
            *(restricts or []),
        ]
        try:
            response = self.http_client.post(
                self._find_neighbors_url(),
                headers={"authorization": f"Bearer {self.access_token_provider()}"},
                json={
                    "deployedIndexId": self.config.vector_deployed_index_id,
                    "queries": [
                        {
                            "datapoint": {
                                "featureVector": feature_vector,
                                "restricts": [
                                    restrict.to_vertex_payload()
                                    for restrict in query_restricts
                                ],
                            },
                            "neighborCount": limit,
                        }
                    ],
                    "returnFullDatapoint": True,
                },
            )
            response.raise_for_status()
            return parse_find_neighbors_response(response.json())
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            raise VertexAdapterError("vertex_vector_query_failed") from exc

    def _upsert_url(self) -> str:
        return (
            f"https://{self.config.vertex_location}-aiplatform.googleapis.com/v1/"
            f"projects/{self.config.vertex_project_id}/locations/"
            f"{self.config.vertex_location}/indexes/{self.config.vector_index_id}"
            ":upsertDatapoints"
        )

    def _find_neighbors_url(self) -> str:
        host = self.config.vector_search_query_host
        base = normalize_query_host(host) if host else (
            f"https://{self.config.vertex_location}-aiplatform.googleapis.com"
        )
        return (
            f"{base}/v1/projects/{self.config.vertex_project_id}/locations/"
            f"{self.config.vertex_location}/indexEndpoints/"
            f"{self.config.vector_index_endpoint_id}:findNeighbors"
        )


def normalize_query_host(host: str) -> str:
    parsed = urlparse(host)
    if parsed.scheme:
        return host.rstrip("/")
    return f"https://{host.rstrip('/')}"


def parse_find_neighbors_response(payload: object) -> list[VectorSearchNeighbor]:
    if not isinstance(payload, dict):
        raise ValueError("Invalid findNeighbors response")
    nearest_neighbors = payload["nearestNeighbors"]
    if not isinstance(nearest_neighbors, list) or not nearest_neighbors:
        return []

    first_query = nearest_neighbors[0]
    if not isinstance(first_query, dict):
        raise ValueError("Invalid findNeighbors response")
    raw_neighbors = first_query.get("neighbors", [])
    if not isinstance(raw_neighbors, list):
        raise ValueError("Invalid findNeighbors response")

    neighbors: list[VectorSearchNeighbor] = []
    for raw_neighbor in raw_neighbors:
        if not isinstance(raw_neighbor, dict):
            raise ValueError("Invalid findNeighbors response")
        datapoint = raw_neighbor.get("datapoint")
        datapoint_id = raw_neighbor.get("datapointId")
        metadata: dict[str, object] = {}
        if isinstance(datapoint, dict):
            datapoint_id = datapoint.get("datapointId", datapoint_id)
            raw_metadata = datapoint.get("embeddingMetadata", {})
            if isinstance(raw_metadata, dict):
                metadata = raw_metadata
        if not isinstance(datapoint_id, str) or not datapoint_id:
            raise ValueError("Invalid findNeighbors response")
        raw_distance = raw_neighbor.get("distance")
        distance = float(raw_distance) if raw_distance is not None else None
        neighbors.append(
            VectorSearchNeighbor(
                datapoint_id=datapoint_id,
                distance=distance,
                metadata=metadata,
            )
        )
    return neighbors
