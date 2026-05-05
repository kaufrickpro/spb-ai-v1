from typing import Protocol


class MatchingService(Protocol):
    def run_match(self, manuscript_id: str) -> list[str]:
        """Return match candidate IDs once scoring is implemented."""
