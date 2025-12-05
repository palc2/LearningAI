# Use Node.js LTS version
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies (including dev dependencies needed for build)
RUN npm ci

# Copy application code
COPY . .

# Build Next.js application (set NODE_ENV for production build)
RUN NODE_ENV=production npm run build

# Expose port (PORT will be set at runtime by Koyeb)
EXPOSE 8000

# Set NODE_ENV to production for runtime
ENV NODE_ENV=production

# Start application using PORT environment variable
# Use shell form (sh -c) to ensure environment variable expansion works correctly
# Explicitly pass PORT to ensure it's available (server.ts reads from process.env)
CMD sh -c "PORT=${PORT:-8000} npm start"

