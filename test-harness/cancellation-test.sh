#!/usr/bin/env bash
# Scenario 5: Cancellation mid-flight test
# Writes files every 2 seconds for up to 120 seconds
# Designed to be cancelled mid-loop

set -euo pipefail

OUTDIR="/work/jarvis-dashboard/test-harness/cancellation-output"
mkdir -p "$OUTDIR"

echo "[$(date '+%H:%M:%S')] Cancellation test started — PID: $$"
echo "[$(date '+%H:%M:%S')] Writing files to: $OUTDIR"
echo "[$(date '+%H:%M:%S')] Will run for max 120 seconds unless cancelled..."
echo ""

for i in $(seq 1 60); do
    FILE="$OUTDIR/progress-$(printf '%03d' $i).txt"
    echo "Iteration $i at $(date '+%H:%M:%S')" > "$FILE"
    echo "Random data: $(openssl rand -hex 32)" >> "$FILE"
    echo "[$(date '+%H:%M:%S')] Wrote $FILE"
    sleep 2
done

echo ""
echo "[$(date '+%H:%M:%S')] Loop completed naturally (was NOT cancelled)"
