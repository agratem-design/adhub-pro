# Contract edit database deployment — 2026-09-09

Project: `atqjaiebixuzomrfwilu`.

Applied through the authenticated Supabase SQL Editor in two committed transactions:

- The four new columns, revision trigger, and `save_contract_edit_atomic` from `20260908010000_contract_edit_atomic.sql`.
- The four pause, resume, edit and replacement functions from that migration.

The existing installation trigger function was read first and matched the migration's baseline. Its pending-item deletion clause was patched in place with the migration's task-removal setting and completed-parent protection, preserving the rest of its definition. PostgREST schema reload was requested after each transaction. No other migrations were applied. The CLI migration history was not modified.

Verification: all five functions exist, use SECURITY INVOKER, and permit authenticated execution. All four columns exist, and the installation guard is present.

Contract 1209 initially had total 406000 and nine active billboard IDs. A subsequent application save was recorded at 2026-09-09 08:58:05 UTC with previousRevision 0, new total 400000 and the same IDs; final revision was 1. Deployment queries did not invoke contract save or change its financial fields.

The existing pause for billboard 375 remains `paused`, with consumed amount 6000 and refund 12000. It has no historical `price_snapshot`; do not fabricate one. Resume requires completion of that historical snapshot from reliable records.
