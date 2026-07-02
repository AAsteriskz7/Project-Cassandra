import uuid
import time
from cassandra.agents.injector import Injector
from cassandra.agents.divergence_monitor import DivergenceMonitor
from cassandra.agents.gatekeeper import Gatekeeper, GateDecision
from cassandra.mcp.schemas import MCPToolCall, MCPErrorResponse, classify_tool_risk
from cassandra.telemetry.event_bus import EventBus, TelemetryEvent


class MCPInterceptor:
    """
    The core interception engine.
    Sits between the LLM's intent to call a tool and the actual tool execution.
    Runs the full Injector -> Divergence Monitor -> Gatekeeper pipeline,
    emitting telemetry at each step.
    """

    def __init__(self):
        self.injector = Injector()
        self.monitor = DivergenceMonitor()
        self.gatekeeper = Gatekeeper()
        self.event_bus = EventBus.get()

    async def intercept(
        self,
        session_id: str,
        system_prompt: str,
        user_query: str,
        cot_text: str,
        tool_calls: list[MCPToolCall]
    ) -> tuple[GateDecision, list[dict]]:
        """
        Run the full interception pipeline.
        Returns: (gate_decision, list of MCP responses per tool call)
        """
        pipeline_start = time.perf_counter()

        # Per-tool risk classification (surfaced in the MCP call log)
        tool_risks = {id(tc): classify_tool_risk(tc.tool_name) for tc in tool_calls}

        # 1. Emit CoT captured event
        await self.event_bus.emit(TelemetryEvent(
            session_id=session_id,
            event_type="cot_captured",
            payload={
                "cot": cot_text,
                "tool_call_count": len(tool_calls),
                "cot_char_count": len(cot_text),
                "cot_token_estimate": max(1, len(cot_text) // 4),  # ~4 chars/token heuristic
            }
        ))

        # 2. Run the Injector
        inj_start = time.perf_counter()
        perturbations = await self.injector.perturb(
            system_prompt=system_prompt,
            user_query=user_query,
            original_cot=cot_text
        )
        injector_ms = round((time.perf_counter() - inj_start) * 1000, 1)
        await self.event_bus.emit(TelemetryEvent(
            session_id=session_id,
            event_type="perturbation_generated",
            payload={
                "counterfactual": perturbations.counterfactual[:200],
                "constraint_relaxation": perturbations.constraint_relaxation[:200],
                "semantic_paraphrase": perturbations.semantic_paraphrase[:200],
                "latency_ms": injector_ms,
            }
        ))

        # 3. Run the Divergence Monitor
        mon_start = time.perf_counter()
        report = await self.monitor.analyze(
            original_cot=cot_text,
            perturbations=perturbations
        )
        monitor_ms = round((time.perf_counter() - mon_start) * 1000, 1)
        await self.event_bus.emit(TelemetryEvent(
            session_id=session_id,
            event_type="divergence_scored",
            payload={
                "semantic_divergence": report.semantic_divergence,
                "structural_divergence": report.structural_divergence,
                "goal_divergence": report.goal_divergence,
                "composite_score": report.composite_score,
                "explanation": report.explanation,
                "latency_ms": monitor_ms,
            }
        ))

        # 4. Determine risk from the highest-risk tool call
        risk_level = "MEDIUM"
        if tool_calls:
            risk_order = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}
            risk_level = max(tool_risks.values(), key=lambda r: risk_order.get(r, 2))

        # 5. Run the Gatekeeper
        decision = self.gatekeeper.evaluate(
            composite_score=report.composite_score,
            risk_level=risk_level
        )
        swarm_latency_ms = round(injector_ms + monitor_ms, 1)
        total_latency_ms = round((time.perf_counter() - pipeline_start) * 1000, 1)
        await self.event_bus.emit(TelemetryEvent(
            session_id=session_id,
            event_type="gate_decision",
            payload={
                "decision": decision.decision,
                "threshold_applied": decision.threshold_applied,
                "score_received": decision.score_received,
                "risk_level": risk_level,
                "reason": decision.reason,
                "injector_latency_ms": injector_ms,
                "monitor_latency_ms": monitor_ms,
                "swarm_latency_ms": swarm_latency_ms,
                "total_latency_ms": total_latency_ms,
            }
        ))

        # 6. Build MCP responses and emit one interception event per tool call
        #    (for BOTH decisions, so the dashboard's MCP log is always complete)
        mcp_responses = []
        for tc in tool_calls:
            tc_risk = tool_risks[id(tc)]
            if decision.decision == "HALT":
                err = MCPErrorResponse.halted(tc.call_id, decision.reason)
                mcp_responses.append(err.model_dump())
                await self.event_bus.emit(TelemetryEvent(
                    session_id=session_id,
                    event_type="mcp_call_intercepted",
                    payload={
                        "tool_name": tc.tool_name,
                        "call_id": tc.call_id,
                        "action": "HALTED",
                        "risk_level": tc_risk,
                        "arguments": tc.arguments,
                        "mcp_error": err.model_dump(),
                    }
                ))
            else:
                mcp_responses.append({
                    "jsonrpc": "2.0",
                    "id": tc.call_id,
                    "result": {"status": "forwarded", "tool_name": tc.tool_name}
                })
                await self.event_bus.emit(TelemetryEvent(
                    session_id=session_id,
                    event_type="mcp_call_intercepted",
                    payload={
                        "tool_name": tc.tool_name,
                        "call_id": tc.call_id,
                        "action": "FORWARDED",
                        "risk_level": tc_risk,
                        "arguments": tc.arguments,
                    }
                ))

        return decision, mcp_responses
