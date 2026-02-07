FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY services/shared/package.json services/shared/
COPY services/user/package.json services/user/
COPY services/post/package.json services/post/
COPY services/comment/package.json services/comment/
COPY services/notification/package.json services/notification/
COPY services/frontend/package.json services/frontend/
RUN npm install
COPY tsconfig.base.json ./
COPY services/shared/ services/shared/
COPY services/notification/ services/notification/

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 3004
CMD ["npx", "tsx", "services/notification/src/index.ts"]
