#!/bin/bash

sigint_count=0
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
    npx directus schema snapshot --yes ./snapshot.yaml
    exit 0
}

# Trap SIGTERM and SIGINT signals and call the cleanup function
trap cleanup SIGTERM SIGINT

# Main script logic
echo "Directus is booting. Press Ctrl+C to send SIGINT or terminate the process to send SIGTERM."
cd workspace
npx directus bootstrap
echo "Applying schema from snapshot.yaml"
npx directus schema apply --yes ./snapshot.yaml
echo "Starting directus"
npx directus start