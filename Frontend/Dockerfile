# Dockerfile for the frontend. Used both for local Docker Compose (where
# nginx also reverse-proxies /api/* to the backend container, see
# nginx.conf) and, optionally, to sanity-check the production build before
# shipping client/static to S3 -- in the real AWS deployment the frontend is
# uploaded to S3 and served through CloudFront instead of running as a
# container there.

# ---- Stage 1: build the static assets with Vite ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
# Build-time API base URL. Leave unset for local dev (Docker Compose or
# CloudFront both proxy relative '/api' paths); set it to the backend's
# public HTTPS URL when building for S3/CloudFront production. See
# client/src/api/config.js and the README.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- Stage 2: serve the built static files with nginx ----
FROM nginx:alpine
COPY --from=build /app/static /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
