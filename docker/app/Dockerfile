FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node src/server.js src/database.js ./
COPY --chown=node:node src/public ./public

ENV NODE_ENV=production
EXPOSE 3000

USER node
CMD ["node", "server.js"]
