# Booking concurrency and expiry regression checklist

This branch needs a running MySQL test database and backend to validate transaction behavior before merge.

## Preconditions
- Seed an active vehicle and two different customer accounts, plus staff assigned to its station.
- Use an isolated test database. Never run destructive checks against production.
- Set BOOKING_HOLD_MINUTES to a short test value.

## Scenarios
1. Customer A creates a booking: returns PENDING and creates a history row.
2. Customer B requests the same vehicle for overlapping dates while A's hold is valid: rejected.
3. After A's hold expires, B books the same interval: succeeds; A becomes EXPIRED and exactly one expiry history row is created.
4. Staff confirms an already expired PENDING booking: receives 400; status stays EXPIRED after the error, with expiry history committed.
5. Two simultaneous confirm requests for one valid PENDING booking: exactly one succeeds; one transition history row to CONFIRMED.
6. Simultaneous cancel and confirm requests: at most one transition from PENDING occurs; resulting status matches history.
7. Customer cannot cancel another customer's booking; staff cannot manage bookings at another station.
8. Cancel a CONFIRMED booking: status and history both change to CANCELLED, including cancellation reason.
9. Verify a vehicle is never double booked under simultaneous POST /bookings requests.
10. Simulate failure when writing history: transaction must roll back the status change.

## Remaining work
- Run build, lint, and integration/concurrency tests in CI.
- Add proactive scheduled expiry job (the current cleanup is on-demand during booking).
- Review all booking writers to ensure they follow the same vehicle-lock ordering.
- Move schema management to migrations; do not use TypeORM synchronize in production.

## Scheduled expiry sweep (new)
- By default, the NestJS backend checks up to 100 expired PENDING holds every 60 seconds.
- `BOOKING_EXPIRY_ENABLED=false` disables the sweep; `BOOKING_EXPIRY_INTERVAL_MS=60000` controls the interval (minimum 1000 ms).
- The sweep is local to each backend process. Concurrent workers re-check the booking under database locks; only one worker should write the EXPIRED transition/history.
- Test with an expired hold and **no incoming booking requests**: verify status and a single history row after a sweep.
- Test concurrent sweeps and staff confirmation against the same expired hold, as well as server shutdown/restart.
- This is not yet a durable external job queue. For large deployments, replace or augment it with a dedicated worker and observability.
