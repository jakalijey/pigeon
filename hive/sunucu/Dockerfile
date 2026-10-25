FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs kimlik.mjs zip.mjs db.mjs hive-db.js nim.js llms.txt llms-full.txt ./
ENV NODE_ENV=production CANLI=1 HOST=0.0.0.0 PORT=8105 DATA_DIR=/data NIMIQ_CORE=@nimiq/core \
    IDENTICONS=/app/node_modules/@nimiq/identicons/dist/identicons.bundle.min.js \
    PIGEON_API=https://signal.heylogram.tv/pigeonapi SITE_KOK=https://signal.heylogram.tv/kovanapi API_KOK=https://signal.heylogram.tv/kovanapi
EXPOSE 8105
USER node
CMD ["node", "server.mjs"]
