# Quickstart: Admin State Discovery

**Feature**: 016-admin-state-discovery  
**Branch**: `016-admin-state-discovery`

## Prerequisites

- PostgreSQL running with `judgesdirectory` database
- Environment variables set: `DATABASE_URL`, `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_CX`, `OPENAI_API_KEY`
- `npm install` completed
- Admin credentials configured (`ADMIN_USER`, `ADMIN_PASSWORD`)

## Schema Migration

```bash
# Add CANCELLED to DiscoveryRunStatus enum
npx prisma migrate dev --name add_cancelled_discovery_status
```

## Quick Verification

1. **Start dev server**:

   ```bash
   npm run dev
   ```

2. **Open admin discovery page**:
   Navigate to `http://localhost:3000/admin/discovery/`

3. **Trigger a discovery run**:
   - Select a state from the dropdown (e.g., "Florida")
   - Observe the state summary card (candidate counts, last run date)
   - Click "Run Discovery"
   - Verify the run appears in the history table with "Running" status
   - Watch metrics auto-update every 5 seconds

4. **Cancel a run** (optional):
   - While a run is in progress, click "Cancel"
   - Verify the run status changes to "Failed" with "Cancelled by user" message

5. **API verification**:

   ```bash
   # List runs
   curl -u admin:password http://localhost:3000/api/admin/discovery/runs

   # Get state summary
   curl -u admin:password "http://localhost:3000/api/admin/discovery/summary?state=FL"

   # Trigger a run
   curl -u admin:password -X POST \
     -H "Content-Type: application/json" \
     -d '{"stateAbbr": "FL"}' \
     http://localhost:3000/api/admin/discovery/runs
   ```

## Key Files

| File                                             | Purpose                                   |
| ------------------------------------------------ | ----------------------------------------- |
| `src/app/admin/discovery/page.tsx`               | Admin discovery page (modified)           |
| `src/app/api/admin/discovery/runs/route.ts`      | GET runs list + POST trigger              |
| `src/app/api/admin/discovery/runs/[id]/route.ts` | PATCH cancel run                          |
| `src/app/api/admin/discovery/summary/route.ts`   | GET state summary                         |
| `src/components/admin/DiscoveryRunTrigger.tsx`   | State selector + summary + button         |
| `src/components/admin/DiscoveryRunHistory.tsx`   | Runs table with auto-poll                 |
| `scripts/discovery/discover.ts`                  | Discovery CLI (modified: `--run-id` flag) |
| `prisma/schema.prisma`                           | Schema: CANCELLED added to enum           |
