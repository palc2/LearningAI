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

# Create config.production.json from build arg if provided
# This allows DATABASE_URL to be passed securely via build_args without committing to git
ARG DATABASE_URL
RUN if [ -n "$DATABASE_URL" ]; then \
      echo "{\"DATABASE_URL\": \"$DATABASE_URL\", \"NODE_ENV\": \"production\"}" > config.production.json && \
      echo "✅ Created config.production.json from build arg"; \
    else \
      echo "⚠️  DATABASE_URL build arg not provided, config file will not be created"; \
    fi

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

