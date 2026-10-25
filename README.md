# Spending Studio

Standalone Next.js project with all the latest dashboard changes.

## Run

Requires Node.js 22.13 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:3000. For production, run `npm run build` then `npm start`.

Checks: `npm test` (52 tests) and `npm run typecheck`.

No environment variables or account connections are required. Transactions are processed entirely in browser memory and cleared on refresh. An example CSV and sample-data mode are included.

## Imports

Upload several CSVs at once or append more with Add CSVs. Import settings provide per-file column mapping, amount sign convention, date format, account label, and refund/exclusion rules. Date, description, and amount are required. Amounts use USD decimal notation and integer cents. ISO dates and MM/DD/YYYY or DD/MM/YYYY are supported. Invalid rows are skipped.

Purchases use negative amounts by default. Refunds reduce spending, and exclusions for payments/transfers/income take priority. Classification uses the type/category fields. Unknown opposite-sign amounts are excluded unless opted into refunds.

Overlap deduplication is enabled by default. Matches use account label, date, original description, signed amount, purchase/refund classification, and type. Repeated charges within a file are preserved. Give separate accounts different labels to prevent cross-account matches. Deduplication can be disabled in Import settings.

## Periods and comparisons

This month, This week (Monday-based), Today, All dates, and Custom range are supported. Previous/next arrows preserve the elapsed span: October 1–15 → September 1–15. Jump to current month/week or today returns to the present. Partial monthly totals explicitly show their cutoff date.

Spending per day divides net imported spending by inclusive calendar days. Comparisons use equivalent elapsed dates in the previous month/week/day, with short-month clamping, and exactly match the earlier navigable period. Today compares daily totals against yesterday because source dates lack time-of-day precision. The tooltip shows exact reference dates.

Current imports may end before today, provided they overlap the displayed period. Missing current/earlier coverage produces an explanation. CSV date extent is inferred coverage, not proof of a complete statement; missing records can understate spending.

## Trend and ledger

The trend starts collapsed. Buckets follow the timeframe: monthly, weekly, or daily. Earlier imported periods remain visible for comparison, while the metrics and ledger stay scoped to the selected period. All dates uses monthly buckets; Custom range uses daily buckets.

Graph-only From/To dates and horizontal drag-selection zoom to whole buckets without changing totals or dashboard filters. Reset range restores history. Escape cancels dragging. Partial buckets and zero-spend buckets remain visible. An expanded graph stays open during period navigation.

Category bars and merchant/description search filter the dashboard. Merchant consolidation groups normalized merchant/category, retains original descriptions, and sums amounts/counts. Normalization is heuristic. CSV export includes the full filtered ledger beyond pagination, with spreadsheet formulas escaped.

## Source

- app/page.tsx: dashboard and imports
- components/spending-trend.tsx: graph interactions
- lib/transactions.ts: ingestion, deduplication, analytics
- tests/transactions.test.ts: data and analytics tests

Hosting-specific files, transaction uploads, dependencies, and generated build output are excluded from this archive.
