from sentence_transformers import SentenceTransformer
import numpy as np

class EmbeddingsEngine:
    """
    Lazy-loads sentence-transformers for local semantic similarity analysis.
    """
    _model: SentenceTransformer | None = None

    @classmethod
    def get_model(cls) -> SentenceTransformer:
        if cls._model is None:
            # Lazy-load to speed up backend startup
            cls._model = SentenceTransformer("all-MiniLM-L6-v2")
        return cls._model

    @classmethod
    def embed(cls, text: str) -> np.ndarray:
        model = cls.get_model()
        return model.encode(text)

    @classmethod
    def embed_batch(cls, texts: list[str]) -> list[np.ndarray]:
        model = cls.get_model()
        return list(model.encode(texts))

    @classmethod
    def cosine_similarity(cls, vec_a: np.ndarray, vec_b: np.ndarray) -> float:
        dot_product = np.dot(vec_a, vec_b)
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return float(dot_product / (norm_a * norm_b))
