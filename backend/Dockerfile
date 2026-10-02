FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

# Alpine entrypoint chowns the uploads volume so the non-root API process can write avatars/photos.
FROM alpine:3.20
RUN apk add --no-cache ca-certificates su-exec \
    && adduser -D -u 65532 -g nonroot nonroot
COPY --from=build /out/api /api
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh
ENV ADDR=:8080 UPLOAD_DIR=/data/uploads
EXPOSE 8080
ENTRYPOINT ["/docker-entrypoint.sh"]
