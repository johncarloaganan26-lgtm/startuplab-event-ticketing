-- Platform Plans and Feature Matrix
-- Admin-owned subscription catalog for organizer SaaS billing.

create table if not exists public.plans (
  "planId" uuid not null default extensions.gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz null default now(),
  name varchar not null,
  slug varchar null,
  description text null,
  "monthlyPrice" numeric(12,2) not null default 0,
  "yearlyPrice" numeric(12,2) not null default 0,
  "priceAmount" numeric(12,2) not null default 0,
  currency varchar not null default 'PHP',
  "billingInterval" varchar not null default 'monthly',
  "trialDays" integer not null default 0,
  "isDefault" boolean not null default false,
  "isRecommended" boolean not null default false,
  "isActive" boolean not null default true,
  "features" jsonb not null default '{}',
  "limits" jsonb not null default '{}',
  "createdBy" uuid null,
  constraint plans_pkey primary key ("planId"),
  constraint plans_slug_key unique (slug),
  constraint plans_createdBy_fkey foreign key ("createdBy")
    references public.users ("userId") on delete set null
);

create table if not exists public."planFeatures" (
  "planFeatureId" uuid not null default extensions.gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz null default now(),
  "planId" uuid not null,
  key varchar not null,
  value text null,
  constraint planFeatures_pkey primary key ("planFeatureId"),
  constraint planFeatures_planId_fkey foreign key ("planId")
    references public.plans ("planId") on delete cascade,
  constraint planFeatures_planId_key_key unique ("planId", key)
);

create index if not exists idx_plans_active on public.plans ("isActive");
create index if not exists idx_plan_features_plan_id on public."planFeatures" ("planId");
-- Default System Plans
INSERT INTO public.plans (name, slug, description, "monthlyPrice", "priceAmount", currency, "isDefault", features, limits)
VALUES 
('Starter', 'starter', 'Perfect for small events', 0.00, 0.00, 'PHP', true, 
  '{"enable_custom_branding": false}', 
  '{"max_events": 1, "max_tickets_per_event": 3, "max_attendees_per_event": 50}'
)
ON CONFLICT (slug) DO UPDATE SET
  features = EXCLUDED.features,
  limits = EXCLUDED.limits;

INSERT INTO public.plans (name, slug, description, "monthlyPrice", "priceAmount", currency, "isRecommended", features, limits)
VALUES 
('Professional', 'professional', 'For growing organizers', 499.00, 499.00, 'PHP', true, 
  '{"enable_custom_branding": true}', 
  '{"max_events": 5, "max_tickets_per_event": 10, "max_attendees_per_event": 500}'
)
ON CONFLICT (slug) DO UPDATE SET
  features = EXCLUDED.features,
  limits = EXCLUDED.limits;

INSERT INTO public.plans (name, slug, description, "monthlyPrice", "priceAmount", currency, features, limits)
VALUES 
('Enterprise', 'enterprise', 'Unlimited power', 1999.00, 1999.00, 'PHP', 
  '{"enable_custom_branding": true}', 
  '{"max_events": 99, "max_tickets_per_event": 100, "max_attendees_per_event": 10000}'
)
ON CONFLICT (slug) DO UPDATE SET
  features = EXCLUDED.features,
  limits = EXCLUDED.limits;
