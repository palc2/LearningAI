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

# Accept DATABASE_URL as build argument (will be passed from deployment platform)
ARG DATABASE_URL

# Set environment variables
ENV NODE_ENV=production
# Set DATABASE_URL as environment variable so it's available at runtime
ENV DATABASE_URL=${DATABASE_URL}

# If your build fails here because it can't connect to DB,
# you might need to temporarily ignore typescript errors during build
# or provide a dummy variable. For now, let's try standard build.
RUN npm run build

# Expose port (Documentation purpose only)
EXPOSE 8000

# Start application using PORT environment variable
# The application will read DATABASE_URL from the platform's environment
CMD sh -c "PORT=${PORT:-8000} npm start"