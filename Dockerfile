FROM directus/directus:9.26.0 as builder

WORKDIR /app

COPY ai-skin-match/package.json /app/ai-skin-match/package.json
COPY ai-skin-match/package-lock.json /app/ai-skin-match/package-lock.json
COPY ai-skin-match /app/ai-skin-match

COPY workspace/package.json /app/package.json
COPY workspace/package-lock.json /app/package-lock.json

USER root
RUN npm install --unsafe-perm=true --allow-root

FROM directus/directus:9.26.0

WORKDIR /app

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json

COPY --chown=node:node workspace/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV SCHEMA_NAME="snapshot"
COPY workspace/snapshot.yaml /app/snapshot.yaml

EXPOSE 8055

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]