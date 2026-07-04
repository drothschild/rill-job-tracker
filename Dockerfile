FROM node:20-alpine

WORKDIR /app

# Copy Rill dependency (prepared by docker-build.sh)
COPY .docker-deps/rill-lang /rill-lang

# Copy package files and update rill-lang path for Docker
COPY package.json package-lock.json ./
RUN sed -i 's|file:../rill-lang|file:/rill-lang|' package.json

RUN npm ci

# Copy application code
COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/
COPY rules/ ./rules/

# Create data directory
RUN mkdir -p /data

ENV DB_PATH=/data/tracker.db
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["npx", "tsx", "src/server.ts"]
