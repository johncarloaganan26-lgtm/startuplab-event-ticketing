# Eventbrite‑Like System Development Guide (Flow‑Focused)

*Version: v1.1 (Role + Permission Expanded) – Updated 3 Mar 2026*

---

## 1️⃣ Executive Summary

- **Goal** – Enable organizers to create, publish, and sell tickets with a frictionless *quick‑start* experience while giving buyers a smooth checkout and admins robust governance.
- **Business impact** – Faster time‑to‑market for events, higher conversion, reduced fraud/dispute cost, and a scalable marketplace flywheel.
- **Key principle** – Replicate the *Eventbrite* “create → add tickets → configure order → publish → promote → manage” flow, but built on our existing micro‑service stack.

---

## 2️⃣ Core User Personas & Capabilities

| Persona | Primary Goals | Core UI Modules | Typical Actions |
|---|---|---|---|
| **Buyer (Attendee)** | Discover, purchase, and attend events | Public event catalog, checkout, My Tickets | Search, select tickets, fill order form, pay, view QR, request refunds |
| **Seller (Organizer)** | Create events, sell tickets, manage attendees, get paid | Organizer console (dashboard, event editor, orders, check‑in, reports) | Draft/publish events, configure tickets, run promotions, process refunds, export attendee data |
| **Admin (Platform)** | Protect platform, enforce policies, monitor health | Admin console (user mgmt, moderation, risk, audit) | Review flagged events, hold payouts, resolve disputes, toggle feature flags |

---

## 3️⃣ Information Architecture (Pages & Navigation)

### 3.1 Buyer‑Facing
- **Home / Discovery** – featured events, search bar, filters.
- **Event Detail** – description, schedule, ticket list, organizer profile.
- **Checkout Flow** – ticket selection → order form → payment → confirmation.
- **My Tickets** – list of owned tickets, QR codes, download receipts.
- **Account Settings** – profile, security (2FA), support.

### 3.2 Seller‑Facing (Organizer Console)
- **Dashboard** – sales summary, upcoming events.
- **Events List** – Draft / Published / Completed tabs.
- **Event Editor** – tabbed UI: Basics → Details → Schedule → Tickets → Order Form → Settings → Publish.
- **Orders & Attendees** – order list, export CSV, refund / transfer actions.
- **Marketing** – promo‑code creation, tracking links, email campaigns.
- **Check‑In** – web view + mobile pairing, QR scan.
- **Reports** – sales by ticket class, conversion funnel, attendance rate.
- **Finance** – payout accounts, schedule, fee breakdown, tax reports.
- **Team & Roles** – organization‑level RBAC management.

### 3.3 Admin‑Facing (Platform Console)
- **Overview Dashboard** – KPIs, incident alerts.
- **User Management** – buyers & organizers, verification (KYB).
- **Moderation Queue** – flagged events, policy overrides.
- **Risk & Payments** – chargeback monitoring, payout holds.
- **Audit Logs** – searchable action trail.
- **Feature Flags** – enable/disable modules per segment.
- **Support Tools** – impersonation (restricted), manual ticket re‑issue.

---

## 4️⃣ Permissions Model (RBAC + Scoping) – *Implementation Overview*

1. **Roles** are defined per *scope* (self, organization, global).  
2. **Permission checks** happen at API‑gateway and service‑layer:
   ```
   hasPermission(userId, permissionKey, scope)
   ```
3. **Scope enforcement** – row‑level security filters automatically restrict queries:
   - Buyer → `WHERE orders.user_id = current_user`
   - Seller → `WHERE events.org_id IN user_orgs`
   - Admin → unrestricted (but action‑level gating via admin tier).
4. **Audit** – every privileged action (payout change, refund, role change) writes a log entry with actor, role, target, before/after JSON, IP, UA.

> **Tip:** Leverage Supabase RLS policies or PostgreSQL row‑level security to enforce scopes directly in the DB, reducing duplicated checks in services.

---

## 5️⃣ Core Feature Flows (Step‑by‑step)

### 5.1 Buyer Flow – Ticket Purchase
1. **Discover** – browse or search events (public API, cached results).
2. **Select** – choose ticket class & quantity; UI shows real‑time availability.
3. **Reserve** – backend creates a *reservation* (soft‑lock) with a TTL (10‑15 min).
4. **Order Form** – collect buyer & attendee info; optional custom questions.
5. **Payment** – call payment gateway (e.g., Stripe) with idempotency key; handle 3‑DS if needed.
6. **Confirm** – on success, finalize reservation, generate QR tokens, send email/SMS.
7. **Post‑Purchase** – display order summary, allow download of receipt, enable refunds per policy.

**Failure handling** – inventory change → show updated stock; payment failure → release reservation, prompt retry.

---

### 5.2 Seller Flow – Event Lifecycle
1. **Create Draft** – organizer fills basic event info; saved as `status = draft`.
2. **Configure Tickets** – define classes, pricing, inventory, sales window.
3. **Order Form Setup** – add custom fields, set required/optional.
4. **Preview** – UI shows public view; organizer can test checkout in sandbox mode.
5. **Publish** – status → `published`; event becomes searchable; optional moderation queue.
6. **Monitor** – real‑time dashboard of sales, conversion, traffic source.
7. **Check‑In** – on event day, staff scan QR codes; backend records `checked_in_at`.
8. **Post‑Event** – generate payout batch, export attendee list, run analytics reports.

---

### 5.3 Admin Flow – Governance Loop
1. **Dashboard Review** – monitor risk metrics, webhook health, incident alerts.
2. **Moderation** – investigate flagged events; actions: warn, unpublish, suspend organizer.
3. **Risk Management** – place payout holds, review chargebacks, approve/reject refunds.
4. **Audit** – every admin action logged; searchable UI for compliance.
5. **Feature Management** – toggle flags for beta features, roll‑out per region.

---

## 6️⃣ Integrations & Extensibility

| Integration | Purpose | Typical Touch‑Points |
|---|---|---|
| **Payment Gateway** (Stripe, PayPal) | Secure card processing, tokenization | Checkout service, webhook listener for async events |
| **Email/SMS** (SendGrid, Twilio) | Order confirmations, reminders, check‑in codes | Notification service, background job queue |
| **Analytics** (Google Analytics, Mixpanel) | Funnel tracking, conversion metrics | Front‑end event hooks, server‑side event logging |
| **Webhooks** | External system notifications (CRM, marketing) | Order service emits `order.created`, `order.refunded` |
| **OAuth** (optional) | Social login for buyers/organizers | Auth service, token exchange flow |

**Design tip:** Keep each integration behind a thin adapter interface so you can swap providers without touching core business logic.

---

## 7️⃣ Non‑Functional Requirements (Key Targets)

- **Performance** – inventory check < 100 ms; checkout latency < 2 s.
- **Consistency** – transactional ticket allocation; use row‑level locks or atomic counters.
- **Security** – HTTPS everywhere, HSTS, CSP, rate‑limit auth & checkout endpoints, 2FA for admin actions.
- **Privacy** – PII scoped per role; GDPR‑compliant data retention.
- **Reliability** – idempotent webhook processing, retry queues, dead‑letter handling.
- **Observability** – structured logs, distributed tracing (OpenTelemetry), health checks, alerting on error rates > 1 %.

---

## 8️⃣ QA Scenarios – Role & Permission Focus

| Test ID | Scenario | Expected Outcome |
|---|---|---|
| **TC‑RBAC‑01** | Buyer attempts to view another buyer’s order. | `403 Forbidden` |
| **TC‑RBAC‑02** | Organizer with *Marketing* role tries to view payout details. | `403 Forbidden` (only Finance/Owner roles allowed) |
| **TC‑RBAC‑03** | Check‑in staff edits ticket price. | `403 Forbidden` (price edit limited to Event Manager/Owner) |
| **TC‑RBAC‑04** | Admin disables an event. | Event status → `unpublished`; public API returns 404; audit log entry created |
| **TC‑RBAC‑05** | Duplicate refund request for same order. | Idempotent handling; second request returns `409 Conflict` with message “Refund already processed”; audit logged |

---

## 9️⃣ Implementation Roadmap (Suggested Sprint Breakdown)

| Sprint | Focus | Deliverables |
|---|---|---|
| **1** | Foundations | Project scaffolding, CI/CD pipeline, basic auth (Supabase), DB migrations (init.sql) |
| **2** | Core Services | Event service, Ticket service, Order service with reservation logic |
| **3** | Buyer UI | Public catalog, event detail, checkout flow (React/TSX) |
| **4** | Seller Console | Dashboard, event editor, ticket management, order view |
| **5** | RBAC & Auditing | Role definitions, permission middleware, audit log service |
| **6** | Payment Integration | Stripe integration, webhook handling, idempotency keys |
| **7** | Admin Console | Moderation queue, risk dashboard, feature‑flag UI |
| **8** | Observability & Scaling | OpenTelemetry, Prometheus/Grafana dashboards, load‑test inventory checks |
| **9** | Polish & Launch | UI/UX refinements (glassmorphism, micro‑animations), SEO meta tags, final security audit |

---

## 🔚 Closing Thoughts

By aligning each module of our platform with the *quick‑start* flow outlined above, we create a cohesive experience that mirrors Eventbrite’s proven user journey while retaining full control over data, security, and extensibility. The roadmap breaks the work into manageable increments, ensuring early delivery of buyer‑facing features and progressive rollout of seller‑admin capabilities.

*Feel free to ask for deeper dive into any specific service implementation, UI component design, or CI/CD configuration.*
