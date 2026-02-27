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

# 1. คัดลอก Dependencies หลัก
COPY package.json .
COPY package-lock.json .
COPY entrypoint.sh . 

# 2. 🛠️ ใส่กล่องเครื่องมือช่าง (สำคัญมาก เพื่อให้สร้าง argon2 และ sharp ได้)
RUN apk update && apk add --no-cache python3 make g++ vips-dev

# 3. ติดตั้ง Core Dependencies (เอา --ignore-scripts ออก และไม่ใช้ Mirror ที่พัง)
RUN npm install --unsafe-perm=true --allow-root

# 4. ติดตั้ง Custom Extension ของคุณ
COPY --from=builder /app/ai-skin-match/*.tgz /tmp/
RUN npm install --unsafe-perm=true --allow-root /tmp/*.tgz

# 5. แก้ไขสิทธิ์การเข้าถึงไฟล์ทั้งหมด
RUN chown -R node:node /app
RUN chmod +x ./entrypoint.sh

# 6. สลับกลับไปใช้ผู้ใช้ 'node'
USER node

EXPOSE 8055

ENTRYPOINT ["/bin/sh", "./entrypoint.sh"]
# FIX 502 Bad Gateway: บังคับให้ Directus ฟังบน 0.0.0.0 และรัน bootstrap ก่อน start
CMD ["/bin/sh", "-c", "npx directus bootstrap && HOST=0.0.0.0 npx directus start"]