FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --quiet

COPY . .
RUN npm run build

FROM nginx:stable-alpine

# Copy cấu hình Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy tệp tĩnh từ thư mục dist của Vite
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
