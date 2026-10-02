FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Empty = same-origin /api and /uploads via nginx (works on LAN + PWA).
ARG VITE_API_URL=
ARG VITE_MAPBOX_ACCESS_TOKEN=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MAPBOX_ACCESS_TOKEN=$VITE_MAPBOX_ACCESS_TOKEN
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
