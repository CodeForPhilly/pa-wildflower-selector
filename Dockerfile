FROM node:16-alpine as develop-stage

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .

CMD ["npm", "run", "dev"]

# TODO: Create a production section a la https://medium.com/@jwdobken/vue-with-docker-initialize-develop-and-build-51fad21ad5e6
# Can also volume in node_modules, check on hot reloading, and split up this container into two if desired.