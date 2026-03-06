FROM node:18-alpine
WORKDIR /app

# Copy the backend package files first to leverage Docker cache
COPY backend/package*.json ./backend/

# Install backend dependencies
RUN cd backend && npm ci --production

# Copy the rest of the application files
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", "backend/server.js"]
