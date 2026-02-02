this is your guide for prompting, make sure to follow this instruction and serve as guide before answering.

the overview of the system is the EVENT TICKETING & REGISTRATION SYSTEM file make sure to always read this before answering. 

the updated schema database is this

create table public."webhookEvents" (
  "webhookEventsId" uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  gateway jsonb null,
  "eventType" character varying null,
  "externalId" uuid not null default gen_random_uuid (),
  payload jsonb null,
  "receivedAt" timestamp without time zone null,
  "processedAt" timestamp without time zone null,
  "processingStatus" character varying null,
  constraint webhookEvents_pkey primary key ("webhookEventsId"),
  constraint webhookEvents_externalId_key unique ("externalId")
) TABLESPACE pg_default;


create table public.users (
  "userId" uuid not null default gen_random_uuid (),
  role character varying null,
  name character varying null,
  updated_at timestamp without time zone null,
  created_at timestamp with time zone not null default now(),
  email character varying null,
  "imageUrl" jsonb null,
  constraint users_pkey primary key ("userId")
) TABLESPACE pg_default;


create table public.tickets (
  "ticketId" uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  "eventId" uuid null default gen_random_uuid (),
  "ticketTypeId" uuid null default gen_random_uuid (),
  "orderId" uuid null default gen_random_uuid (),
  "ticketCode" uuid null default gen_random_uuid (),
  "qrPayload" character varying null,
  status character varying null,
  "issuedAt" timestamp without time zone null,
  "usedAt" timestamp without time zone null,
  "attendeeId" uuid null default gen_random_uuid (),
  constraint tickets_pkey primary key ("ticketId"),
  constraint tickets_ticketCode_key unique ("ticketCode"),
  constraint tickets_attendeeId_fkey foreign KEY ("attendeeId") references attendees ("attendeeId") on delete CASCADE,
  constraint tickets_eventId_fkey foreign KEY ("eventId") references events ("eventId") on delete CASCADE,
  constraint tickets_orderId_fkey foreign KEY ("orderId") references orders ("orderId") on delete CASCADE,
  constraint tickets_ticketTypeId_fkey foreign KEY ("ticketTypeId") references "ticketTypes" ("ticketTypeId") on delete CASCADE
) TABLESPACE pg_default;


create table public."ticketTypes" (
  "ticketTypeId" uuid not null default gen_random_uuid (),
  name character varying null,
  description character varying null,
  "priceAmount" real null,
  currency character varying null,
  "quantityTotal" integer null,
  "quantitySold" integer null default 0,
  "salesStartAt" timestamp without time zone null,
  "salesEndAt" timestamp without time zone null,
  status boolean null,
  updated_at timestamp without time zone null,
  created_at timestamp with time zone not null default now(),
  "createdBy" uuid null default gen_random_uuid (),
  "eventId" uuid null default gen_random_uuid (),
  constraint ticketTypes_pkey primary key ("ticketTypeId"),
  constraint ticketTypes_createdBy_fkey foreign KEY ("createdBy") references auth.users (id) on delete CASCADE,
  constraint ticketTypes_eventId_fkey foreign KEY ("eventId") references events ("eventId") on delete CASCADE
) TABLESPACE pg_default;




create table public."paymentTransactions" (
  "paymentTransactionId" uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  "orderId" uuid null default gen_random_uuid (),
  gateway jsonb null,
  "hitpayReferenceId" character varying null,
  amount real null,
  currency character varying null,
  status character varying null,
  "rawPayload" jsonb null,
  updated_at timestamp without time zone null,
  constraint paymentTransactions_pkey primary key ("paymentTransactionId"),
  constraint paymentTransactions_orderId_fkey foreign KEY ("orderId") references orders ("orderId") on delete CASCADE
) TABLESPACE pg_default;




create table public.orders (
  "orderId" uuid not null default gen_random_uuid (),
  status character varying null,
  "totalAmount" real null,
  currency character varying null,
  "expiresAt" timestamp without time zone null,
  updated_at timestamp without time zone null,
  created_at timestamp with time zone not null default now(),
  "buyerName" character varying null,
  "buyerEmail" character varying null,
  "buyerPhone" character varying null,
  metadata json null,
  "eventId" uuid null default gen_random_uuid (),
  constraint orders_pkey primary key ("orderId")
) TABLESPACE pg_default;




create table public."orderItems" (
  "orderItemId" uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  "ticketTypeId" uuid null default gen_random_uuid (),
  quantity integer null,
  price real null,
  "lineTotal" real null,
  "orderId" uuid null default gen_random_uuid (),
  constraint orderItems_pkey primary key ("orderItemId"),
  constraint orderItems_orderId_fkey foreign KEY ("orderId") references orders ("orderId") on delete CASCADE,
  constraint orderItems_ticketTypeId_fkey foreign KEY ("ticketTypeId") references "ticketTypes" ("ticketTypeId") on delete CASCADE
) TABLESPACE pg_default;

create table public.attendees (
  "attendeeId" uuid not null default gen_random_uuid (),
  "eventId" uuid null default gen_random_uuid (),
  name character varying null,
  email character varying null,
  "phoneNumber" character varying null,
  company character varying null,
  notes character varying null,
  consent boolean null,
  created_at timestamp without time zone null,
  "orderId" uuid null default gen_random_uuid (),
  constraint attendees_pkey primary key ("attendeeId"),
  constraint attendees_eventId_fkey foreign KEY ("eventId") references events ("eventId") on delete CASCADE,
  constraint attendees_orderId_fkey foreign KEY ("orderId") references orders ("orderId") on delete CASCADE
) TABLESPACE pg_default;

create table public.events (
  "eventId" uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  slug character varying null,
  description character varying null,
  "startAt" timestamp without time zone null,
  "endAt" timestamp without time zone null,
  timezone character varying null,
  "locationType" character varying null,
  "locationText" character varying null,
  "capacityTotal" integer null,
  "regOpenAt" date null,
  "regCloseAt" date null,
  "createdBy" uuid null default gen_random_uuid (),
  updated_at timestamp without time zone null,
  "eventName" character varying null,
  status character varying null,
  "imageUrl" jsonb null,
  constraint events_pkey primary key ("eventId"),
  constraint events_slug_key unique (slug),
  constraint events_createdBy_fkey foreign KEY ("createdBy") references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create table public."auditLogs" (
  "auditLogId" uuid not null default extensions.uuid_generate_v4 (),
  "createdAt" timestamp with time zone not null default now(),
  "actorUserId" uuid null,
  "actionType" character varying(32) not null,
  "orderId" uuid null,
  "ticketId" uuid null,
  "paymentTransactionId" uuid null,
  "webhookEventsId" uuid null,
  details jsonb null,
  "ipAddress" character varying(64) null,
  "userAgent" text null,
  constraint auditLogs_pkey primary key ("auditLogId"),
  constraint auditLogs_orderId_fkey foreign KEY ("orderId") references orders ("orderId") on delete set null,
  constraint auditLogs_paymentTransactionId_fkey foreign KEY ("paymentTransactionId") references "paymentTransactions" ("paymentTransactionId") on delete set null,
  constraint auditLogs_ticketId_fkey foreign KEY ("ticketId") references tickets ("ticketId") on delete set null,
  constraint auditLogs_webhookEventsId_fkey foreign KEY ("webhookEventsId") references "webhookEvents" ("webhookEventsId") on delete set null
) TABLESPACE pg_default;


make sure the data aligns with the database.

if you are creating, make sure you are following the event ticketing & register file and use the updated scema in this file. 