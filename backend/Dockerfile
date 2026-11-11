# Build stage: the official Go image compiles a static binary.
FROM golang:1.26 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /out/api ./cmd/api

# Final image: only the binary and the CA certificates, with a non-root user.
FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /out/api /api
USER 65534:65534
EXPOSE 8080
ENTRYPOINT ["/api"]
