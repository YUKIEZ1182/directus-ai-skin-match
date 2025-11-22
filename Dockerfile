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

FROM directus/directus:9.26.0

WORKDIR /app

COPY --from=builder /app/ai-skin-match/dist /app/extensions/directus-extension-ai-skin-match

# 🛠️ FIX 1: PERMISSION AND INSTALLATION FOR WORKSPACE 🛠️
# สลับไปใช้ ROOT ชั่วคราวเพื่อดำเนินการติดตั้ง
USER root

# 1. คัดลอกโฟลเดอร์ workspace ทั้งหมด (รวมถึง package.json)
COPY workspace /app/workspace
# 2. เข้าสู่โฟลเดอร์ workspace
WORKDIR /app/workspace
# 3. ติดตั้ง Directus v9.26.0 และ dependencies (สำเร็จเพราะใช้ root)
RUN npm install
# 4. เปลี่ยนเจ้าของไฟล์ทั้งหมดใน workspace ให้เป็นผู้ใช้ 'node' เพื่อความปลอดภัย
RUN chown -R node:node /app/workspace
# 5. สลับกลับไปใช้ USER node (ตามที่ Directus แนะนำ)
USER node
# ----------------------------------------------------

# แก้ไข COPY entrypoint.sh ให้มั่นใจว่าใช้ user node
COPY --chown=node:node workspace/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV SCHEMA_NAME="snapshot"
# 6. คัดลอก snapshot.yaml ไปที่โฟลเดอร์ workspace
COPY workspace/snapshot.yaml /app/workspace/snapshot.yaml 

EXPOSE 8055

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]