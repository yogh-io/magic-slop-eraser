#!/bin/bash
set -euo pipefail

# Server-side deploy script. GHA pulls the repo here then runs this.
# Requires: kamal-proxy running on the 'kamal' Docker network.

SERVICE="slopmop"

# Serialize concurrent deploys. Rapid pushes can fire multiple GHA runs in
# parallel; without this lock the cleanup loop near the end of this script
# races between deploys and each one's cleanup kills the other's container.
LOCK_FILE="/var/lock/deploy-${SERVICE}.lock"
exec 200>"${LOCK_FILE}"
echo "Acquiring deploy lock (${LOCK_FILE})..."
flock 200
echo "Lock acquired."

SHORT=$(date +%s)
CONTAINER="${SERVICE}-web-${SHORT}"

# Build natively (local layer cache persists between deploys)
docker build -t "${SERVICE}:${SHORT}" --label service="${SERVICE}" --quiet .

# Start new container (matches kamal's flags)
docker run --detach --restart unless-stopped \
  --name "${CONTAINER}" \
  --network kamal \
  --stop-timeout 3 \
  --log-opt max-size=10m \
  --label service="${SERVICE}" \
  --label role=web \
  "${SERVICE}:${SHORT}" > /dev/null

# Zero-downtime switch (kamal-proxy runs health check before switching)
docker exec kamal-proxy kamal-proxy deploy "${SERVICE}-web" \
  --target="${CONTAINER}:80" \
  --host="slop..io" \
  --tls \
  --deploy-timeout="10s" \
  --drain-timeout="5s" \
  --health-check-path="/" \
  --target-timeout="15s" \
  --buffer-requests \
  --buffer-responses

# Stop and remove previous containers
docker ps -a --filter "label=service=${SERVICE}" --filter "label=role=web" --format '{{.Names}}' | while read -r name; do
  [ "${name}" != "${CONTAINER}" ] && docker stop --time 3 "${name}" > /dev/null 2>&1 && docker rm "${name}" > /dev/null 2>&1 || true
done

# Prune old images
docker image prune -f --filter "label=service=${SERVICE}" > /dev/null 2>&1

echo "Deployed ${SHORT}"
