# Battery charging and health lifecycle

## State transitions

| Current state | Operation | Next state | Rules |
|---|---|---|---|
| INSTALLED | Direct swap or reservation redemption | CHARGING | The removed battery is detached from the vehicle and an IN_PROGRESS charging session is created in the same transaction. |
| CHARGING | Complete charging | FULL | Requires an active charging session (or the documented legacy fallback); closes the session, updates lastChargedAt and increments cycleCount once. |
| FULL | Start maintenance | MAINTENANCE | Only an unassigned battery in station stock can enter maintenance. |
| MAINTENANCE | Complete maintenance | FULL | Does not change cycleCount or lastChargedAt. |
| FULL or MAINTENANCE | Retire | RETIRED | Only an unassigned battery can be retired. |
| RETIRED | Any lifecycle operation | RETIRED | Terminal state; health cannot be edited and it cannot be installed or charged. |

Health percentage is updated explicitly by an authorized staff/admin action or supplied during charging completion. Low health is surfaced as a recommendation in the management UI; it does not automatically retire a battery or detach it from a vehicle.

## Charging session history

SQL Server migration `1794873600000-AddBatteryChargingSessions` creates `battery_charging_sessions`. Each session records battery, station, start operator/time, completion operator/time, status and note. The migration does not rewrite existing battery rows.

New direct swaps and reservation redemptions create the charging session in the same database transaction as the battery state changes. Charging completion also runs transactionally with pessimistic locks so two concurrent requests cannot increment the cycle count twice.

For a battery already in CHARGING before this session table was deployed, the first completion request creates a clearly labelled legacy session. Its start time uses the battery's existing `updatedAt` value where available and the completing operator is recorded as the operator who reconciled the legacy record. This is a reconciliation fallback, not proof of who originally started charging.

## API

- `PATCH /batteries/:id/complete-charging` — optional `healthPercent` and `note`; preserves the original battery response fields and adds `chargingSession`.
- `GET /batteries/charging/history?stationId=&batteryId=` — station-scoped history.
- `PATCH /batteries/:id/health` — update health percentage and optional note.
- `PATCH /batteries/:id/maintenance` — move an eligible FULL battery to maintenance.
- `PATCH /batteries/:id/maintenance/complete` — return a maintained battery to FULL.
- `PATCH /batteries/:id/retire` — retire an eligible stock/maintenance battery.

STAFF requests are restricted to the assigned station in the service layer; ADMIN may query across stations or select a station. Important operations write audit events.

## Cycle-count rule

A swap only starts charging; it does not increment `cycleCount`. A successful completion of a charging session increments it once and updates `lastChargedAt`. Maintenance and health assessment do not increment charging cycles.
