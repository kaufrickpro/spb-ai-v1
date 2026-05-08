from typing import Literal, Protocol

from pydantic import BaseModel


class MatchingResult(BaseModel):
    status: Literal["succeeded", "failed"]
    candidate_count: int
    failure_code: str | None = None


class MatchingWorker(Protocol):
    def process_run(self, match_run_id: str) -> MatchingResult:
        """Run matching for an existing trusted match_run_id."""


class MatchingWorkerUnavailable(Exception):
    """Raised when the matching endpoint has no configured worker."""
