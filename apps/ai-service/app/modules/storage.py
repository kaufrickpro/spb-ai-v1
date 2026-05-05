from pathlib import Path
from typing import Protocol


class StorageReadError(Exception):
    """Raised when the worker cannot read uploaded bytes through storage."""


class DocumentStorage(Protocol):
    def read_bytes(self, storage_path: str) -> bytes:
        """Read document bytes from the configured storage provider."""


class LocalFileStorage:
    def __init__(self, root: Path) -> None:
        self.root = root

    def read_bytes(self, storage_path: str) -> bytes:
        path = (self.root / storage_path).resolve()
        root = self.root.resolve()
        if not path.is_relative_to(root):
            raise StorageReadError("Storage path escapes configured root")

        try:
            return path.read_bytes()
        except OSError as exc:
            raise StorageReadError("Unable to read stored document") from exc


class InMemoryDocumentStorage:
    def __init__(self, files: dict[str, bytes] | None = None) -> None:
        self.files = files or {}

    def read_bytes(self, storage_path: str) -> bytes:
        try:
            return self.files[storage_path]
        except KeyError as exc:
            raise StorageReadError("Unable to read stored document") from exc
