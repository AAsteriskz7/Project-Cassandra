from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Provider: "gemini" (Google AI Studio / API key) or "vertex" (Vertex AI / GCP billing)
    llm_provider: str = "gemini"

    gemini_api_key: str = "placeholder_key_if_not_set"

    # Vertex AI settings (used when llm_provider == "vertex").
    # Billed to the active GCP project's billing account.
    vertex_project: str = ""
    vertex_location: str = "us-central1"

    target_model: str = "gemini-2.5-flash"
    swarm_model: str = "gemma-4-26b-a4b-it"
    divergence_threshold: float = 0.6
    num_perturbations: int = 3
    embedding_model: str = "all-MiniLM-L6-v2"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
