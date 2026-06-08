#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="/work/jarvis-dashboard/.claude/sessions"
mkdir -p "$BASE_DIR"

# Generate 1000 synthetic Claude Code sessions (~50MB total)
# Each session: 50-500 JSONL lines with realistic shapes
TOTAL_SESSIONS=${1:-1000}
echo "START: Generating $TOTAL_SESSIONS synthetic sessions in $BASE_DIR"
echo "START_TIME=$(date -u +%s)"

for i in $(seq -w 1 "$TOTAL_SESSIONS"); do
    ID="sess-$(openssl rand -hex 8)"
    FILE="$BASE_DIR/$ID.jsonl"
    LINES=$((50 + RANDOM % 451))
    
    {
        echo '{"timestamp":"2025-01-15T10:00:00Z","actor":"system","event":"session_start","session_id":"'$ID'"}'
        echo '{"timestamp":"2025-01-15T10:00:01Z","actor":"user","message":"Refactor the auth middleware to use JWT instead of sessions"}'
        
        for j in $(seq 1 $LINES); do
            ACTORS=("user" "assistant" "system")
            ACTOR=${ACTORS[$((RANDOM % 3))]}
            MSG_LEN=$((20 + RANDOM % 500))
            MSG=$(openssl rand -base64 $((MSG_LEN * 3 / 4)) | tr -d '\n' | head -c $MSG_LEN)
            TS=$(date -u -d "+${j} seconds" +%Y-%m-%dT%H:%M:%SZ)
            echo "{\"timestamp\":\"$TS\",\"actor\":\"$ACTOR\",\"message\":\"$MSG\",\"line\":$j}"
        done
        
        echo '{"timestamp":"2025-01-15T10:05:00Z","actor":"system","event":"session_end","session_id":"'$ID'"}'
    } > "$FILE"
    
    if [ $((i % 100)) -eq 0 ]; then
        echo "PROGRESS: $i/$TOTAL_SESSIONS sessions created"
    fi
done

SIZE=$(du -sh "$BASE_DIR" | cut -f1)
FILE_COUNT=$(ls -1 "$BASE_DIR"/*.jsonl 2>/dev/null | wc -l)
echo "DONE: $FILE_COUNT files, total size $SIZE"
echo "END_TIME=$(date -u +%s)"
