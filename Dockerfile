FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev
WORKDIR /app

COPY backend/server.js ./backend/server.js
COPY index.html ./index.html
COPY manifest.json ./manifest.json
COPY sw.js ./sw.js
COPY assets ./assets

WORKDIR /app/backend
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
