import os
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, model_validator


class AiServiceConfig(BaseModel):
    provider_mode: Literal["local", "vertex"] = Field(default="local")
    internal_token: str | None = None
    vertex_project_id: str | None = None
    vertex_location: str | None = None

    @model_validator(mode="after")
    def require_vertex_config(self) -> "AiServiceConfig":
        if self.provider_mode == "vertex" and (
            not self.vertex_project_id or not self.vertex_location
        ):
            raise ValueError("Vertex mode requires VERTEX_PROJECT_ID and VERTEX_LOCATION")
        return self


def load_config() -> AiServiceConfig:
    try:
        return AiServiceConfig(
            provider_mode=os.getenv("AI_PROVIDER_MODE", "local"),
            internal_token=os.getenv("AI_INTERNAL_TOKEN"),
            vertex_project_id=os.getenv("VERTEX_PROJECT_ID"),
            vertex_location=os.getenv("VERTEX_LOCATION"),
        )
    except ValidationError as exc:
        raise RuntimeError("Invalid AI service configuration") from exc
