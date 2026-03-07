FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

COPY backend/server.js ./backend/server.js
COPY index.html ./index.html
COPY manifest.json ./manifest.json
COPY sw.js ./sw.js
COPY assets ./assets

WORKDIR /app/backend
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
