// Package api has the types and the server interface generated from
// api/openapi.yaml. Do not edit api.gen.go: change the contract and run
// "go generate ./..." in the backend directory.
package api

//go:generate go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.8.2 -config oapi-codegen.yaml ../../../api/openapi.yaml
