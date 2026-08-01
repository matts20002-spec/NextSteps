# Dockerfile for the backend API -- this is the image that runs as an
# ECS Fargate task in the target production architecture.
#
# The frontend is NOT built or run from this image: in production it's a
# separate static build uploaded to S3 and served through CloudFront (see
# the root README and client/Dockerfile for that build-only image).

FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests first so `npm install` is cached as its own
# Docker layer and only re-runs when package.json actually changes.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Now copy the rest of the application source.
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/index.js"]
