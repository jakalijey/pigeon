FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY chain.mjs registry.mjs rules.mjs server.mjs ./
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8104 DATA_DIR=/data
EXPOSE 8104
USER node
CMD ["node", "server.mjs"]
