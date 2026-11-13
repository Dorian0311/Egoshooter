FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS client-build
COPY tsconfig.json index.html ./
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY tests ./tests
COPY public ./public
COPY scripts/compress-client.mjs ./scripts/compress-client.mjs
RUN npm run build

FROM caddy:2-alpine AS web
COPY --from=client-build /app/dist /srv
COPY deploy/docker/Caddyfile /etc/caddy/Caddyfile

FROM node:22-alpine AS game
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./
COPY server ./server
COPY shared ./shared
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 2567
CMD ["node","--import","tsx","server/index.ts"]
