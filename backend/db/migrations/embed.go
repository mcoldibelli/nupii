// Package migrations has the SQL migrations of the database, in the goose
// format. The API applies them when it starts.
package migrations

import "embed"

// FS has the migration files.
//
//go:embed *.sql
var FS embed.FS
