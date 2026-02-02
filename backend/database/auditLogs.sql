create table public."auditLogs" (
  "auditLogId" uuid not null default extensions.uuid_generate_v4 (),
  "createdAt" timestamp with time zone not null default now(),
  "actorUserId" uuid null,
  "actionType" character varying(32) not null,
  "orderId" uuid null,
  "ticketId" uuid null,
  "paymentTransactionId" uuid null,
  "webhookEventsId" uuid null,
  "details" jsonb null,
  "ipAddress" character varying(64) null,
  "userAgent" text null,
  constraint "auditLogs_pkey" primary key ("auditLogId"),
  constraint "auditLogs_orderId_fkey" foreign key ("orderId") references "orders" ("orderId") on delete set null,
  constraint "auditLogs_paymentTransactionId_fkey" foreign key ("paymentTransactionId") references "paymentTransactions" ("paymentTransactionId") on delete set null,
  constraint "auditLogs_ticketId_fkey" foreign key ("ticketId") references "tickets" ("ticketId") on delete set null,
  constraint "auditLogs_webhookEventsId_fkey" foreign key ("webhookEventsId") references "webhookEvents" ("webhookEventsId") on delete set null
) tablespace pg_default;
