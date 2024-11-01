FROM node:16-alpine

# Install ImageMagick
RUN apk add --no-cache imagemagick

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

CMD node app.js
