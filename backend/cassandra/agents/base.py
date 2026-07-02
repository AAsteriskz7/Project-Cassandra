from google import genai
from google.genai import types
from cassandra.config import settings
import os
import asyncio


class BaseAgent:
    """
    Abstract BaseAgent for the Cassandra Swarm.
    Initializes a shared google-genai client with retry logic.
    """
    
    _client: genai.Client | None = None

    def __init__(self):
        if BaseAgent._client is None:
            BaseAgent._client = self._build_client()

        self.client = BaseAgent._client
        self.swarm_model = settings.swarm_model

    @staticmethod
    def _build_client() -> genai.Client:
        """
        Build the shared google-genai client for the configured provider.

        - "vertex": routes through Vertex AI, billed to the GCP project.
          Requires application-default credentials (`gcloud auth application-default login`)
          and a project id (VERTEX_PROJECT env or GOOGLE_CLOUD_PROJECT).
        - "gemini" (default): Google AI Studio, authenticated with an API key.
        """
        provider = (settings.llm_provider or "gemini").lower()

        if provider == "vertex":
            project = settings.vertex_project or os.environ.get("GOOGLE_CLOUD_PROJECT", "")
            location = settings.vertex_location or "us-central1"
            if not project:
                raise RuntimeError(
                    "llm_provider=vertex but no project set. "
                    "Set VERTEX_PROJECT in .env (or GOOGLE_CLOUD_PROJECT env var)."
                )
            print(f"[Cassandra] LLM provider: Vertex AI (project={project}, location={location})")
            return genai.Client(vertexai=True, project=project, location=location)

        api_key = settings.gemini_api_key
        if not api_key or api_key == "placeholder_key_if_not_set":
            api_key = os.environ.get("GEMINI_API_KEY")
        print("[Cassandra] LLM provider: Google AI Studio (API key)")
        return genai.Client(api_key=api_key)
        
    async def generate_with_retry(
        self,
        prompt: str,
        config: types.GenerateContentConfig,
        max_retries: int = 3,
        base_delay: float = 5.0
    ) -> str:
        """
        Generate content with exponential backoff retry on 503/500 errors.
        """
        for attempt in range(max_retries + 1):
            try:
                response = self.client.models.generate_content(
                    model=self.swarm_model,
                    contents=prompt,
                    config=config
                )
                return response.text
            except Exception as e:
                err_str = str(e)
                is_retryable = any(code in err_str for code in ("503", "500", "429", "UNAVAILABLE", "INTERNAL", "RESOURCE_EXHAUSTED"))
                if is_retryable and attempt < max_retries:
                    delay = base_delay * (2 ** attempt)
                    print(f"  [Retry {attempt+1}/{max_retries}] API returned retryable error, waiting {delay}s...")
                    await asyncio.sleep(delay)
                else:
                    raise
        raise RuntimeError("Unreachable")
