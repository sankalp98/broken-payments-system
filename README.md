# Broken Payments System — Incident 10/11

Payments are paused. Users reported duplicate charges between 10:00 and 11:00. Your job is to identify affected users, generate the refund report, and fix the root cause so retries do not create duplicate charges for the same order. **Do not disable retries.**

## Context

This repository contains the checkout service, retry worker, and transaction export from the incident window on **2025-10-11** (`data/transactions_10_11.csv`, ~150 rows). During a traffic spike, the payment provider returned intermittent errors while checkout volume was high. Some orders show multiple successful captures in the export.

Regenerate the incident CSV with `npm run build:dataset` after editing `scripts/buildTransactionsDataset.ts`.

## Setup

```bash
npm install
npm test
npm run reproduce
npm run refunds
```

## Layout

| Path | Purpose |
|------|---------|
| `src/checkout.ts` | Order checkout and in-process attempts |
| `src/chargeFailure.ts` | Provider failure classification |
| `src/providerClient.ts` | Provider request wrapper |
| `src/retryPolicy.ts` | Retry eligibility helpers |
| `src/retryWorker.ts` | Background retries for pending/failed orders |
| `src/fakePaymentProvider.ts` | In-repo payment provider simulator |
| `src/refundReport.ts` | Refund aggregation from transaction CSV |
| `data/transactions_10_11.csv` | Exported charges from 10:00–11:00 |
| `scripts/reproduceIncident.ts` | Simulates spike + duplicate charges |
| `scripts/generateRefundReport.ts` | Writes `data/refund_report.csv` |

## Refund rules

For each `order_id`, only **one** successful charge should be kept. Additional successful charges for the same order must be refunded. Refund lines are grouped by `user_id`, `user_name`, and `currency`. Failed charges (no money captured) are not refunded. Legitimate separate orders—even with the same amount—must not be refunded.

## Reproduction

`npm run reproduce` seeds orders, runs parallel checkout under load, and exits non-zero if any order has more than one successful capture.

## Refund report

`npm run refunds` reads `data/transactions_10_11.csv` and writes `data/refund_report.csv`.

## Status

- Payments: **paused**
- Retries: **still enabled** (do not turn off)
