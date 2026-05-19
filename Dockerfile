# =========================
# BUILD STAGE
# =========================
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build


# =========================
# PRODUCTION STAGE
# =========================
FROM node:20-slim

WORKDIR /app

# Copy only production essentials
COPY package*.json ./
RUN npm install --omit=dev

# Copy built frontend + backend
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/schema.sql ./schema.sql

# IMPORTANT: if you use src/ in runtime, include it
COPY --from=builder /app/src ./src

EXPOSE 3000

CMD ["node", "server.js"]