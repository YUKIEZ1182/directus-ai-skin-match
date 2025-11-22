
#!/bin/sh

sigint_count=0
echo "Schema Name: $SCHEMA_NAME"

# Function to handle cleanup on SIGTERM or SIGINT
cleanup() {
    sigint_count=$((sigint_count + 1))
    if [ "$sigint_count" -ge 3 ]; then
        echo "Received SIGINT more than 2 times. Terminating with SIGKILL..."
        # Get the current script's PID
        pid=$$
        # Send SIGKILL to the current script
        kill -9 $pid
    fi
    echo "Taking snapshot... please wait."
    npx directus schema snapshot --yes ./$SCHEMA_NAME.yaml
    exit 0
}

# Trap SIGTERM and SIGINT signals
trap cleanup SIGTERM SIGINT

cd /app/workspace

# Start Directus with Datadog Tracing
echo "Directus is booting with Datadog tracing enabled..."
npx directus bootstrap

echo "Applying schema from $SCHEMA_NAME.yaml..."
npx directus schema apply --yes ./$SCHEMA_NAME.yaml

echo "Starting Directus with Datadog APM tracing..."
exec npx directus start
