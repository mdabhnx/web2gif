# Base image
FROM mcr.microsoft.com/playwright:v1.40.0-focal

# Set working directory
WORKDIR /app

# Install system dependencies for GIF encoding
RUN apt-get update && apt-get install -y \
    ffmpeg \
    gifski \
    gifsicle \
    && rm -rf /var/lib/apt/lists/*

# Install app dependencies
COPY package*.json ./
RUN npm install

# Copy project files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js app
RUN npm run build

# Expose port
EXPOSE 3000

# Start command (we'll use a script to run both Next.js and the worker)
CMD ["sh", "-c", "npm run start & npm run worker"]
