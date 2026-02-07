FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY services/shared/package.json services/shared/
COPY services/user/package.json services/user/
COPY services/post/package.json services/post/
COPY services/comment/package.json services/comment/
COPY services/notification/package.json services/notification/
COPY services/frontend/package.json services/frontend/
RUN npm install

FROM deps AS builder
WORKDIR /app
COPY tsconfig.base.json ./
COPY services/frontend/ services/frontend/
WORKDIR /app/services/frontend
RUN npx vite build

FROM node:22-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/services/frontend/package.json services/frontend/package.json
COPY --from=builder /app/services/frontend/dist/client services/frontend/dist/client
COPY services/frontend/server services/frontend/server
EXPOSE 3007
CMD ["npx", "tsx", "services/frontend/server/index.ts"]
