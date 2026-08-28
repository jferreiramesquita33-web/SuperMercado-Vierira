FROM node:22-bookworm

WORKDIR /app

COPY backend/package*.json ./backend/

WORKDIR /app/backend

RUN npm ci

WORKDIR /app

COPY . .

EXPOSE 10000

WORKDIR /app/backend

CMD ["npm", "start"]