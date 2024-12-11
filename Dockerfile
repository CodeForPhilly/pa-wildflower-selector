# Using node:20-alpine
FROM node@sha256:426f843809ae05f324883afceebaa2b9cab9cb697097dbb1a2a7a41c5701de72

# Install ImageMagick
RUN apk add --no-cache imagemagick

# Set NODE_OPTIONS for OpenSSL compatibility
ENV NODE_OPTIONS=--openssl-legacy-provider

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

CMD node app.js
