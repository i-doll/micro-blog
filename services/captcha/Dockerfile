# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY services/shared/package.json services/shared/
COPY services/auth/package.json services/auth/
COPY services/user/package.json services/user/
COPY services/post/package.json services/post/
COPY services/comment/package.json services/comment/
COPY services/notification/package.json services/notification/
COPY services/frontend/package.json services/frontend/
COPY services/captcha/package.json services/captcha/
RUN --mount=type=cache,target=/root/.npm \
    npm install
COPY tsconfig.base.json ./
COPY services/shared/ services/shared/
COPY services/captcha/ services/captcha/

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 3008
CMD ["npx", "tsx", "services/captcha/src/index.ts"]
