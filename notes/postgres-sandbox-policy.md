# Policy enforcement for Postgres access from an untrusted sandbox

Session notes. Goal: let a sandboxed workload (e.g. a pod) read from Postgres but not write, with everything in the sandbox untrusted.

## Policy languages (overview)

| Language | Style | Notes |
|---|---|---|
| Rego (OPA) | Declarative, Datalog-like | Cloud-native, K8s, microservices |
| Cedar (AWS) | Declarative, analyzable | Verified Permissions; permit/forbid |
| XACML | XML, ABAC | OASIS, old, verbose |
| AWS IAM JSON | JSON | Effect/Action/Resource/Condition |
| Zanzibar-style (SpiceDB, OpenFGA) | Relationship tuples | ReBAC |
| Casbin | Model + CSV policies | ACL/RBAC/ABAC |
| CEL | Expression language | Google IAM conditions, Envoy, K8s |
| Polar (Oso) | Logic-based | App-embedded authz |
| K8s RBAC YAML | YAML | Roles/RoleBindings |
| SELinux / AppArmor | OS-level MAC | Processes and files |

## Read-only Postgres: use the DB's own permissions first

```sql
CREATE ROLE app_ro LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE mydb TO app_ro;
GRANT USAGE ON SCHEMA public TO app_ro;
GRANT SELECT ON my_table TO app_ro;
ALTER ROLE app_ro SET default_transaction_read_only = on;  -- optional
```

Credential delivery: K8s Secret / External Secrets, Vault DB secrets engine, cloud IAM auth, SPIFFE/SPIRE. Extra layers: NetworkPolicy, Gatekeeper/Kyverno (admission only, not SQL).

## OPA is a decision engine, not a proxy

OPA takes `input` JSON and returns allow/deny. It needs an enforcement point.

```rego
package db.authz

default allow := false

allow if {
    input.service == "orders-app"
    input.table == "customers"
    input.operation == "SELECT"
}
```

| Enforcement point | Fit for Postgres |
|---|---|
| Gatekeeper / Kyverno | Pod specs only, not SQL |
| Envoy + ext_authz | HTTP/gRPC; Postgres filter can't do per-query authz |
| OPA sidecar in app | Trusts the app; bypassable |
| SQL-aware proxy | Only true in-path option; not turnkey |

## Postgres wire protocol (v3) and what a proxy sees

- Startup: `SSLRequest` (plaintext, answer `S`/`N`), then TLS; `StartupMessage` (user, db, options, replication); auth (cleartext/MD5/SCRAM/GSS/cert).
- Simple query: `Query` with raw SQL (may contain multiple statements).
- Extended: `Parse` -> `Bind` -> `Execute` -> `Sync`.
- Also `CopyIn/Out`, `FunctionCall`, `CancelRequest` (separate connection), `Terminate`.

| Stage | Visible without TLS termination |
|---|---|
| TCP, `SSLRequest`, SNI | yes |
| Startup, auth, queries, rows | no (after TLS) |

## TLS termination at the proxy: possible

```
sandbox --TLS(A)--> proxy --TLS(B)--> Postgres
```

Install the proxy CA in the sandbox trust store; issue a cert for the DB hostname. Complications:

- SCRAM channel binding (`-PLUS`) breaks MITM
- client-cert auth to DB can't be forwarded
- direct TLS (PG17 `sslnegotiation=direct`) needs first-byte sniffing
- some drivers ignore the system trust store

Recommended: sandbox gets a dummy credential; proxy terminates TLS and auth, then opens its own upstream connection with the real credential (credential injection).

## Existing tools

- Envoy `postgres_proxy`: TLS termination + lightweight parsing + metadata. Built for observability; no credential injection.
- PgBouncer: TLS + auth swap + pooling, no SQL inspection.
- PgCat / PgDog: pooling, parsing for routing.
- Pgpool-II: real parser, coarse deny lists.
- Teleport DB Access: cert auth, audit, RBAC; heavyweight.
- Boundary: credential brokering, not SQL-aware.

## Recommended build (thin proxy)

Go: `jackc/pgproto3` (wire), `pganalyze/pg_query_go` (real PG parser), `crypto/tls`, embedded OPA.
Rust: `pgwire`, `pg_query.rs`, `rustls`, `regorus`.

Steps:

1. Listen; handle `SSLRequest` / `GSSENCRequest`.
2. TLS handshake with proxy-CA cert.
3. Read `StartupMessage`; authenticate the sandbox (dummy credential or identity).
4. Open upstream with real credentials.
5. Relay loop: `Query`/`Parse` -> `pg_query` AST -> OPA; track prepared statements across `Bind`/`Execute`; deny `CopyData`, `FunctionCall`, unknown messages by default.
6. Relay responses; optional row/byte caps.
7. Handle `CancelRequest` and `Terminate`.

AST policy: only `SelectStmt` without `intoClause`/`lockingClause`; table allowlist from `RangeVar`; function allowlist from `FuncCall` (block `pg_read_file`, `dblink`, `lo_*`, `nextval`). Deny unknown node types.

Plumbing (TCP, TLS, auth, framing, parsing) is solved by libraries. The hard part is safely interpreting the AST (side-effecting functions, writing CTEs, `COPY`, `DO`, views/functions that write). Keep a `GRANT SELECT`-only role upstream as the backstop.

## HTTP alternatives

| Approach | Examples |
|---|---|
| SQL over HTTP | Neon serverless driver, AWS RDS Data API |
| Wire protocol over WebSocket | Neon WS driver |
| REST/GraphQL from schema | PostgREST, Hasura, PostGraphile |
| Authenticated tunnels | Cloud SQL Auth Proxy, SSM, Teleport, Tailscale |

A REST layer (PostgREST + read-only role + Envoy/OPA) avoids SQL parsing entirely: policy becomes HTTP method + path. Cost: no arbitrary SQL for the sandbox.

## Open questions

- Is the proxy the auth boundary (sandbox never holds the real secret)?
- Does the sandbox need free-form SQL, or is a fixed read API enough?
- Which drivers must be supported (libpq/psycopg, pgx, JDBC, asyncpg)?
- Fail closed on unparseable SQL?
- Is exfiltration of read data a threat (size caps, redaction)?
