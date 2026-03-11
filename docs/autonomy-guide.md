# Autonomy Mode Guide — Running the Expert System Unattended

> **Purpose:** Step-by-step guide for preparing, launching, monitoring, and managing the expert system in fully autonomous mode — where sessions run unattended via a shell loop.
>
> **Prerequisite:** The base expert system must already be set up per `docs/human-guide.md`. This guide covers only the autonomy-specific additions.

---

## 1. How It Works

In autonomous mode, a shell script (`expert-system/scripts/run-sessions.sh`) launches sequential `claude -p` sessions. Each session:

1. Reads `CLAUDE.md` + `config.yaml` (autonomy.mode = "full")
2. Reads vault state (`_SESSION_BRIEFING.md`, `_INVESTIGATION_AGENDA.md`, etc.)
3. Picks top investigation items, executes them without waiting for human approval
4. Updates vault notes, SQLite, and coverage tracking
5. Exits

The script captures exit codes, tracks costs, enforces stop conditions, and maintains a state file (`runner-state.json`) across sessions. Cross-session memory lives entirely in the vault and SQLite — each `claude -p` invocation is stateless.

```
┌─────────────────────────────────────────────────────┐
│              run-sessions.sh (loop)                 │
│                                                     │
│  ┌──────────┐   ┌──────────┐        ┌──────────┐  │
│  │Session 1 │──▶│Session 2 │──...──▶│Session N │  │
│  │bootstrap │   │ regular  │        │ regular  │  │
│  └────┬─────┘   └────┬─────┘        └────┬─────┘  │
│       │              │                    │        │
│       ▼              ▼                    ▼        │
│  ┌─────────────────────────────────────────────┐   │
│  │       Vault + SQLite (shared state)         │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 2. Preparation Checklist

### 2.1 Verify Base Setup

Everything from `docs/human-guide.md` must be working:

```bash
# All must pass
claude --version
python3 -c "import yaml; print('pyyaml OK')"
qmd status
claude mcp list | head -5
```

### 2.2 Review config.yaml

The `autonomy` section was added to `expert-system/config.yaml`:

```yaml
autonomy:
  mode: "full"                       # "hybrid" or "full"
  max_sessions: 30                   # Stop after N sessions (0 = unlimited)
  max_budget_per_session_usd: 5.0    # Cost cap per session
  max_total_budget_usd: 120.0        # Cumulative cost cap
  consecutive_failure_limit: 3       # Abort after N consecutive failures
  auto_phase_transition: false       # Auto-switch to Phase B when coverage target met
  log_dir: "expert-system/logs"      # Session log directory
  stop_file: "expert-system/.stop"   # Touch to gracefully stop the loop
  model: "opus"                      # Model for claude -p
  effort: "max"                      # Effort level
  allow_api_mutations: false         # If false, only GET/SELECT in autonomous mode
```

**Key decisions before first run:**

| Setting | Default | Consider changing if... |
|---------|---------|------------------------|
| `max_sessions` | 30 | You want fewer/more sessions total |
| `max_budget_per_session_usd` | 5.0 | Sessions are hitting budget cap mid-work |
| `max_total_budget_usd` | 120.0 | You want a tighter/looser overall cap |
| `allow_api_mutations` | false | You trust autonomous POST/PATCH/DELETE on test envs |
| `auto_phase_transition` | false | You want Phase B to start automatically when coverage is met |
| `model` | opus | You want to use a different model |
| `session.delay_minutes` | 30 | You want more/less gap between sessions |

### 2.3 Review MISSION_DIRECTIVE.md

The mission directive drives what the system investigates. Before unattended runs, ensure:
- Priority areas are correctly ordered
- Information source URLs are current
- Testing environment names match config.yaml

### 2.4 Ensure QMD Daemon Persistence

QMD must stay running across sessions. Add to `~/.bashrc` if not already there:

```bash
if ! qmd status 2>/dev/null | grep -q "MCP: running"; then
  qmd mcp --http --daemon
fi
```

Or run it in a tmux/screen session:

```bash
tmux new -d -s qmd 'qmd mcp --http'
```

### 2.5 Make the Script Executable

```bash
chmod +x expert-system/scripts/run-sessions.sh
```

---

## 3. Starting the Runner

### 3.1 Dry Run (always do this first)

Preview what would happen without executing any Claude sessions:

```bash
./expert-system/scripts/run-sessions.sh --dry-run
```

This shows:
- Preflight check results
- Config values being used
- The exact prompt that would be sent to each session
- The `claude` command that would be executed

Review the bootstrap prompt (session 1) carefully.

### 3.2 Single Session Test

Run just one session to verify everything works end-to-end:

```bash
./expert-system/scripts/run-sessions.sh --sessions 1
```

After it completes, verify:
- `expert-system/logs/session-001-*.json` exists and contains output
- `expert-system/logs/runner-state.json` shows session_number: 1
- Vault files were created (`_SESSION_BRIEFING.md`, `_INVESTIGATION_AGENDA.md`, etc.)
- SQLite tables were initialized

### 3.3 Full Unattended Run

Run in a terminal multiplexer so it survives SSH disconnects:

```bash
# Option A: tmux
tmux new -s expert
./expert-system/scripts/run-sessions.sh
# Ctrl+B, D to detach — reconnect later with: tmux attach -t expert

# Option B: screen
screen -S expert
./expert-system/scripts/run-sessions.sh
# Ctrl+A, D to detach — reconnect later with: screen -r expert

# Option C: nohup (simplest, no reattach)
nohup ./expert-system/scripts/run-sessions.sh > expert-system/logs/runner.log 2>&1 &
echo $! > expert-system/logs/runner.pid
```

### 3.4 Run a Specific Number of Sessions

```bash
# Run exactly 5 sessions then stop
./expert-system/scripts/run-sessions.sh --sessions 5
```

---

## 4. Monitoring

### 4.1 Live Session Output

Watch the current session's log as it runs:

```bash
# Find the latest log file
ls -t expert-system/logs/session-*.json | head -1

# Tail it
tail -f expert-system/logs/session-*.json | head -1
# or
tail -f "$(ls -t expert-system/logs/session-*.json | head -1)"
```

### 4.2 Runner State

Check overall progress:

```bash
cat expert-system/logs/runner-state.json | python3 -m json.tool
```

Shows: current session number, total cost, consecutive failures, and per-session history.

Quick summary:

```bash
python3 -c "
import json
with open('expert-system/logs/runner-state.json') as f:
    s = json.load(f)
print(f'Sessions completed: {s[\"session_number\"]}')
print(f'Total cost: \${s[\"total_cost_usd\"]:.2f}')
print(f'Consecutive failures: {s[\"consecutive_failures\"]}')
if s['sessions']:
    last = s['sessions'][-1]
    print(f'Last session: #{last[\"session\"]} at {last[\"timestamp\"]} (exit {last[\"exit_code\"]}, {last[\"duration_sec\"]}s)')
"
```

### 4.3 Knowledge Progress

**Vault briefing** — what the system did and plans to do next:

```bash
# Via Obsidian: open _SESSION_BRIEFING.md
# Via terminal:
cat expert-system/vault/_SESSION_BRIEFING.md
```

**Coverage** — how much of the codebase has been investigated:

```bash
cat expert-system/vault/_KNOWLEDGE_COVERAGE.md
```

**Agenda** — what's planned for upcoming sessions:

```bash
cat expert-system/vault/_INVESTIGATION_AGENDA.md
```

**Vault size** — how many notes have been created:

```bash
find expert-system/vault -name "*.md" | wc -l
find expert-system/vault -name "*.md" -newer expert-system/vault/_SESSION_BRIEFING.md
```

### 4.4 SQLite Metrics

```bash
sqlite3 expert-system/analytics.db "
  SELECT 'Notes analyzed' as metric, count(*) as value FROM analysis_runs
  UNION ALL SELECT 'Modules tracked', count(*) FROM module_health
  UNION ALL SELECT 'Design issues', count(*) FROM design_issues
  UNION ALL SELECT 'External refs', count(*) FROM external_refs
  UNION ALL SELECT 'Exploration findings', count(*) FROM exploration_findings;
"
```

### 4.5 Obsidian Graph View

Open Obsidian with the vault at `expert-system/vault/`. The graph view shows how knowledge nodes are interconnected. A healthy knowledge base shows dense clusters, not isolated nodes.

---

## 5. Controlling the Runner

### 5.1 Graceful Stop

Create the stop file — the runner finishes the current session, then exits:

```bash
touch expert-system/.stop
```

The runner checks for this file before each new session. Remove it to allow future runs:

```bash
rm expert-system/.stop
```

### 5.2 Immediate Stop

Kill the runner process (the current Claude session will also terminate):

```bash
# If using tmux: Ctrl+C in the tmux session
# If using nohup:
kill $(cat expert-system/logs/runner.pid)
```

### 5.3 Pause and Resume

The runner automatically resumes from where it left off — `runner-state.json` tracks the session counter. Just stop the runner (gracefully or immediately) and start it again later:

```bash
# Stop
touch expert-system/.stop
# ... wait for current session to finish ...

# Resume (remove stop file first)
rm expert-system/.stop
./expert-system/scripts/run-sessions.sh
```

### 5.4 Adjust Mid-Run

You can edit `config.yaml` between sessions (the runner re-reads it before each session):

- **Change delay**: edit `session.delay_minutes`
- **Change budget cap**: edit `autonomy.max_budget_per_session_usd`
- **Switch to hybrid**: set `autonomy.mode: "hybrid"` — runner will abort at preflight
- **Enable Phase B**: set `phase.current: "generation"` and `phase.generation_allowed: true`
- **Allow mutations**: set `autonomy.allow_api_mutations: true`

You can also edit vault files between sessions:

- **Reprioritize**: edit `_INVESTIGATION_AGENDA.md` to change what gets investigated next
- **Add context**: add notes to the vault — the system discovers them via QMD
- **Redirect**: edit `_SESSION_BRIEFING.md` to leave instructions for the next session

### 5.5 Reset State

To start the session counter from scratch (e.g., after a failed first run):

```bash
rm expert-system/logs/runner-state.json
# Optionally clear old logs:
rm expert-system/logs/session-*.json
```

---

## 6. Stop Conditions

The runner stops automatically when any of these conditions is met:

| Condition | Default | How to change |
|-----------|---------|---------------|
| Stop file exists | `expert-system/.stop` | `touch` / `rm` the file |
| Max sessions reached | 30 | `autonomy.max_sessions` in config.yaml or `--sessions N` flag |
| Total budget exceeded | $120 | `autonomy.max_total_budget_usd` in config.yaml |
| N consecutive failures | 3 | `autonomy.consecutive_failure_limit` in config.yaml |

Set `max_sessions: 0` for unlimited sessions (will run until another condition triggers).

---

## 7. Safety Model

### What the system CAN do autonomously

- Read and analyze the local code clone
- Read documentation from Confluence, GitLab, Figma, Qase
- Send GET requests to Swagger/API endpoints on testing environments
- Run SELECT queries on the PostgreSQL testing database
- Navigate and screenshot the UI via Playwright
- Create and update vault notes
- Insert and update SQLite records
- Run QMD searches and embeddings

### What the system CANNOT do by default

- **No API mutations** — POST, PUT, PATCH, DELETE are blocked unless `allow_api_mutations: true`
- **No database writes** — only SELECT queries
- **No production access** — testing environments only (enforced by MCP server config)
- **No Phase B auto-start** — must be enabled via `auto_phase_transition: true` or manually

### Permission mode

The runner uses `--permission-mode bypassPermissions`. This is safe because:
- MCP servers enforce access boundaries (read-only DB, testing envs only)
- `allow_api_mutations: false` adds an additional prompt-level gate
- The system operates on a local code clone, not the live repository
- Vault writes are additive (notes), not destructive

If you prefer tighter control, you can switch to hybrid mode (`autonomy.mode: "hybrid"`) which requires human approval at every decision point.

---

## 8. Troubleshooting

### Runner won't start

```
FATAL: autonomy.mode is 'hybrid', expected 'full'
```
Set `autonomy.mode: "full"` in config.yaml.

```
FATAL: python3 pyyaml not installed
```
Run: `pip3 install --break-system-packages pyyaml`

```
FATAL: claude CLI not found
```
Ensure Claude Code is installed and in PATH.

### Sessions failing immediately

Check the latest session log:

```bash
cat "$(ls -t expert-system/logs/session-*.json | head -1)" | python3 -m json.tool
```

Common causes:
- **QMD daemon not running**: `qmd mcp --http --daemon`
- **MCP server crashed**: `claude mcp list` to check, restart as needed
- **Budget too low**: increase `max_budget_per_session_usd` if sessions hit the cap mid-work

### Consecutive failure limit hit

```bash
# Check what failed
python3 -c "
import json
with open('expert-system/logs/runner-state.json') as f:
    s = json.load(f)
for sess in s['sessions'][-5:]:
    print(f'Session {sess[\"session\"]}: exit={sess[\"exit_code\"]} cost=\${sess[\"cost_usd\"]} duration={sess[\"duration_sec\"]}s')
"
```

Fix the underlying issue, then either:
- Reset the failure counter by editing `runner-state.json` (set `consecutive_failures: 0`)
- Or delete `runner-state.json` and restart (loses session history)

### Sessions producing no vault updates

- Check that mcp-obsidian is registered: `claude mcp get obsidian`
- Check vault permissions: `ls -la expert-system/vault/`
- Read the session log for errors

### Cost tracking shows $0

The cost parsing depends on Claude's `--output-format json` output structure. If costs aren't being captured, sessions still run correctly — the budget cap uses `--max-budget-usd` which Claude enforces internally.

---

## 9. Typical Workflow

### Week 1: Bootstrap and Orientation

```bash
# Day 1: Verify setup, dry run, single session test
./expert-system/scripts/run-sessions.sh --dry-run
./expert-system/scripts/run-sessions.sh --sessions 1

# Review results in Obsidian, check SQLite
# Adjust MISSION_DIRECTIVE.md if needed

# Day 1-2: Run 3-5 sessions for orientation
./expert-system/scripts/run-sessions.sh --sessions 5
```

### Week 2-3: Deep Investigation

```bash
# Let it run 15-20 sessions over several days
tmux new -s expert
./expert-system/scripts/run-sessions.sh

# Monitor daily:
cat expert-system/logs/runner-state.json | python3 -m json.tool
cat expert-system/vault/_KNOWLEDGE_COVERAGE.md
```

### Week 3-4: Coverage Review and Phase B

```bash
# Review coverage
cat expert-system/vault/_KNOWLEDGE_COVERAGE.md

# If coverage is sufficient, enable Phase B:
# Edit config.yaml:
#   phase.current: "generation"
#   phase.generation_allowed: true

# Run generation sessions
./expert-system/scripts/run-sessions.sh --sessions 10
```

---

## 10. File Reference

| File | Purpose |
|------|---------|
| `expert-system/config.yaml` | All configuration including autonomy settings |
| `expert-system/scripts/run-sessions.sh` | The runner script |
| `expert-system/logs/runner-state.json` | Session counter, costs, failure tracking |
| `expert-system/logs/session-NNN-*.json` | Per-session Claude output logs |
| `expert-system/.stop` | Touch to gracefully stop the runner |
| `expert-system/vault/_SESSION_BRIEFING.md` | What happened last, what's next |
| `expert-system/vault/_INVESTIGATION_AGENDA.md` | Prioritized investigation items |
| `expert-system/vault/_KNOWLEDGE_COVERAGE.md` | Coverage metrics |
| `CLAUDE+.md` | Implementation prompt (has autonomy-conditional logic) |
