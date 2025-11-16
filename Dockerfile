FROM directus/directus:9.26.0 as builder

USER root
WORKDIR /app/ai-skin-match

COPY ai-skin-match/package.json .
COPY ai-skin-match/package-lock.json .

RUN npm install --unsafe-perm=true --allow-root --ignore-scripts --production=false

COPY ai-skin-match .
RUN npm run build


FROM directus/directus:9.26.0

WORKDIR /app

COPY --from=builder /app/ai-skin-match/dist /app/extensions/directus-extension-ai-skin-match

COPY --chown=node:node workspace/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV SCHEMA_NAME="snapshot"
COPY workspace/snapshot.yaml /app/snapshot.yaml

EXPOSE 8055

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]