-- Organizer Subscription System
-- Stores subscription details for each organizer's plan

create table if not exists public.organizersubscriptions (
  "subscriptionId" uuid not null default extensions.uuid_generate_v4(),
  "organizerId" uuid not null,
  "planId" uuid not null,
  "billingInterval" varchar not null default 'monthly',
  "status" varchar not null default 'active',
  "priceAmount" numeric(12,2) not null default 0,
  "currency" varchar not null default 'PHP',
  "startDate" timestamptz not null default now(),
  "endDate" timestamptz null,
  "trialEndDate" timestamptz null,
  "cancelAtPeriodEnd" boolean not null default false,
  "paymentMethod" varchar null,
  "paymentReference" varchar null,
  "hitPayPaymentId" varchar null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  constraint organizersubscriptions_pkey primary key ("subscriptionId"),
  constraint organizersubscriptions_organizerId_fkey 
    foreign key ("organizerId") references public.organizers("organizerId") on delete cascade,
  constraint organizersubscriptions_planId_fkey 
    foreign key ("planId") references public.plans("planId") on delete restrict
);

-- Indexes for efficient lookups
create index if not exists idx_organizer_subscriptions_organizer 
  on public.organizersubscriptions ("organizerId");
create index if not exists idx_organizer_subscriptions_status 
  on public.organizersubscriptions ("status");
create index if not exists idx_organizer_subscriptions_plan 
  on public.organizersubscriptions ("planId");

-- Add plan-related columns to organizers table for quick access
alter table public.organizers
  add column if not exists "currentPlanId" uuid null,
  add column if not exists "subscriptionStatus" varchar null default 'free',
  add column if not exists "planExpiresAt" timestamptz null;

-- Foreign key for currentPlanId
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'organizers_currentplanid_fkey'
  ) then
    alter table public.organizers
      add constraint organizers_currentplanid_fkey
      foreign key ("currentPlanId") references public.plans("planId") on delete set null;
  end if;
end $$;
