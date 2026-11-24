FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --chown=node:node . .
USER node
EXPOSE 10000
CMD ["node", "backend/server.js"]
