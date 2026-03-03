FROM public.ecr.aws/docker/library/node:18

WORKDIR /app

# Setup directories
RUN mkdir -p /app/public /app/backend /app/data/uploads

# Install backend dependencies
COPY backend/package.json backend/package-lock.json* /app/backend/
RUN cd /app/backend && npm install --production

# Copy backend files
COPY backend/ /app/backend/

# Copy frontend files to /app/public
COPY index.html manifest.json sw.js /app/public/
COPY assets/ /app/public/assets/

# Environment variables with defaults
ENV PORT=3000
ENV PUBLIC_DIR=/app/public
ENV SERVICE_ACCOUNT_PATH=/app/data/firebase-service-account.json
ENV UPLOAD_DIR=/app/data/uploads

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "backend/server.js"]
