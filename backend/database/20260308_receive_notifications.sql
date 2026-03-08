-- Migration: Adding canReceiveNotifications for staff granular notifications
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "canreceivenotifications" BOOLEAN DEFAULT NULL;

-- Description: This allows specific staff members of an organization to receive the same 
-- dashboard/email notifications that the Organizer (owner) receives.
