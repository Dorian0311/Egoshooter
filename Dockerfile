FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY server ./server
COPY shared ./shared
USER node
EXPOSE 2567
CMD ["node","--import","tsx","server/index.ts"]
