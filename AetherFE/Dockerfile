FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --quiet

COPY . .

# NHẬN BIẾN MÔI TRƯỜNG TỪ DOCKER COMPOSE ĐỂ VITE NHÚNG VÀO CODE JS
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
