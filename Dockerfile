# API image when the build context is the monorepo root (Render default, docker build .).
# Fly.io: deploy from backend/ and use backend/Dockerfile instead.
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM alpine:3.20
RUN apk add --no-cache ca-certificates su-exec \
    && adduser -D -u 65532 -g nonroot nonroot
COPY --from=build /out/api /api
COPY backend/docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh
ENV ADDR=:8080 UPLOAD_DIR=/data/uploads
EXPOSE 8080
ENTRYPOINT ["/docker-entrypoint.sh"]
