-- Migration for Organizer Team management
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "employerId" uuid NULL REFERENCES public.users("userId") ON DELETE CASCADE;
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS "invitedBy" uuid NULL REFERENCES public.users("userId") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_users_employer_id ON public.users ("employerId");
CREATE INDEX IF NOT EXISTS idx_invites_invited_by ON public.invites ("invitedBy");
