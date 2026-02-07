# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY services/shared/package.json services/shared/
COPY services/user/package.json services/user/
COPY services/post/package.json services/post/
COPY services/comment/package.json services/comment/
COPY services/notification/package.json services/notification/
COPY services/frontend/package.json services/frontend/
RUN --mount=type=cache,target=/root/.npm \
    npm install
COPY tsconfig.base.json ./
COPY services/shared/ services/shared/
COPY services/comment/ services/comment/

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 3003
CMD ["npx", "tsx", "services/comment/src/index.ts"]
