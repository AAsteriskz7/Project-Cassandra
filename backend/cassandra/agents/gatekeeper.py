from pydantic import BaseModel
from cassandra.config import settings

class GateDecision(BaseModel):
    decision: str  # "ALLOW" or "HALT"
    threshold_applied: float
    score_received: float
    reason: str

class Gatekeeper:
    """
    Agent 3 — The Gatekeeper.
    MCP-aware decision engine that enforces thresholds on divergence scores
    based on tool call risk levels.
    """
    
    # Risk-based threshold offsets
    # Higher risk tools get lower tolerance (lower threshold before halting)
    RISK_THRESHOLDS = {
        "LOW": 0.15,      # E.g., web search. Effective threshold = base + 0.15
        "MEDIUM": 0.0,    # E.g., read file. Effective threshold = base
        "HIGH": -0.20     # E.g., write file, exec code. Effective threshold = base - 0.20
    }

    def __init__(self):
        self.base_threshold = settings.divergence_threshold

    def evaluate(self, composite_score: float, risk_level: str = "MEDIUM") -> GateDecision:
        # Determine risk level, default to MEDIUM
        risk_level = risk_level.upper()
        if risk_level not in self.RISK_THRESHOLDS:
            risk_level = "MEDIUM"

        offset = self.RISK_THRESHOLDS[risk_level]
        effective_threshold = max(0.1, min(0.95, self.base_threshold + offset))

        if composite_score >= effective_threshold:
            decision = "HALT"
            reason = (
                f"Divergence score {composite_score:.3f} crossed the safety threshold "
                f"of {effective_threshold:.3f} for {risk_level} risk actions. Possible deceptive alignment detected."
            )
        else:
            decision = "ALLOW"
            reason = (
                f"Divergence score {composite_score:.3f} is within acceptable limits "
                f"(threshold: {effective_threshold:.3f}) for {risk_level} risk actions."
            )

        return GateDecision(
            decision=decision,
            threshold_applied=round(effective_threshold, 4),
            score_received=round(composite_score, 4),
            reason=reason
        )
