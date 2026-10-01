// Package seed embeds optional demo data (enable with SEED_DEMO=true).
package seed

import _ "embed"

//go:embed demo.sql
var Demo string
