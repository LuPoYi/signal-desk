# Signal Desk

Weekly AI news candidates dashboard. Next.js + Postgres.

- Items: title, summary, source URL, company, 1-5 star rating, status (Candidate / Selected / Dropped).
- Filter by status and company.
- API routes under `/api/items` are gated with `requireIdentity` (`cursor/identity.js`).
- Postgres is declared in `cursor-app.json`; schema lives in `migrations/` and is applied by `scripts/migrate.mjs` during `npm run build`.
- Without `DATABASE_URL`, the app runs against in-memory PGlite (migrations applied on start).

```bash
npm install
env -u DATABASE_URL npm run dev
```
