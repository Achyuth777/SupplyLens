# SupplyLens, explained for an interview

## The product problem

A manager needs to know which products may run out, which suppliers are reliable, and how much to reorder. SupplyLens connects those questions to the same saved inventory state. Its strongest demonstration is the purchase workflow: a calculated recommendation becomes a purchase order, a receipt changes inventory, and the dashboard and supplier metrics reflect that change.

## Frontend

`app/page.tsx` is the marketing experience. `app/workspace/page.tsx` requires authenticated identity before rendering the workspace client. `app/workspace/workspace.tsx` loads state from the API, displays functional sections and sends typed actions. Query parameters preserve section links. React state controls transient selections; business data lives in D1. Only the theme is stored in localStorage.

Charts visualize actual input series or model outputs. Changing a simulator slider recalculates the result immediately. Saving a scenario persists assumptions, not a frozen fake prediction; loading it uses the current product demand history.

## Backend and database

`app/api/workspace/route.ts` implements authenticated GET and POST. GET creates one demo aggregate per new account with `INSERT OR IGNORE`. POST validates the envelope, loads the current version, validates and applies the domain action, then conditionally updates the row only if the revision still matches.

`lib/actions.ts` is a reducer with server-enforced business rules. It rejects negative quantities, duplicate SKUs, mismatched supplier/product orders, duplicate order lines, invalid transitions and repeated receipts.

The current database has a single workspace table with owner, JSON payload and revision. Product → supplier and order item → product references are validated in application code. This is an honest trade-off: easy atomic writes for a small demo, but less queryability and scalability than normalized tables. Do not describe this as a normalized PostgreSQL implementation. The next version should add separate inventory, movements, orders and membership tables.

## Why the purchase flow is safe from double receipt

Suppose two tabs both read revision 10 and attempt to receive an order. Both compute a candidate state, but the SQL update includes `WHERE owner=? AND revision=10`. Only the first succeeds and advances the revision to 11. The second gets a conflict. A later replay also fails because a received order cannot transition to received again. Stock, movements, order state and supplier delivery history are in the same row update, so they cannot partially commit.

This is optimistic concurrency control. It is not an excuse to skip future integration tests against the actual deployed database.

## Forecasting

The exponential smoothing estimate updates gradually: 30% of today's measured demand and 70% of the prior estimate. For constant sales of 50 units/day, the forecast stays at 50. The simple method is explainable, inexpensive and a good baseline. It does not learn seasonality. The last 14 one-step absolute errors are averaged for MAE; this avoids inventing a confidence score.

## Reorder logic

A product selling 50 units/day with a seven-day supplier lead time and 150 safety units has a reorder point of `50*7+150 = 500`. A 30-day target beyond lead time requires `50*(7+30)+150` total units, from which current stock and committed incoming orders are subtracted. Drafts count as incoming for deduplication, but they must be placed to become actual orders.

## Simulator example

Stock 1,000; daily demand 50; normal lead seven days; delay 15 days; demand increase 30%; safety stock 150:

- Revised daily demand: 65.
- Arrival: day 22.
- Runout: about day 15.38.
- Demand before arrival: 1,430.
- Uncovered units: 430.
- Additional usable units including safety: 580.

The output is deterministic. Saying “80% stockout probability” would require a validated probabilistic demand/lead-time model, which this app does not have. Reduced supplier capacity scales fulfillment quantity; transport disruption adds days.

## Supplier analytics

An on-time delivery arrives on or before its recorded expected date. A supplier with nine on-time deliveries out of ten has 90% observed reliability. Average lead time is the mean elapsed days across delivery records. Receiving a purchase order adds a record and updates those results.

## Authentication

ChatGPT establishes identity outside the application. The server reads trusted platform identity headers, refuses unauthenticated access and keys storage to that identity. The browser cannot select an arbitrary owner. Workspace organization names are display labels, not multi-user organizations. Team invites and roles are not implemented.

## Questions to practice

**Did you build everything by hand?** Explain your actual AI-assisted process honestly. You should be able to locate the forecast function, change a validation rule, explain a failing test and trace the receipt transaction.

**Why use smoothing rather than a neural network?** We have a small dataset and need explainable decisions. Establish a baseline first; measure improvement with held-out data before adding complexity.

**Why not store everything in the browser?** Inventory records must persist across devices and receive server-side validation. localStorage is only used for a harmless appearance preference.

**What are the major limitations?** JSON-aggregate storage, single-owner workspaces, no ERP integrations, synthetic initial sales, no historical stock snapshots, no partial receipts, and no live browser QA in the available environment.

**How would you make it production-ready?** Normalize tables, add organizations and roles, immutable audit records, dated sales ingestion, proper inventory snapshots, unique idempotency keys, migrations/backups, monitoring, scale limits, and browser/API/database integration tests.

**What is inventory turnover?** Cost of goods sold divided by average inventory value over a period. This version cannot honestly calculate it from only current stock, so it does not display a made-up turnover metric.
