# Scope Amendments

## AMENDMENT 001: Delivery System Removal

**Status:** ACTIVE — overrides specs where applicable.

### Changes

1. **Delivery/driver system removed entirely.** No driver role, no driver tables, no driver routes, no driver portal/UI.
2. **`gts_04_delivery.md` is DEPRECATED.** Kept for reference but must not be implemented.
3. **Revised order state machine** (supersedes backend spec §6.3):
   - `pending_payment` → `paid` → `processing` → `ready_for_pickup` → `completed`
   - `cancelled` is reachable from `pending_payment`, `paid`, `processing`
   - No backward moves, no skipped steps.
4. **11-sprint plan** replaces the original sprint plan.

### Schema Deltas

- No `drivers` table
- No `driver_id` columns
- No delivery-related enums or status values
