ARG DIRECTUS_VERSION=directus/directus:9.26.0

FROM node:18-alpine AS builder

USER root
WORKDIR /app/ai-skin-match

COPY ai-skin-match/package.json .
COPY ai-skin-match/package-lock.json .
RUN npm install --unsafe-perm=true --allow-root --ignore-scripts --production=false

COPY ai-skin-match .
RUN npm run build
RUN npm pack


FROM ${DIRECTUS_VERSION}

WORKDIR /app

USER root

COPY package.json .
COPY package-lock.json .
COPY entrypoint.sh . 

RUN npm install --unsafe-perm=true --allow-root

COPY --from=builder /app/ai-skin-match/*.tgz /tmp/
RUN npm install --unsafe-perm=true --allow-root /tmp/*.tgz

RUN chown -R node:node /app
RUN chmod +x ./entrypoint.sh

USER node

EXPOSE 8055

ENTRYPOINT ["/bin/sh", "./entrypoint.sh"]
CMD ["npx", "directus", "bootstrap", "&&", "npx", "directus", "start"]