# FROM directus/directus:9.26.0 as builder

# USER root
# WORKDIR /app/ai-skin-match

# COPY ai-skin-match/package.json .
# COPY ai-skin-match/package-lock.json .

# RUN npm install --unsafe-perm=true --allow-root --ignore-scripts --production=false

# COPY ai-skin-match .
# RUN npm run build


# FROM directus/directus:9.26.0

# WORKDIR /app

# COPY --from=builder /app/ai-skin-match/dist /app/extensions/directus-extension-ai-skin-match

# COPY --chown=node:node workspace/entrypoint.sh /app/entrypoint.sh
# RUN chmod +x /app/entrypoint.sh

# ENV SCHEMA_NAME="snapshot"
# COPY workspace/snapshot.yaml /app/snapshot.yaml

# EXPOSE 8055

# ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]

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

# 🛠️ FIX 1: COPY WORKSPACE AND INSTALL DEPENDENCIES 🛠️
# 1. คัดลอกโฟลเดอร์ workspace ทั้งหมด (รวมถึง package.json)
COPY workspace /app/workspace
# 2. เข้าสู่โฟลเดอร์ workspace
WORKDIR /app/workspace
# 3. ติดตั้ง Directus v9.26.0 และ dependencies ที่ระบุใน package.json
RUN npm install
# 4. กลับไปที่ WORKDIR /app
WORKDIR /app
# ----------------------------------------------------

COPY --chown=node:node workspace/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV SCHEMA_NAME="snapshot"
# 5. คัดลอก snapshot.yaml ไปที่โฟลเดอร์ workspace
COPY workspace/snapshot.yaml /app/workspace/snapshot.yaml 

EXPOSE 8055

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]