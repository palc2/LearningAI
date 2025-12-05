# Use Node.js LTS version
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Set environment variables
ENV NODE_ENV=production
# TEMPORARY WORKAROUND: Hardcode DATABASE_URL since platform env_vars aren't being injected
# TODO: Fix this once platform env_vars injection is working
ENV DATABASE_URL=postgresql://neondb_owner:npg_gX3WGIKBz7uD@ep-wispy-moon-adi8seo7-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require

# If your build fails here because it can't connect to DB,
# you might need to temporarily ignore typescript errors during build
# or provide a dummy variable. For now, let's try standard build.
RUN npm run build

# Expose port (Documentation purpose only)
EXPOSE 8000

# Start application using PORT environment variable
# The application will read DATABASE_URL from the platform's environment
CMD sh -c "PORT=${PORT:-8000} npm start"