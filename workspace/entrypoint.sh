#!/bin/sh

sigint_count=0
echo "Schema Name: $SCHEMA_NAME"

# Function to handle cleanup on SIGTERM or SIGINT
cleanup() {
    sigint_count=$((sigint_count + 1))
    if [ "$sigint_count" -ge 3 ]; then
        echo "Received SIGINT more than 2 times. Terminating with SIGKILL..."
        pid=$$
        kill -9 $pid
    fi
    echo "Taking snapshot... please wait."
    # Execute from /app/workspace for context
    (cd /app/workspace && npx directus schema snapshot --yes ./$SCHEMA_NAME.yaml)
    exit 0
}

# Trap SIGTERM and SIGINT signals
trap cleanup SIGTERM SIGINT

# 📌 FIX: Change directory to the workspace where Directus 9.26.0 is installed
cd /app/workspace

# Start Directus 
echo "Directus is booting..."
npx directus bootstrap

echo "Applying schema from $SCHEMA_NAME.yaml..."
npx directus schema apply --yes ./$SCHEMA_NAME.yaml

echo "Starting Directus..."
exec npx directus start