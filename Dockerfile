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
# Do this BEFORE the build so the file is available during build and runtime
ARG DATABASE_URL
RUN if [ -n "$DATABASE_URL" ]; then \
      echo "{\"DATABASE_URL\": \"$DATABASE_URL\", \"NODE_ENV\": \"production\"}" > config.production.json && \
      echo "✅ Created config.production.json from build arg" && \
      cat config.production.json; \
    else \
      echo "⚠️  DATABASE_URL build arg not provided"; \
    fi

# Build Next.js application (set NODE_ENV for production build)
# The config file should persist through the build
RUN NODE_ENV=production npm run build

# Verify config file still exists after build
RUN if [ -f config.production.json ]; then \
      echo "✅ config.production.json exists after build"; \
      ls -la config.production.json; \
    else \
      echo "⚠️  config.production.json missing after build"; \
    fi

# Expose port (PORT will be set at runtime by Koyeb)
EXPOSE 8000

# Set NODE_ENV to production for runtime
ENV NODE_ENV=production

# Start application using PORT environment variable
# Use shell form (sh -c) to ensure environment variable expansion works correctly
# Explicitly pass PORT to ensure it's available (server.ts reads from process.env)
CMD sh -c "PORT=${PORT:-8000} npm start"

