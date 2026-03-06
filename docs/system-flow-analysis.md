# System Flow Analysis (Schema Excluded)

## 1. Executive Summary
Current product flow is correct:
- Buyer: discover -> checkout -> ticket -> attend.
- Seller (Organizer): draft -> configure -> publish -> manage -> reconcile.
- Admin: monitor -> intervene -> audit.

Main risk is not missing features. Main risk is inconsistent controls:
- Authorization/scope is not uniformly enforced.
- State transitions are not explicitly constrained.
- Idempotency and replay safety need strict contracts.
- Operational monitoring/SLOs are not defined.

---

## 2. Non-Negotiable Control Points

### 2.1 Inventory Reservation
- Hold inventory for `10-15 min` during checkout.
- Create reservation record before payment intent is created.
- Release rule:
  - Release automatically on reservation expiry.
  - Release immediately on payment failure/cancel/timeout.
  - Convert reservation -> sold atomically on successful capture.
- Prevent oversell with atomic decrement and bounded retries.

### 2.2 Idempotency
- Required for:
  - Payment capture
  - Refund create
  - Webhook processing
  - Check-in
- Idempotency key format:
  - `client_request_id` for API-initiated actions
  - `provider_event_id` for webhook actions
- Same key + same payload => same response.
- Same key + different payload => `409 conflict`.

### 2.3 State Transition Enforcement
- All write endpoints must validate:
  - Current state
  - Allowed transition
  - Actor permission/scope
- Reject illegal transitions with `409` (or `403` when permission-related).

### 2.4 Scope Enforcement
- Every protected query/action must resolve one of:
  - `self` (buyer own data)
  - `org` (organizer/org data)
  - `global` (admin)
- Deny by default if scope cannot be resolved.

### 2.5 Audit Logging
- Log every sensitive action:
  - Event publish/unpublish/cancel
  - Permission changes
  - Refund approve/execute
  - Payout hold/release
  - Manual check-in override
  - Fraud/risk decision
- Log fields:
  - actor, role, target, action, before_state, after_state, reason, request_id, timestamp

---

## 3. Permission Model (Concrete Keys)

### 3.1 Global Admin
- `admin.audit.view`
- `admin.risk.review`
- `admin.refund.approve`
- `admin.payout.hold`
- `admin.payout.release`
- `admin.user.permission.write`
- `admin.event.moderate`

### 3.2 Organizer
- `event.create`
- `event.read.org`
- `event.update.org`
- `event.publish.org`
- `event.close.org`
- `ticket_type.manage.org`
- `order.read.org`
- `attendee.read.org`
- `checkin.write.org`
- `refund.request.org`

### 3.3 Staff (Configurable Subset)
- `event.read.org`
- `event.update.org` (optional)
- `attendee.read.org`
- `checkin.write.org` (optional)

### 3.4 Buyer
- `event.read.public`
- `order.create.self`
- `order.read.self`
- `ticket.read.self`
- `refund.request.self`

---

## 4. State Machines (Legal Transitions)

## 4.1 Event
- `DRAFT -> PUBLISHED`
- `PUBLISHED -> CLOSED`
- `PUBLISHED -> CANCELLED`
- `DRAFT -> CANCELLED`
- Terminal: `CLOSED`, `CANCELLED`

Rules:
- Only organizer/admin can publish/close/cancel.
- Cannot edit ticket inventory after event is `CLOSED` (admin override only, audited).

## 4.2 Order
- `DRAFT -> PENDING_PAYMENT`
- `PENDING_PAYMENT -> PAID`
- `PENDING_PAYMENT -> FAILED`
- `PENDING_PAYMENT -> EXPIRED`
- `PAID -> REFUND_PENDING`
- `REFUND_PENDING -> REFUNDED`
- `PAID -> REFUND_REJECTED`

Rules:
- No check-in unless order is effectively paid (`PAID` or approved free flow).

## 4.3 Payment
- `INITIATED -> PENDING`
- `PENDING -> SUCCEEDED`
- `PENDING -> FAILED`
- `SUCCEEDED -> REFUNDED` (full) / `PARTIALLY_REFUNDED`

Rules:
- Webhook and API status updates must be idempotent.
- Duplicate provider events must not change final state twice.

## 4.4 Ticket / Check-in
- `ISSUED -> USED`
- `ISSUED -> VOID`
- Terminal: `USED`, `VOID`

Rules:
- Check-in is idempotent:
  - First valid check-in = success.
  - Subsequent attempts = "already checked-in" response, no duplicate mutation.

---

## 5. Fraud/Risk Operations (Thresholds + Playbooks)

## 5.1 Trigger Thresholds
- High velocity purchases:
  - `>= 5 attempts / 5 min / account` OR `>= 10 / 10 min / IP`
- Excessive payment failures:
  - `>= 3 failures / 15 min / account`
- Refund anomaly:
  - Refund ratio `> 20%` for organizer in rolling `7 days`
- Check-in anomaly:
  - Duplicate scan attempts `>= 3` per ticket in `10 min`

## 5.2 Response Playbooks
- Auto actions:
  - Temporary checkout cooldown
  - Step-up challenge (OTP/2FA)
  - Mark transaction `risk_review_required`
- Manual actions:
  - Admin review queue triage in `<= 30 min`
  - Hold payout pending verification
  - Add case note and resolution reason (mandatory)

---

## 6. SLOs, Metrics, Alerts

## 6.1 SLO Targets
- API availability: `99.9%`
- Checkout success (non-user-error): `>= 98%`
- Webhook processing success: `>= 99.5%`
- Check-in p95 latency: `<= 500ms`
- Critical incident acknowledge: `<= 5 min`

## 6.2 Core Metrics
- Reservation holds active/expired
- Oversell prevention retries
- Payment success/failure by provider
- Webhook lag and retry count
- Refund queue size and approval time
- Unauthorized access attempts by endpoint

## 6.3 Alerts
- Webhook failure rate `> 2%` in 5 min
- Check-in error rate `> 1%` in 5 min
- Reservation cleanup lag `> 2 min`
- 5xx error spike above baseline
- Sudden permission-denied spike (possible auth regression)

---

## 7. Execution Plan (React + Express + Supabase)

## Phase 1: Contracts First (2-3 days)
Output:
- Endpoint contract list
- Permission key map
- State transition matrix per domain object
- Error code policy (`403/409/422`)

## Phase 2: RBAC + Scope Foundation (4-6 days)
Output:
- Deny-by-default auth middleware
- Service-level authorization checks
- Scope-resolved query helpers (`self`, `org`, `global`)

## Phase 3: Seller Event Setup Flow (5-7 days)
Output:
- Draft/edit/publish lifecycle
- Ticket class and sales-window validation
- Publish readiness checks

## Phase 4: Checkout + Payment Reliability (7-10 days)
Output:
- Reservation hold/release system
- Idempotent payment APIs
- Replay-safe webhook handler

## Phase 5: Attendee Operations (4-5 days)
Output:
- Issuance pipeline + QR token lifecycle
- Attendee list filters + exports
- Idempotent check-in scanner/manual

## Phase 6: Admin Governance Console (6-8 days)
Output:
- Moderation queue
- Refund/payout controls with approvals
- Complete audit timeline per action

## Phase 7: Observability + Security Hardening (3-4 days)
Output:
- Dashboards + alert rules
- Rate limits + bot mitigation
- PII access logs + step-up auth

## Phase 8: QA + Launch Gate (5-7 days)
Output:
- Test matrix pass
- UAT sign-off
- Go-live checklist + rollback plan

---

## 8. Sprint Board (Exact Tickets + Acceptance Criteria)

## Sprint A: Contracts and Authorization Backbone

### Backend
- Ticket: `AUTH-001` Define permission constants and scope resolver.
  - Acceptance:
    - All protected handlers import shared permission keys.
    - Resolver returns `self|org|global` or denies.
- Ticket: `AUTH-002` Build transition guard utility.
  - Acceptance:
    - Illegal transitions return `409` with reason.

### Frontend
- Ticket: `FE-001` Route guard by role + session revalidation.
  - Acceptance:
    - Protected pages redirect unauthenticated users to login.
    - Cross-role route access redirects to role home.

### Security/QA
- Ticket: `QA-001` Authorization negative tests.
  - Acceptance:
    - 100% of protected endpoints tested for unauthorized access.

## Sprint B: Organizer Event Lifecycle

### Backend
- Ticket: `EV-001` Publish readiness validation.
  - Acceptance:
    - Cannot publish without required event/ticket config.
- Ticket: `EV-002` Enforce event state transitions.
  - Acceptance:
    - Only legal transitions accepted.

### Frontend
- Ticket: `FE-002` Event state-aware UI actions.
  - Acceptance:
    - Disallowed actions hidden/disabled by state + permission.

### QA
- Ticket: `QA-002` Event lifecycle scenario tests.
  - Acceptance:
    - Draft->Publish->Close happy path and invalid path cases pass.

## Sprint C: Checkout, Holds, and Payments

### Backend
- Ticket: `PAY-001` Reservation hold service + expiration worker.
  - Acceptance:
    - Hold created before payment.
    - Expired holds release inventory automatically.
- Ticket: `PAY-002` Idempotent capture/refund API.
  - Acceptance:
    - Repeat requests with same key are replay-safe.
- Ticket: `PAY-003` Webhook verifier + replay protection.
  - Acceptance:
    - Duplicate webhook event does not duplicate side effects.

### Frontend
- Ticket: `FE-003` Checkout retry UX with stable request ID.
  - Acceptance:
    - Retry does not create duplicate paid orders.

### QA
- Ticket: `QA-003` Race-condition and duplicate webhook tests.
  - Acceptance:
    - No oversell in concurrent checkout simulation.

## Sprint D: Attendee and Check-in Operations

### Backend
- Ticket: `AT-001` Check-in idempotency guard.
  - Acceptance:
    - Second scan returns already-used result without mutation.
- Ticket: `AT-002` Attendee view scope enforcement.
  - Acceptance:
    - Organizer cannot query attendees outside org scope.

### Frontend
- Ticket: `FE-004` Real-time check-in status updates.
  - Acceptance:
    - UI reflects used ticket state instantly after successful scan.

### QA
- Ticket: `QA-004` Field check-in tests (scan/manual/offline fallback).
  - Acceptance:
    - Duplicate and invalid tickets handled predictably.

## Sprint E: Admin Governance + Ops Hardening

### Backend
- Ticket: `ADM-001` Refund approval workflow and payout hold/release.
  - Acceptance:
    - High-risk actions require elevated permission and reason code.
- Ticket: `OBS-001` SLO metrics + alert event emitters.
  - Acceptance:
    - Metrics emitted for checkout, webhook, check-in, auth failures.
- Ticket: `AUD-001` Expand audit coverage.
  - Acceptance:
    - All sensitive actions produce immutable audit events.

### Frontend
- Ticket: `FE-005` Admin risk queue + action timeline.
  - Acceptance:
    - Admin can inspect case, decide action, and see full audit history.

### Security/QA
- Ticket: `SEC-001` Rate limiting and step-up auth for sensitive actions.
  - Acceptance:
    - Sensitive paths blocked without step-up confirmation.
- Ticket: `QA-005` Pre-launch checklist execution.
  - Acceptance:
    - All critical test suites green, rollback procedure validated.

---

## 9. Definition of Done (Release Gate)
- All protected endpoints are deny-by-default and role/scope tested.
- State transitions enforced by shared guard utilities.
- Payment/refund/webhook/check-in are idempotent.
- Audit trail exists for every sensitive action.
- SLO dashboards and alerts are active and verified.
- UAT and launch checklist signed by product, engineering, QA.
