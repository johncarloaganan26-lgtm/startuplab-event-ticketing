-- Paid Events Creation Limit per Plan
-- Allows admins to set how many paid events organizers can create per their subscription plan
-- Free events are always unlimited

-- Add max_priced_events column to plans table
ALTER TABLE public.plans
ADD COLUMN
IF
  NOT EXISTS "maxPricedEvents" integer NOT NULL DEFAULT 0;

-- Add index for performance
CREATE INDEX
IF
  NOT EXISTS idx_plans_max_priced_events
  ON public.plans ("maxPricedEvents");

-- Update default plans with example limits (can be changed by admin)
UPDATE public.plans
SET "maxPricedEvents" = 5
WHERE slug = 'starter';

UPDATE public.plans
SET "maxPricedEvents" = 25
WHERE slug = 'professional';

UPDATE public.plans
SET "maxPricedEvents" = 999
WHERE slug = 'enterprise';
