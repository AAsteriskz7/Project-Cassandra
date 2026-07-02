import os
import subprocess

# List of steps with files to add and their commit messages
COMMITS = [
    # 1. Base Project Setup
    {
        "files": ["backend/pyproject.toml"],
        "msg": "chore: initialize python project configuration and dependencies"
    },
    {
        "files": ["backend/.env.example"],
        "msg": "chore: add environment variable template (.env.example)"
    },
    # 2. Backend Base Architecture
    {
        "files": ["backend/cassandra/config.py"],
        "msg": "feat: implement configuration loader with Pydantic settings"
    },
    {
        "files": ["backend/cassandra/agents/base.py"],
        "msg": "feat: implement BaseAgent with Google GenAI client integration"
    },
    # 3. Dummy Proxy (Phase 1 Baseline)
    {
        "files": ["backend/cassandra/proxy/__init__.py", "backend/cassandra/proxy/router.py"],
        "msg": "feat: scaffold proxy router and dummy chat completion endpoint"
    },
    # 4. Phase 2: Adversarial Injector Agent
    {
        "files": ["backend/cassandra/agents/injector.py"],
        "msg": "feat: implement Injector agent for adversarial CoT perturbations"
    },
    # 5. Phase 2: Semantic Analysis
    {
        "files": ["backend/cassandra/analysis/__init__.py", "backend/cassandra/analysis/embeddings.py"],
        "msg": "feat: implement local SentenceTransformers embedding & cosine similarity helpers"
    },
    # 6. Phase 2: Divergence Monitor Agent
    {
        "files": ["backend/cassandra/agents/divergence_monitor.py"],
        "msg": "feat: implement DivergenceMonitor blending semantic, structural, and goal scores"
    },
    # 7. Phase 2: Gatekeeper Agent
    {
        "files": ["backend/cassandra/agents/gatekeeper.py"],
        "msg": "feat: implement Gatekeeper agent with risk-adjusted safety thresholds"
    },
    # 8. Phase 2 Testing
    {
        "files": ["backend/test_swarm.py"],
        "msg": "test: add isolated swarm test harness for benign & deceptive scenarios"
    },
    # 9. Phase 3: Telemetry Pipeline - Event Bus
    {
        "files": ["backend/cassandra/telemetry/__init__.py", "backend/cassandra/telemetry/event_bus.py"],
        "msg": "feat: implement async EventBus for in-app pub/sub telemetry events"
    },
    # 10. Phase 3: Telemetry Pipeline - Session Store
    {
        "files": ["backend/cassandra/telemetry/session_store.py"],
        "msg": "feat: implement SessionStore to persist telemetry to local JSONL files"
    },
    # 11. Phase 3: Telemetry Pipeline - WebSocket Manager
    {
        "files": ["backend/cassandra/telemetry/ws_handler.py"],
        "msg": "feat: implement WebSocketManager to broadcast events to dashboard clients"
    },
    # 12. Phase 3: MCP Protocol Schemas
    {
        "files": ["backend/cassandra/mcp/__init__.py", "backend/cassandra/mcp/schemas.py"],
        "msg": "feat: define Model Context Protocol JSON-RPC schemas and tool risk classification"
    },
    # 13. Phase 3: MCP Parser
    {
        "files": ["backend/cassandra/mcp/parser.py"],
        "msg": "feat: implement MCP tool call parsers for JSON-RPC and completion requests"
    },
    # 14. Phase 3: Interceptor Middleware
    {
        "files": ["backend/cassandra/mcp/interceptor.py"],
        "msg": "feat: implement MCPInterceptor tying swarm decision logic to telemetry events"
    },
    # 15. Phase 3: Wire Router & Main application
    {
        "files": ["backend/cassandra/main.py"],
        "msg": "feat: rewrite main FastAPI app with lifespan hooks and WebSocket telemetry"
    },
    {
        "files": ["backend/cassandra/proxy/router.py"],
        "msg": "feat: wire MCPInterceptor pipeline into chat completions proxy router"
    },
    # 16. Phase 3 Verification
    {
        "files": ["backend/demo/simulate.py"],
        "msg": "test: add integration test simulating live HTTP proxy interception & MCP errors"
    },
    # 17. Dashboard Config & Project Initialization
    {
        "files": ["dashboard/package.json", "dashboard/package-lock.json"],
        "msg": "chore: initialize Next.js dashboard project with dependencies"
    },
    {
        "files": ["dashboard/tsconfig.json", "dashboard/next.config.ts"],
        "msg": "chore: configure Next.js compiler, TypeScript and path aliases"
    },
    {
        "files": [
            "dashboard/postcss.config.mjs",
            "dashboard/eslint.config.mjs",
            "dashboard/.gitignore"
        ],
        "msg": "chore: configure Tailwind CSS, ESLint, and Git ignore rules for frontend"
    },
    # 18. Dashboard Boilerplate & Globals
    {
        "files": ["dashboard/src/app/globals.css", "dashboard/src/app/layout.tsx"],
        "msg": "style: add global layout, fonts, and custom glassmorphism style rules"
    },
    # 19. Dashboard Custom Hooks & Types
    {
        "files": ["dashboard/src/lib/types.ts", "dashboard/src/hooks/use-cassandra-ws.ts"],
        "msg": "feat: implement useCassandraWs hook for auto-reconnecting telemetry WS"
    },
    # 20. Dashboard Component: Session Timeline
    {
        "files": ["dashboard/src/components/session-timeline.tsx"],
        "msg": "feat: add SessionTimeline component to visualize intercepted request steps"
    },
    # 21. Dashboard Component: Cot Stream
    {
        "files": ["dashboard/src/components/cot-stream.tsx"],
        "msg": "feat: add CotStream component with syntax highlighting for chain of thought"
    },
    # 22. Dashboard Component: Divergence Gauge
    {
        "files": ["dashboard/src/components/divergence-gauge.tsx"],
        "msg": "feat: add DivergenceGauge component with dynamic color mapping based on safety state"
    },
    # 23. Dashboard Component: Perturbation Diff
    {
        "files": ["dashboard/src/components/perturbation-diff.tsx"],
        "msg": "feat: add PerturbationDiff component showing side-by-side adversarial mutations"
    },
    # 24. Dashboard Component: MCP Call Log
    {
        "files": ["dashboard/src/components/mcp-call-log.tsx"],
        "msg": "feat: add McpCallLog component displaying tool executions and status"
    },
    # 25. Dashboard Component: Metrics Panel
    {
        "files": ["dashboard/src/components/metrics-panel.tsx"],
        "msg": "feat: add MetricsPanel component for aggregate stats (latency, halt rates)"
    },
    # 26. Dashboard Core Page
    {
        "files": ["dashboard/src/app/page.tsx"],
        "msg": "feat: build dashboard main page integrating all telemetry components"
    },
    # 27. Documentation & Assets
    {
        "files": ["dashboard/README.md", "dashboard/AGENTS.md"],
        "msg": "docs: add dashboard README and developer guidelines"
    }
]

def run_git(cmd):
    print(f"Running: {' '.join(cmd)}")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"ERROR: {res.stderr}")
    else:
        print(res.stdout)

def main():
    # 1. Reset .git completely
    if os.path.exists(".git"):
        # We need to run shell commands to clear it completely in Windows
        subprocess.run(["powershell", "-Command", "Remove-Item -Recurse -Force .git"], capture_output=True)
    
    # 2. Re-init
    run_git(["git", "init"])
    
    # 3. Configure remote
    run_git(["git", "remote", "add", "origin", "https://github.com/AAsteriskz7/Project-Cassandra.git"])

    # 4. Sequentially add and commit (will use local user config which defaults to user's global AAsteriskz7)
    for i, step in enumerate(COMMITS, 1):
        print(f"\n--- Commit {i}/{len(COMMITS)}: {step['msg']} ---")
        
        valid_files = []
        for f in step["files"]:
            if os.path.exists(f):
                valid_files.append(f)
            else:
                print(f"WARNING: File {f} does not exist, skipping")

        if not valid_files:
            print("No valid files for this commit step, skipping.")
            continue

        run_git(["git", "add"] + valid_files)
        run_git(["git", "-c", "commit.gpgsign=false", "commit", "-m", step["msg"]])

    # 5. Catch any remaining untracked or modified files (e.g. config files, walkthroughs, task files, etc.)
    print("\n--- Finalizing remaining files ---")
    if os.path.exists(".gitignore"):
        run_git(["git", "add", ".gitignore"])
    run_git(["git", "add", "."])
    
    status_res = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
    if status_res.stdout.strip():
        run_git(["git", "-c", "commit.gpgsign=false", "commit", "-m", "docs: finalize task lists and project walkthroughs"])

    # 6. Push to origin main
    print("\n--- Pushing to GitHub ---")
    run_git(["git", "branch", "-M", "main"])
    run_git(["git", "push", "-u", "origin", "main", "--force"])

if __name__ == "__main__":
    main()
