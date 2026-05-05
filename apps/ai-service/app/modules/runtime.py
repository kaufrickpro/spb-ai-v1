from dataclasses import dataclass
from typing import Protocol

from app.modules.config import AiServiceConfig


class RuntimeAdapter(Protocol):
    def is_ready(self) -> bool:
        """Return whether the configured AI provider can accept work."""


@dataclass(frozen=True)
class LocalRuntimeAdapter:
    def is_ready(self) -> bool:
        return True


@dataclass(frozen=True)
class VertexRuntimeAdapter:
    config: AiServiceConfig

    def is_ready(self) -> bool:
        return bool(self.config.vertex_project_id and self.config.vertex_location)


def create_runtime_adapter(config: AiServiceConfig) -> RuntimeAdapter:
    if config.provider_mode == "vertex":
        return VertexRuntimeAdapter(config)
    return LocalRuntimeAdapter()
