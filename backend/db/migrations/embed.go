// Package migrations has the SQL migrations of the database, in the goose
// format. The API applies them when it starts.
package migrations

import "embed"

// The queries of db/queries use the schema of these migrations. sqlc reads
// the two and writes the Go code of each module.
//
//go:generate go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.31.1 generate -f ../../sqlc.yaml

// FS has the migration files.
//
//go:embed *.sql
var FS embed.FS
