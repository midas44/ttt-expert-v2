#!/usr/bin/env bash
#
# run-sessions.sh — Autonomous multi-session expert system runner
#
# Launches sequential Claude Code sessions that read/update the expert-system
# vault. Cross-session state lives in the vault + SQLite; this script just
# orchestrates the loop.
#
# Usage:
#   ./run-sessions.sh              # run until a stop condition is met
#   ./run-sessions.sh --sessions 3 # run exactly 3 sessions
#   ./run-sessions.sh --dry-run    # show prompts without executing
#

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/expert-system/config.yaml"
STATE_FILE=""   # set after config is parsed
LOG_DIR=""      # set after config is parsed

# ── CLI args ──────────────────────────────────────────────────────────────────
MAX_SESSIONS_OVERRIDE=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --sessions)
            MAX_SESSIONS_OVERRIDE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            echo "Unknown option: $1" >&2
            echo "Usage: $0 [--sessions N] [--dry-run]" >&2
            exit 1
            ;;
    esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { log "FATAL: $*" >&2; exit 1; }

setup_claude_md() {
    local target="$PROJECT_ROOT/CLAUDE.md"
    local backup="$PROJECT_ROOT/CLAUDE.md.interactive"
    # Back up existing CLAUDE.md (interactive mode version) if it's a real file
    if [[ -e "$target" && ! -L "$target" ]]; then
        mv "$target" "$backup"
        log "Backed up CLAUDE.md -> CLAUDE.md.interactive"
    fi
    ln -sf "CLAUDE+.md" "$target"
    log "Created CLAUDE.md -> CLAUDE+.md symlink"
}

cleanup_claude_md() {
    local target="$PROJECT_ROOT/CLAUDE.md"
    local backup="$PROJECT_ROOT/CLAUDE.md.interactive"
    if [[ -L "$target" ]]; then
        rm "$target"
        # Restore interactive CLAUDE.md if backup exists
        if [[ -f "$backup" ]]; then
            mv "$backup" "$target"
            log "Restored CLAUDE.md from backup" 2>/dev/null || true
        else
            log "Removed CLAUDE.md symlink" 2>/dev/null || true
        fi
    fi
}

read_yaml() {
    # read_yaml <key> — extract a value from config.yaml via python3+yaml
    python3 -c "
import yaml, sys
with open('$CONFIG_FILE') as f:
    cfg = yaml.safe_load(f)
keys = '$1'.split('.')
v = cfg
for k in keys:
    v = v[k]
print(v)
" 2>/dev/null
}

# ── Preflight checks ─────────────────────────────────────────────────────────
preflight() {
    log "Preflight checks..."

    command -v claude >/dev/null 2>&1 || die "claude CLI not found"
    python3 -c "import yaml" 2>/dev/null || die "python3 pyyaml not installed"
    [[ -f "$CONFIG_FILE" ]] || die "Config not found: $CONFIG_FILE"

    local mode
    mode=$(read_yaml "autonomy.mode")
    [[ "$mode" == "full" ]] || die "autonomy.mode is '$mode', expected 'full'"

    # Check QMD MCP daemon is running
    if command -v qmd >/dev/null 2>&1; then
        if pgrep -f "qmd.*mcp" >/dev/null 2>&1; then
            log "QMD MCP daemon: running"
        else
            log "WARNING: QMD MCP daemon not running — starting it..."
            qmd mcp --http --daemon &
            sleep 3
            if pgrep -f "qmd.*mcp" >/dev/null 2>&1; then
                log "QMD MCP daemon: started"
            else
                log "WARNING: QMD MCP start failed — semantic search unavailable"
            fi
        fi
    else
        log "WARNING: qmd not found — semantic search unavailable"
    fi

    # Check playwright-vpn MCP server is registered (critical for UI exploration)
    if claude mcp get playwright-vpn >/dev/null 2>&1; then
        log "playwright-vpn MCP: registered"
    else
        log "WARNING: playwright-vpn MCP server not registered — UI exploration will be unavailable!"
        log "  Fix: see docs/playwright-mcp-fix.md for registration instructions"
    fi

    log "Preflight OK"
}

# ── Scope normalization ───────────────────────────────────────────────────────
# Pure-digit entries are GitLab ticket numbers → prefix with 't'
# "all" → "all", "vacation" → "vacation", "3404" → "t3404", "vacation, 3404" → "vacation, t3404"
normalize_scope() {
    local raw="$1"
    [[ "$raw" == "all" ]] && { echo "all"; return; }
    local result="" part
    IFS=',' read -ra parts <<< "$raw"
    for part in "${parts[@]}"; do
        part=$(echo "$part" | xargs)  # trim whitespace
        [[ "$part" =~ ^[0-9]+$ ]] && part="t${part}"
        result="${result:+${result}, }${part}"
    done
    echo "$result"
}

# Extract raw ticket numbers from normalized scope (e.g., "t3404, vacation, t3405" → "3404 3405")
extract_ticket_numbers() {
    local scope="$1"
    echo "$scope" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | grep '^t[0-9]*$' | sed 's/^t//' | tr '\n' ' '
}

# ── Config parsing ────────────────────────────────────────────────────────────
parse_config() {
    MAX_SESSIONS=$(read_yaml "autonomy.max_sessions")
    CONSECUTIVE_FAILURE_LIMIT=$(read_yaml "autonomy.consecutive_failure_limit")
    LOG_DIR="$PROJECT_ROOT/$(read_yaml 'autonomy.log_dir')"
    STOP=$(read_yaml "autonomy.stop")
    MODEL=$(read_yaml "autonomy.model")
    EFFORT=$(read_yaml "autonomy.effort")
    DELAY_MINUTES=$(read_yaml "session.delay_minutes")
    DELAY_MINUTES_OFFHOURS=$(read_yaml "session.delay_minutes_offhours")
    OFFHOURS_UTC=$(read_yaml "session.offhours_utc")
    MAX_DURATION_MINUTES=$(read_yaml "session.max_duration_minutes")
    PHASE=$(read_yaml "phase.current")
    PHASE_SCOPE=$(normalize_scope "$(read_yaml 'phase.scope' 2>/dev/null || echo 'all')")
    AUTOTEST_SCOPE=$(normalize_scope "$(read_yaml 'autotest.scope' 2>/dev/null || echo 'all')")

    # Peak hours — avoid autonomous execution during high-rate pricing hours
    PEAK_ENABLED=$(read_yaml "peak_hours.enabled" 2>/dev/null || echo "false")
    PEAK_RANGE=$(read_yaml "peak_hours.range_utc" 2>/dev/null || echo "")
    PEAK_WEEKDAYS_ONLY=$(read_yaml "peak_hours.weekdays_only" 2>/dev/null || echo "true")
    PEAK_BUFFER=$(read_yaml "peak_hours.buffer_minutes" 2>/dev/null || echo "40")

    STATE_FILE="$LOG_DIR/runner-state.json"

    # CLI override
    if [[ -n "$MAX_SESSIONS_OVERRIDE" ]]; then
        MAX_SESSIONS="$MAX_SESSIONS_OVERRIDE"
    fi

    mkdir -p "$LOG_DIR"
}

get_current_delay() {
    local hour
    hour=$(date -u +%-H)  # current UTC hour (no leading zero)
    local start end
    start="${OFFHOURS_UTC%%:*}"        # "15" from "15:00-03:00"
    end="${OFFHOURS_UTC##*-}"          # "03:00"
    end="${end%%:*}"                   # "03"

    # Remove leading zeros for arithmetic
    start=$((10#$start))
    end=$((10#$end))
    hour=$((10#$hour))

    # Handle overnight range (e.g. 15-03 means hour>=15 OR hour<3)
    if (( start > end )); then
        if (( hour >= start || hour < end )); then
            echo "$DELAY_MINUTES_OFFHOURS"
            return
        fi
    else
        if (( hour >= start && hour < end )); then
            echo "$DELAY_MINUTES_OFFHOURS"
            return
        fi
    fi
    echo "$DELAY_MINUTES"
}

# ── Peak hours — skip autonomous execution during high-rate pricing ──────────

is_peak_active() {
    # Check if peak-hours avoidance is enabled (weekdays only)
    [[ "$PEAK_ENABLED" != "True" && "$PEAK_ENABLED" != "true" ]] && return 1
    [[ -z "$PEAK_RANGE" ]] && return 1

    if [[ "$PEAK_WEEKDAYS_ONLY" == "True" || "$PEAK_WEEKDAYS_ONLY" == "true" ]]; then
        local dow
        dow=$(date -u +%u)  # 1=Mon ... 7=Sun
        (( dow > 5 )) && return 1
    fi

    return 0
}

is_peak_now() {
    # Returns 0 if currently inside peak hours
    is_peak_active || return 1

    local hour start end_part end
    hour=$(date -u +%-H)
    start="${PEAK_RANGE%%:*}"
    start="${start%%:*}"  # handle "12:00" -> "12"
    end_part="${PEAK_RANGE##*-}"
    end="${end_part%%:*}"
    start=$((10#$start)); end=$((10#$end)); hour=$((10#$hour))

    if (( start <= end )); then
        (( hour >= start && hour < end )) && return 0
    else
        (( hour >= start || hour < end )) && return 0
    fi
    return 1
}

is_peak_buffer() {
    # Returns 0 if starting a session now would likely overlap into peak hours
    is_peak_active || return 1
    is_peak_now && return 1  # already in peak — handled separately

    local now_minutes start peak_start_minutes minutes_until_peak
    now_minutes=$(( $(date -u +%-H) * 60 + $(date -u +%-M) ))
    start="${PEAK_RANGE%%:*}"
    start="${start%%:*}"
    peak_start_minutes=$(( 10#$start * 60 ))

    if (( peak_start_minutes > now_minutes )); then
        minutes_until_peak=$(( peak_start_minutes - now_minutes ))
    else
        minutes_until_peak=$(( 1440 - now_minutes + peak_start_minutes ))
    fi

    (( minutes_until_peak <= PEAK_BUFFER && minutes_until_peak > 0 )) && return 0
    return 1
}

wait_for_offpeak() {
    # If in peak hours or buffer zone, sleep until peak ends
    parse_config  # re-read (peak_hours may have been toggled)

    local end_part end_hour now_minutes end_minutes wait_minutes

    if is_peak_now; then
        end_part="${PEAK_RANGE##*-}"
        end_hour="${end_part%%:*}"
        now_minutes=$(( $(date -u +%-H) * 60 + $(date -u +%-M) ))
        end_minutes=$(( 10#$end_hour * 60 ))
        if (( end_minutes > now_minutes )); then
            wait_minutes=$(( end_minutes - now_minutes ))
        else
            wait_minutes=$(( 1440 - now_minutes + end_minutes ))
        fi
        log "Peak hours active (${PEAK_RANGE} UTC). Waiting ${wait_minutes} minutes until off-peak."
        sleep $(( wait_minutes * 60 ))
        return
    fi

    if is_peak_buffer; then
        end_part="${PEAK_RANGE##*-}"
        end_hour="${end_part%%:*}"
        now_minutes=$(( $(date -u +%-H) * 60 + $(date -u +%-M) ))
        end_minutes=$(( 10#$end_hour * 60 ))
        if (( end_minutes > now_minutes )); then
            wait_minutes=$(( end_minutes - now_minutes ))
        else
            wait_minutes=$(( 1440 - now_minutes + end_minutes ))
        fi
        log "Peak buffer — session would overlap peak hours. Waiting ${wait_minutes} minutes until off-peak."
        sleep $(( wait_minutes * 60 ))
    fi
}

# ── State management ─────────────────────────────────────────────────────────
init_state() {
    if [[ -f "$STATE_FILE" ]]; then
        log "Resuming from existing state: $STATE_FILE"
    else
        log "Initializing new runner state"
        python3 -c "
import json
state = {
    'session_number': 0,
    'consecutive_failures': 0,
    'sessions': []
}
with open('$STATE_FILE', 'w') as f:
    json.dump(state, f, indent=2)
"
    fi
}

get_state_field() {
    python3 -c "
import json
with open('$STATE_FILE') as f:
    state = json.load(f)
print(state['$1'])
"
}

update_state() {
    # update_state <session_num> <exit_code> <duration_sec> <log_file> <phase>
    python3 -c "
import json, datetime, os

with open('$STATE_FILE') as f:
    state = json.load(f)

phase = '$5'
state['session_number'] = $1

if $2 != 0:
    state['consecutive_failures'] += 1
else:
    state['consecutive_failures'] = 0

# Parse session JSON for enriched stats
session_data = {
    'session': $1,
    'phase': phase,
    'timestamp': datetime.datetime.now().isoformat(),
    'exit_code': $2,
    'duration_sec': $3,
    'log_file': '$4'
}

log_file = '$4'
if os.path.exists(log_file) and os.path.getsize(log_file) > 0:
    try:
        with open(log_file) as lf:
            js = json.load(lf)
        session_data['num_turns'] = js.get('num_turns', 0)
        session_data['cost_usd'] = js.get('total_cost_usd', 0)
        session_data['result_summary'] = (js.get('result', '') or '')[:500]
        mu = js.get('modelUsage', {})
        session_data['models'] = {}
        for model, usage in mu.items():
            session_data['models'][model] = {
                'input': usage.get('inputTokens', 0),
                'output': usage.get('outputTokens', 0),
                'cache_read': usage.get('cacheReadInputTokens', 0),
                'cache_create': usage.get('cacheCreationInputTokens', 0),
                'cost': usage.get('costUSD', 0)
            }
    except:
        pass

state['sessions'].append(session_data)

with open('$STATE_FILE', 'w') as f:
    json.dump(state, f, indent=2)
"
}

# ── Prompt builders ───────────────────────────────────────────────────────────
build_prompt() {
    local session_num="$1"
    local phase="$2"

    if [[ "$session_num" -eq 1 ]]; then
        cat <<'PROMPT'
This is session 1 (bootstrap). autonomy.mode is "full" — do not wait for human approval.

Follow §16 (First Session Bootstrap) completely:
1. Read config.yaml
2. Read MISSION_DIRECTIVE.md
3. Create vault folder structure via mcp-obsidian
4. Initialize SQLite tables
5. Create _SESSION_BRIEFING.md, _INVESTIGATION_AGENDA.md, _KNOWLEDGE_COVERAGE.md, _INDEX.md
6. Set up QMD collection and embeddings
7. Clone repository
8. Verify MCP accessibility
9. Log Orientation plan to _SESSION_BRIEFING.md and begin Orientation immediately

After bootstrap, begin Orientation (§10 Sessions 1-3):
- Map repo structure
- Read existing docs
- Pull key Confluence pages
- Check Qase for existing tests
- Create architecture overview and module skeletons
- Run initial analysis tools
- Populate module_health table

At session end, follow §9.3 (update all underscore-prefixed files).
PROMPT
    elif [[ "$phase" == "generation" ]]; then
        cat <<PROMPT
This is session ${session_num}. Phase: generation (Phase B). autonomy.mode is "full" — do not wait for human approval.

Follow §11 (Phase B — Test Documentation Generation) session protocol:
1. Read config.yaml — check phase.scope for module restriction
2. Read _SESSION_BRIEFING.md — if it references a different phase, execute Phase Reset Protocol (§9.5) first
3. Read _INVESTIGATION_AGENDA.md, MISSION_DIRECTIVE.md
4. Query SQLite for recent activity and test_case_tracking progress
5. If scope restricts to a specific module, work ONLY on that module

For the target module:
a. Enrich knowledge first — explore the UI via Playwright, read vault notes, check code
b. Mine GitLab tickets: search related issues, read descriptions AND comments (comments contain bugs, edge cases, reproduction steps)
c. Create test cases from bug reports — each confirmed bug = regression test case, tag with ticket number
d. Write test steps as UI/browser actions (login, navigate, click, fill, verify) — NOT API calls
c. API steps only for: test endpoints (clock), data verification (DB checks), features with no UI
d. Include SQL query hints in Preconditions for dynamic test data generation
e. Generate the Python script and XLSX workbook
f. Track cases in test_case_tracking table

CRITICAL: Test steps MUST describe what a user does in the browser. See §11 "Test Step Writing Rules" for correct vs wrong examples.

$(
TICKET_NUMS=$(extract_ticket_numbers "$PHASE_SCOPE")
if [[ -n "$TICKET_NUMS" ]]; then
    cat <<TICKET_BLOCK

TICKET SCOPE ACTIVE — this scope includes GitLab ticket(s): ${TICKET_NUMS}
For each ticket number, follow §10.1 Ticket-Scoped Investigation Protocol (Phase B):
- Generate XLSX at test-docs/t<number>/t<number>.xlsx
- Use test case IDs: TC-T<number>-001, TC-T<number>-002, ...
- Suite name: TS-T<number>-Regression (or TS-T<number>-<Feature>)
- Focus test cases on the ticket's requirements, bug scenario, and edge cases from comments
- Include regression tests for the reported bug
- Tag each test case with the GitLab ticket number in requirement_ref column
- Cross-reference parent module knowledge for context
TICKET_BLOCK
fi
)

$(if (( session_num % 5 == 0 )); then echo "This is session ${session_num} (multiple of 5) — also run maintenance per §9.4."; fi)

At session end, follow §9.3 (update all underscore-prefixed files).
PROMPT
    elif [[ "$phase" == "autotest_generation" ]]; then
        cat <<PROMPT
This is session ${session_num}. Phase: autotest_generation (Phase C). autonomy.mode is "full" — do not wait for human approval.

Follow §12 (Phase C — Autotest Generation) session protocol:
1. Read config.yaml (check autotest.* settings)
2. Read _SESSION_BRIEFING.md — if it references a different phase, execute Phase Reset Protocol (§9.5) first
3. Read autotests/manifest/test-cases.json for test case inventory
4. Query SQLite autotest_tracking for current progress
4. Select next test cases to generate per autotest.priority_order × autotest.type_priority
5. Read selector rules: .claude/skills/autotest-generator/references/framework-spec.md § Selector Priority
6. For each selected test case (up to autotest.max_tests_per_session):
   a. Enrich from vault: search QMD for module knowledge, read relevant notes
   b. Check existing page objects and fixtures for reuse
   c. Generate: data class, page objects (if needed), fixtures (if needed), test spec
      SELECTOR RULES: text-first (getByText, getByRole+name), then role, then structural (tag+containment), then partial class ([class*='...']).
      BANNED: exact BEM classes (.navbar__*, .page-body__*, .drop-down-menu__*).
      NEVER put page.locator() in spec files — add methods to page objects instead.
   d. Selector audit: verify zero page.locator() in spec, zero BEM selectors
   e. Verify: run the test via npx playwright test --project=chrome-headless
   f. Fix failures (up to autotest.auto_fix_attempts): use playwright-vpn for selector discovery
   g. Track: update SQLite autotest_tracking + manifest JSON

$(
TICKET_NUMS=$(extract_ticket_numbers "$AUTOTEST_SCOPE")
if [[ -n "$TICKET_NUMS" ]]; then
    cat <<TICKET_BLOCK

TICKET SCOPE ACTIVE — this scope includes GitLab ticket(s): ${TICKET_NUMS}
For each ticket number, follow §10.1 Ticket-Scoped Investigation Protocol (Phase C):
- Spec files: tests/t<number>/t<number>-tc<NNN>.spec.ts
- Data classes: data/t<number>/T<number>Tc<NNN>Data.ts
- Queries: data/t<number>/queries/t<number>Queries.ts
- Module value in autotest_tracking: "t<number>"
- Reuse page objects from the parent module when possible
- Create directories if they don't exist (mkdir -p)
TICKET_BLOCK
fi
)

$(if (( session_num % 5 == 0 )); then echo "This is session ${session_num} (multiple of 5) — also run maintenance per §9.4."; fi)

At session end:
- Update _SESSION_BRIEFING.md with Phase C progress
- Update _AUTOTEST_PROGRESS.md vault note with coverage metrics
- Commit generated autotest code
PROMPT
    else
        cat <<PROMPT
This is session ${session_num}. Phase: ${phase}. autonomy.mode is "full" — do not wait for human approval.

Follow §9 Session Protocol:
1. Read config.yaml
2. Check timing (log warning if needed, proceed regardless in full mode)
3. Read _SESSION_BRIEFING.md for prior session context
4. Read _INVESTIGATION_AGENDA.md
5. Read MISSION_DIRECTIVE.md — check for updates
6. Query SQLite for recent activity
7. QMD search for recent context
8. Pick top 2-3 items from _INVESTIGATION_AGENDA.md by priority

Execute the INVESTIGATE → ANALYZE → SYNTHESIZE → STORE → CONNECT cycle for each item.

IMPORTANT: Mine GitLab tickets for the module(s) in scope — search issues, read descriptions AND comments (comments contain the real bug details). See §10 "GitLab Ticket Mining".

$(
TICKET_NUMS=$(extract_ticket_numbers "$PHASE_SCOPE")
if [[ -n "$TICKET_NUMS" ]]; then
    cat <<TICKET_BLOCK

TICKET SCOPE ACTIVE — this scope includes GitLab ticket(s): ${TICKET_NUMS}
For each ticket number, follow §10.1 Ticket-Scoped Investigation Protocol:
1. Fetch the ticket: GET /api/v4/projects/172/issues/<number>
2. Fetch ALL comments: GET /api/v4/projects/172/issues/<number>/notes
3. Identify the parent module from ticket labels, title, and content
4. Read existing vault notes for that parent module
5. Investigate the specific area deeply — the bug, feature, or requirement described in the ticket
6. Write findings to exploration/tickets/t<number>-investigation.md
7. Also enrich the parent module's vault notes with relevant discoveries
TICKET_BLOCK
fi
)

$(if (( session_num % 5 == 0 )); then echo "This is session ${session_num} (multiple of 5) — also run maintenance per §9.4: compress old investigations, detect stale notes, audit cross-references, clean SQLite, refine agenda."; fi)

At session end, follow §9.3 strictly:
- Update _SESSION_BRIEFING.md (timestamp, findings, state, next steps)
- Update _INVESTIGATION_AGENDA.md (completed, new, re-prioritized)
- Update _KNOWLEDGE_COVERAGE.md (coverage changes)
- Update _INDEX.md if new notes created
- Run qmd embed if significant notes added
PROMPT
    fi
}

# ── Stop condition checks ────────────────────────────────────────────────────
check_stop_conditions() {
    local session_num="$1"

    # 1. Stop flag in config
    if [[ "$STOP" == "True" ]]; then
        log "autonomy.stop is true in config.yaml"
        return 1
    fi

    # 2. Max sessions
    if [[ "$MAX_SESSIONS" -gt 0 && "$session_num" -gt "$MAX_SESSIONS" ]]; then
        log "Max sessions reached ($MAX_SESSIONS)"
        return 1
    fi

    # 3. Consecutive failures
    local failures
    failures=$(get_state_field "consecutive_failures")
    if [[ "$failures" -ge "$CONSECUTIVE_FAILURE_LIMIT" ]]; then
        log "Consecutive failure limit reached ($failures >= $CONSECUTIVE_FAILURE_LIMIT)"
        return 1
    fi

    return 0
}

# ── Phase C auto-stop (all test cases in scope covered) ─────────────────────
check_phase_c_complete() {
    [[ "$PHASE" != "autotest_generation" ]] && return 1

    local db="$PROJECT_ROOT/expert-system/analytics.db"
    local manifest="$PROJECT_ROOT/autotests/manifest/test-cases.json"
    [[ ! -f "$db" ]] && return 1
    [[ ! -f "$manifest" ]] && return 1

    # Build scope filter: "all" → no filter, single/comma-separated → IN clause
    local scope="$AUTOTEST_SCOPE"
    local where_clause=""
    if [[ "$scope" != "all" ]]; then
        local modules
        modules=$(echo "$scope" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | sed "s/.*/'&'/" | paste -sd,)
        where_clause="AND module IN ($modules)"
    fi

    # Count manifest total (source of truth for how many tests exist)
    local manifest_total
    manifest_total=$(python3 -c "
import json, sys
with open('$manifest') as f:
    data = json.load(f)
scope = '$scope'
if scope == 'all':
    mods = list(data.get('modules', {}).keys())
else:
    mods = [m.strip() for m in scope.split(',')]
total = 0
for mod in mods:
    mod_data = data.get('modules', {}).get(mod, {})
    for suite in mod_data.get('suites', {}).values():
        total += len(suite.get('test_cases', []))
print(total)
" 2>/dev/null || echo "0")

    # Count tracked (non-pending) in SQLite
    local covered
    covered=$(sqlite3 "$db" "SELECT COUNT(*) FROM autotest_tracking WHERE automation_status != 'pending' $where_clause;" 2>/dev/null || echo "0")

    if [[ "$manifest_total" -gt 0 && "$covered" -ge "$manifest_total" ]]; then
        log "Phase C complete: $covered/$manifest_total test cases covered in scope ($scope)"
        sed -i 's/^  stop: false/  stop: true/' "$PROJECT_ROOT/expert-system/config.yaml"
        STOP="True"
        return 0
    fi
    return 1
}

# ── Vault versioning ─────────────────────────────────────────────────────────
commit_vault() {
    local session_num="$1"
    local exit_code="$2"
    local duration="$3"
    local vault_dir="$PROJECT_ROOT/expert-system/vault"
    local diffstat_file="$LOG_DIR/.last-diffstat"

    if [[ -d "$vault_dir/.git" ]] || \
       git -C "$vault_dir" init --quiet 2>/dev/null; then
        # Capture diffstat before committing
        git -C "$vault_dir" diff --cached --stat --stat-width=120 > "$diffstat_file" 2>/dev/null || true
        git -C "$vault_dir" add -A 2>/dev/null
        # Re-capture after add (in case files were untracked)
        git -C "$vault_dir" diff --cached --stat --stat-width=120 > "$diffstat_file" 2>/dev/null || true
        git -C "$vault_dir" \
            -c user.name="Expert System" -c user.email="expert@local" \
            commit -m "Session $session_num (exit $exit_code, ${duration}s)" \
            --allow-empty 2>/dev/null || true
    fi

    # Update state with vault changes
    python3 -c "
import json, os, re

diffstat_file = '$diffstat_file'
state_file = '$STATE_FILE'

if not os.path.exists(state_file) or not os.path.exists(diffstat_file):
    exit(0)

with open(state_file) as f:
    state = json.load(f)

with open(diffstat_file) as f:
    diffstat = f.read()

if not state['sessions']:
    exit(0)

# Parse diffstat
created = []
changed = []
for line in diffstat.strip().split('\n'):
    line = line.strip()
    if not line or line.startswith('create') or '|' not in line:
        continue
    parts = line.split('|')
    if len(parts) == 2:
        fname = parts[0].strip()
        changed.append(fname)

# Count from git output (the commit message in runner.log has 'create mode')
# Instead parse the diffstat for new vs modified
vault_changes = {
    'files_changed': len(changed),
    'files': changed[:20]  # cap at 20 for dashboard
}

state['sessions'][-1]['vault_changes'] = vault_changes

with open(state_file, 'w') as f:
    json.dump(state, f, indent=2)
" 2>/dev/null || true
}

# ── Completion notification ──────────────────────────────────────────────────
notify_completion() {
    local reason="$1"
    local total_sessions
    total_sessions=$(get_state_field 'session_number')

    log "━━━ Runner finished ━━━"
    log "Reason: $reason"
    log "Total sessions: $total_sessions"
    log "State: $STATE_FILE"

    # Desktop notification (non-fatal if unavailable)
    if command -v notify-send >/dev/null 2>&1; then
        notify-send -u normal "Expert System Runner" \
            "Finished after $total_sessions sessions. Reason: $reason" 2>/dev/null || true
    fi
}

# ── Main loop ─────────────────────────────────────────────────────────────────
main() {
    setup_claude_md
    trap cleanup_claude_md EXIT

    preflight
    parse_config
    init_state

    # Persist runner log to file
    exec > >(tee -a "$LOG_DIR/runner.log") 2>&1

    local session_num
    session_num=$(( $(get_state_field "session_number") + 1 ))

    # Count sessions per phase
    local phase_a_count phase_b_count phase_c_count
    phase_a_count=$(python3 -c "
import json
with open('$STATE_FILE') as f:
    s = json.load(f)
print(sum(1 for x in s['sessions'] if x.get('phase') == 'knowledge_acquisition'))
" 2>/dev/null || echo 0)
    phase_b_count=$(python3 -c "
import json
with open('$STATE_FILE') as f:
    s = json.load(f)
print(sum(1 for x in s['sessions'] if x.get('phase') == 'generation'))
" 2>/dev/null || echo 0)
    phase_c_count=$(python3 -c "
import json
with open('$STATE_FILE') as f:
    s = json.load(f)
print(sum(1 for x in s['sessions'] if x.get('phase') == 'autotest_generation'))
" 2>/dev/null || echo 0)

    log "Starting from session $session_num (max: $MAX_SESSIONS)"
    log "Phase A sessions: $phase_a_count, Phase B sessions: $phase_b_count, Phase C sessions: $phase_c_count"
    log "Model: $MODEL, effort: $EFFORT"
    log "Phase: $PHASE"
    log "Log dir: $LOG_DIR"
    log "Stop flag: $STOP"
    log "Session timeout: $((MAX_DURATION_MINUTES + 30)) minutes"
    log "Session delay: ${DELAY_MINUTES}min (working) / ${DELAY_MINUTES_OFFHOURS}min (off-hours: ${OFFHOURS_UTC} UTC)"
    if [[ "$PEAK_ENABLED" == "True" || "$PEAK_ENABLED" == "true" ]]; then
        log "Peak hours: pause during ${PEAK_RANGE} UTC (weekdays only: ${PEAK_WEEKDAYS_ONLY}), buffer: ${PEAK_BUFFER}min"
    fi

    local stop_reason="unknown"

    local prev_phase="$PHASE"

    while check_stop_conditions "$session_num"; do
        # Re-read config each iteration (phase may have changed)
        parse_config

        # Detect phase change — log it (vault reset is handled by the agent per §9.5)
        if [[ "$PHASE" != "$prev_phase" ]]; then
            log "Phase changed: $prev_phase → $PHASE (agent will execute Phase Reset Protocol §9.5)"
            prev_phase="$PHASE"
        fi

        # Pause during peak pricing hours (waits until off-peak, then re-reads config)
        wait_for_offpeak

        local prompt
        prompt=$(build_prompt "$session_num" "$PHASE")

        local log_file="$LOG_DIR/session-$(printf '%03d' "$session_num")-$(date '+%Y%m%d-%H%M%S').json"
        local stderr_file="${log_file%.json}.stderr"

        log "━━━ Session $session_num ━━━"

        if $DRY_RUN; then
            log "[DRY RUN] Would execute session $session_num"
            log "[DRY RUN] Prompt:"
            echo "---"
            echo "$prompt"
            echo "---"
            log "[DRY RUN] Log file: $log_file"
            log "[DRY RUN] Command: HTTP_PROXY=http://127.0.0.1:2080 HTTPS_PROXY=http://127.0.0.1:2080 timeout $((( MAX_DURATION_MINUTES + 30 ) * 60))s claude -p --output-format json --model $MODEL --effort $EFFORT --dangerously-skip-permissions"
            session_num=$((session_num + 1))
            continue
        fi

        local start_time
        start_time=$(date +%s)

        local exit_code=0
        local timeout_seconds=$(( (MAX_DURATION_MINUTES + 30) * 60 ))

        HTTP_PROXY=http://127.0.0.1:2080 \
        HTTPS_PROXY=http://127.0.0.1:2080 \
        timeout --signal=TERM --kill-after=60 "$timeout_seconds" \
            claude -p \
                --output-format json \
                --model "$MODEL" \
                --effort "$EFFORT" \
                --dangerously-skip-permissions \
                "$prompt" \
                < /dev/null > "$log_file" 2>"$stderr_file" || exit_code=$?

        local end_time
        end_time=$(date +%s)
        local duration=$(( end_time - start_time ))

        if [[ "$exit_code" -eq 124 ]]; then
            log "Session $session_num TIMED OUT after $((timeout_seconds / 60)) minutes"
        fi

        update_state "$session_num" "$exit_code" "$duration" "$log_file" "$PHASE"
        commit_vault "$session_num" "$exit_code" "$duration"
        python3 "$PROJECT_ROOT/expert-system/scripts/generate-dashboard.py" 2>/dev/null || true

        if [[ "$exit_code" -eq 0 ]]; then
            log "Session $session_num completed (${duration}s)"
        elif [[ "$exit_code" -ne 124 ]]; then
            log "Session $session_num FAILED with exit code $exit_code (${duration}s)"
        fi

        # Check if Phase C scope is fully covered → auto-stop
        check_phase_c_complete || true

        session_num=$((session_num + 1))

        # Re-read config before delay check (stop flag may have changed during session)
        parse_config

        # Inter-session delay (skip if this was the last session)
        if check_stop_conditions "$session_num" 2>/dev/null; then
            local current_delay
            current_delay=$(get_current_delay)
            local delay_mode="working hours"
            [[ "$current_delay" -eq "$DELAY_MINUTES_OFFHOURS" ]] && delay_mode="off-hours"
            log "Waiting ${current_delay} minutes before next session ($(date -u '+%H:%M') UTC, ${delay_mode})"
            sleep $(( current_delay * 60 ))
        fi
    done

    # Re-read config for final state
    parse_config

    # Determine stop reason
    if [[ "$STOP" == "True" ]]; then
        stop_reason="autonomy.stop set to true"
    elif [[ "$MAX_SESSIONS" -gt 0 && "$session_num" -gt "$MAX_SESSIONS" ]]; then
        stop_reason="max sessions reached ($MAX_SESSIONS)"
    elif [[ "$(get_state_field 'consecutive_failures')" -ge "$CONSECUTIVE_FAILURE_LIMIT" ]]; then
        stop_reason="consecutive failure limit ($CONSECUTIVE_FAILURE_LIMIT)"
    else
        stop_reason="all sessions completed"
    fi

    notify_completion "$stop_reason"
}

main
