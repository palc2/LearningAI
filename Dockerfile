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
# DATABASE_URL should be injected at runtime via platform env_vars
# Do NOT hardcode sensitive credentials in the Dockerfile

# If your build fails here because it can't connect to DB,
# you might need to temporarily ignore typescript errors during build
# or provide a dummy variable. For now, let's try standard build.
RUN npm run build

# Expose port (Documentation purpose only)
EXPOSE 8000

# Start application using PORT environment variable
# The application will read DATABASE_URL from the platform's environment
CMD sh -c "PORT=${PORT:-8000} npm start"