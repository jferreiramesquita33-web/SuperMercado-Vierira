FROM node:22-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./backend/

WORKDIR /app/backend

ENV npm_config_build_from_source=true

RUN npm ci

WORKDIR /app

COPY . .

EXPOSE 10000

WORKDIR /app/backend

CMD ["npm", "start"]