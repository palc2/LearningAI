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

# Set DATABASE_URL as environment variable
# Note: This is a workaround for deployment platforms that don't properly set env_vars
# The credentials will be in the Docker image, but not in git
ENV DATABASE_URL=postgresql://neondb_owner:npg_Xo3sT4FfmMNP@ep-wispy-moon-adi8seo7-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Start application using PORT environment variable
# Use shell form (sh -c) to ensure environment variable expansion works correctly
# Explicitly pass PORT to ensure it's available (server.ts reads from process.env)
CMD sh -c "PORT=${PORT:-8000} npm start"

