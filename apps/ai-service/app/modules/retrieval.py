from typing import Protocol


class RetrievalService(Protocol):
    def retrieve_candidates(self, manuscript_id: str, limit: int) -> list[str]:
        """Return candidate profile IDs once vector retrieval is implemented."""
