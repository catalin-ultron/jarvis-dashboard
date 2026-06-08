#!/usr/bin/env bash
# Scenario 4: Prints progress every 2 seconds for 60 seconds
# Tests live stdout streaming via monitor tool

echo "STREAMER_START: $(date -u +%s)"

for i in $(seq 1 30); do
    PCT=$((i * 100 / 30))
    echo "PROGRESS: $PCT% — Step $i/30 — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    sleep 2
done

echo "STREAMER_DONE: $(date -u +%s)"
