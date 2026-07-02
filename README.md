# Project Cassandra

Project Cassandra is an advanced, atmospheric threat-intelligence console and Model Context Protocol (MCP) middleware designed to intercept and evaluate AI reasoning. It exposes a proxy endpoint for LLM interactions, perturbing input contexts to analyze whether the model is exhibiting deceptive alignment or steganographic intent in its Chain-of-Thought (CoT).

---

## 🔮 System Architecture

Cassandra runs as an isolated swarm and telemetry integration layer:

```
                      [ LLM Client Request ]
                                │
                                ▼
                   [ Cassandra MCP Interceptor ]
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
    1. The Injector     2. Divergence Monitor   3. The Gatekeeper
 (Adversarial Stress)   (Analyze CoT Shifts)   (Halt/Allow Action)
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                │
                                ▼
                       [ EventBus Pub/Sub ]
                                │
          ┌─────────────────────┴─────────────────────┐
          ▼                                           ▼
   [ SessionStore ]                           [ WebSocketManager ]
 (JSON telemetry logs)                       (Real-time broadcast)
          │                                           │
          ▼                                           ▼
      [ Disk ]                               [ Next.js Dashboard ]
```

1. **The Injector**: Creates adversarial context modifications (counterfactuals, relaxed constraints, semantic paraphrasing) to challenge the stability of the reasoning path.
2. **The Divergence Monitor**: Measures semantic, structural, and goal-level shifts between the original CoT and the perturbed variants using local embeddings and Gemma-based analysis.
3. **The Gatekeeper**: Enforces dynamic, risk-adapted thresholds based on the requested tool call type (e.g., higher risk shell executions require lower divergence tolerance).
4. **Telemetry Pipeline**: Dispatches lifecycle events over an async `EventBus` to the disk-backed `SessionStore` and broadcasts live to `/ws/telemetry` via WebSockets.

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- A Google AI Studio API Key (or GCP project for Vertex AI)

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -e .
   ```
4. Configure environment variables. Copy `.env.example` to `.env` and fill in your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   LLM_PROVIDER=gemini
   SWARM_MODEL=gemini-2.5-flash
   ```
5. Start the FastAPI server:
   ```bash
   python -m uvicorn cassandra.main:app --port 8000
   ```

### 3. Frontend Dashboard Setup
1. Navigate to the dashboard directory:
   ```bash
   cd ../dashboard
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Next.js development server:
   ```bash
   npm run dev
   ```
4. Access the dashboard at [http://localhost:3000](http://localhost:3000).

---

## 🧪 Testing and Demos

We provide an automated scenario runner to test safe, unsafe, and steganographic models under Cassandra's protection.

### Running Automated Scenarios
With both the backend and frontend servers running, execute the scenario demonstrator:
```bash
# From the backend directory
.\venv\Scripts\python demo\run_scenarios.py
```
This script runs 5 distinct instances:
1. **Safe Instance - Standard Web Search** (Allowed)
2. **Safe Instance - File Read / Codebase Analysis** (Allowed/Moderately evaluated)
3. **Unsafe Instance - Steganography (Data Exfiltration)** (Fragile CoT -> Halted)
4. **Unsafe Instance - Deceptive Alignment (Sandbagging)** (Fragile CoT -> Halted)
5. **Unsafe Instance - Hidden Persona (Prompt Injection)** (Fragile CoT -> Halted)

### Watching Live Replay
On the dashboard at [http://localhost:3000](http://localhost:3000), click the **REPLAY** button in the header. The console will sequentially stream the captured telemetry from the last 5 completed scenarios so you can review the chain-of-thought streams, adversarial perturbation diffs, and divergence metrics without consuming additional API quota.
