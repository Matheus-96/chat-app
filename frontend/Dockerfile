FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm i
COPY . .
RUN npm run build

FROM alpine:3.20 AS runner
RUN apk add --no-cache lighttpd
COPY lighttpd.conf /etc/lighttpd/lighttpd.conf
COPY --from=build /app/dist /var/www/localhost/htdocs
EXPOSE 80
CMD ["lighttpd", "-D", "-f", "/etc/lighttpd/lighttpd.conf"]
