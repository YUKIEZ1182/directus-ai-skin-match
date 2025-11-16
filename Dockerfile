FROM directus/directus:9.26.0 as builder

USER root
WORKDIR /app

COPY ai-skin-match/package.json /app/ai-skin-match/package.json
COPY ai-skin-match/package-lock.json /app/ai-skin-match/package-lock.json

WORKDIR /app/ai-skin-match
RUN npm install --unsafe-perm=true --allow-root

COPY ai-skin-match /app/ai-skin-match
RUN npm run build

WORKDIR /app
COPY workspace/package.json /app/workspace/package.json
COPY workspace/package-lock.json /app/workspace/package-lock.json

WORKDIR /app/workspace
RUN npm install --unsafe-perm=true --allow-root


FROM directus/directus:9.26.0

WORKDIR /app

COPY --from=builder /app/workspace/node_modules /app/node_modules
COPY --from=builder /app/workspace/package.json /app/package.json

COPY --from=builder /app/ai-skin-match /app/ai-skin-match

COPY --chown=node:node workspace/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV SCHEMA_NAME="snapshot"
COPY workspace/snapshot.yaml /app/snapshot.yaml

EXPOSE 8055

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]