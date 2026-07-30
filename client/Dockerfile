# Dockerfile for the frontend -- OPTIONAL, and only useful for previewing
# the production build locally in a container.
#
# In the real AWS deployment, the frontend is NOT run as a container: `npm
# run build` produces static files (in dist/) that get uploaded to an S3
# bucket and served through CloudFront. This Dockerfile just reproduces that
# same build inside Docker and serves the result with nginx so you can sanity
# check the production build before shipping it to S3.

# ---- Stage 1: build the static assets with Vite ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# ---- Stage 2: serve the built static files with nginx ----
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
