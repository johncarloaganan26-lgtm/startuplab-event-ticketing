# StartupLab Business Ticketing System
## Dashboard Flow Analysis of Existing Pages (Boss Version)

**Date:** March 5, 2026

### Executive Snapshot
The platform is now a full event operations system with three working dashboards: Public/Attendee, Organizer, and Admin/Staff.  
The page design is aligned to the business funnel: discover events, convert registrations, operate check-in, and manage governance.  
Email infrastructure is already integrated (settings, testing, transactional sends), but release readiness now depends on consolidation and final QA.

---

### 1) Dashboard and Page Flow by Role

### A. Public and Attendee Flow
**Flow:** `All Events / Browse Events` -> `Category Events` -> `Event Details` -> `Registration Form` -> `Payment Status` -> `Ticket View`

**Why this design exists**
1. `All Events / Browse Events`: top-of-funnel discovery with search, category, and location controls.
2. `Category Events`: helps users find relevant events faster and improves conversion quality.
3. `Event Details`: decision page with ticket options, organizer profile, likes/follows, and registration window status.
4. `Registration Form`: captures registrant identity and creates order records before payment.
5. `Payment Status`: trust page that confirms result, handles pending/failed/expired states, and routes to ticket access.
6. `Ticket View`: final proof-of-attendance page with QR and attendee details (or online join link for virtual events).

**Retention/engagement layer**
1. `Liked`: keeps events users marked for future action.
2. `Followings`: tracks organizations users follow and their latest events.
3. Business reason: shifts from one-time purchase behavior to repeat engagement.

**Trust and legal layer**
1. `About Us`, `Contact Us`, `Privacy Policy`, `Terms of Service`, `FAQ`, `Refund Policy`
2. Business reason: reduces buyer friction and supports policy compliance.

---

### B. Organizer Dashboard Flow
**Flow:** `Home` -> `My Events` -> `Attendees` -> `Check-In` -> `Settings`

**Why this design exists**
1. `Home`: organizer launchpad (quick-create event, quick links to dashboard and event management).
2. `My Events`: full event lifecycle panel (create/edit events, ticket inventory, attendee quick view, list/calendar mode).
3. `Attendees`: searchable registration directory with status and manual check-in actions.
4. `Check-In`: field operations screen (QR scan + manual code fallback).
5. `Settings` with 3 tabs:
   - `Organizer Profile`: brand/profile data used across event pages.
   - `Email Settings`: organizer SMTP setup + test email.
   - `Account`: identity/profile controls.
6. Business reason: supports end-to-end organizer ownership from setup to event-day execution.

---

### C. Admin/Staff Dashboard Flow
**Flow:** `Dashboard Overview` -> `Events` -> `Attendee List` -> `Check-In` -> `Settings`

**Why this design exists**
1. `Dashboard Overview`: KPI visibility (registrations, revenue, attendance, payment success) + transactions/orders/audit logs.
2. `Events`: centralized control for event operations and ticket inventory.
3. `Attendee List`: operational transparency for registrations and payment status.
4. `Check-In`: execution page for gate operations and validation.
5. `Settings` with 3 tabs:
   - `Team`: invite and maintain team members.
   - `Access Control`: granular staff permissions (view/edit events, manual check-in).
   - `Email Configuration`: SMTP setup/testing for system-wide communications.
6. Business reason: separates governance from execution while preserving day-to-day operational control.

---

### 2) Email and Notification Flow (What Exists and Why)

### A. Email Configuration Pages
1. Organizer side: `User Settings -> Email Settings`
2. Admin side: `Settings -> Email Configuration`
3. Both support:
   - provider and SMTP credentials
   - sender identity (`from address`, `from name`)
   - direct `Send Test Email`
4. Business reason: self-service delivery reliability without developer intervention.

### B. Email Trigger Flows in Current System
1. **Team invites**: invite flow generates invite link and sends through external webhook automation.
2. **Follow confirmation**: attendee receives follow confirmation email after following an organizer.
3. **Organizer alerts**: organizer can receive notifications for new followers and new order activity.
4. **Ticket/order communications**:
   - free orders: ticket notifications are dispatched after issuance
   - paid orders: ticket notifications are dispatched after payment webhook success
5. **Password reset**: account flow supports reset email through authentication provider.

### C. Delivery Logic and Reliability Design
1. SMTP resolution follows business hierarchy:
   - organizer-specific SMTP first
   - admin SMTP fallback for platform continuity
2. Notification architecture supports:
   - in-app notifications feed
   - email notifications
   - per-user notification settings table for routing/enablement
3. Business reason: minimizes delivery failure risk while preserving organizer branding control.

---

### 3) Design Assessment (Why This Architecture Is Good for Business)
1. **Clear role separation** reduces operational confusion across attendee, organizer, staff, and admin personas.
2. **Conversion-first public flow** directly supports revenue events (discover -> register -> pay -> ticket).
3. **Operational pages are practical** (attendee list, check-in, ticket inventory) and match event-day realities.
4. **Governance pages exist** (team and access control), which is required for scaling beyond single-operator usage.
5. **Email infrastructure is integrated**, supporting both transaction trust and communication continuity.

---

### 4) Current Gaps to Watch Before Release
1. Contact form currently behaves as a validated front-end form and needs confirmed backend ticketing/CRM submission flow.
2. Notification preference storage exists, but the user-facing preference page is not yet clearly surfaced in current routing.
3. Invite `create-and-send` route should be reviewed for strict auth/role guard before production hardening.
4. Admin and organizer email settings UIs are very similar and may benefit from consolidation to reduce maintenance drift.

---

### 5) Recommended Next Actions
1. Lock flow-based QA by role:
   - attendee checkout and ticket retrieval
   - organizer event operations and check-in
   - admin team/access/email governance
2. Run end-to-end email validation:
   - SMTP save/test for organizer and admin
   - invite delivery
   - follow and order/ticket notification delivery
3. Finalize release packaging:
   - clean commit grouping by flow
   - regression checks on role permissions and payment outcomes
   - deployment checklist and rollback plan

### Final Conclusion
The existing page design is business-aligned: it now supports acquisition, conversion, operations, governance, and communication in one system.  
The product is no longer just ticketing; it is a multi-role event operations platform.  
The immediate priority is release discipline and QA completion, not major feature invention.
