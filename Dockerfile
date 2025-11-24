FROM node:20-slim

# Install ImageMagick and AWS CLI
RUN apt-get update && apt-get install -y \
    imagemagick \
    awscli \
    && rm -rf /var/lib/apt/lists/*

# Set NODE_OPTIONS for OpenSSL compatibility and limit memory usage
ENV NODE_OPTIONS="--openssl-legacy-provider --max-old-space-size=768"

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

CMD node app.js
