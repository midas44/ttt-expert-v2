# Database Configuration (Future)

Postgres MCP Pro is installed in read-only (restricted) mode.
DB integration into test data classes is planned but NOT YET implemented.

## Connection

Set the `POSTGRES_URI` environment variable:
```
export POSTGRES_URI="postgresql://readonly_user:password@host:5432/ttt_testdb"
```

## MCP Usage (development-time only)

The Postgres MCP is available for:
- Schema exploration during test design
- Test data mining / discovery
- Understanding data relationships

It is NOT used at test runtime.
