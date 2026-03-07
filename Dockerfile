FROM node:20-alpine

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install --omit=dev

WORKDIR /app

# Copy the backend code
COPY backend/ ./backend/

# Copy the frontend code
COPY assets/ ./assets/
COPY index.html ./
COPY manifest.json ./
COPY sw.js ./
COPY setup.html ./

# Create the data directory
RUN mkdir -p /app/data && chown -R node:node /app/data

# Use a non-root user
USER node

EXPOSE 3000

CMD ["node", "backend/server.js"]
