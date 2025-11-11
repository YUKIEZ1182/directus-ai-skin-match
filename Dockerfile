
FROM directus/directus:9.26.0 as builder
COPY workspace/package.json /app/package.json
USER root
WORKDIR /app

RUN --mount=type=bind,source=.npmrc,target=/root/.npmrc \
    npm install --userconfig=/root/.npmrc --unsafe-perm=true --allow-root --no-save dd-trace


FROM directus/directus:9.26.0

WORKDIR /app

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY project-c /project-c
COPY --chown=node:node workspace/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
ARG SCHEMA_NAME
ENV SCHEMA_NAME=$SCHEMA_NAME
COPY workspace/$SCHEMA_NAME.yaml /app/$SCHEMA_NAME.yaml
ENV NODE_OPTIONS="--require=/app/node_modules/dd-trace/init"
ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
