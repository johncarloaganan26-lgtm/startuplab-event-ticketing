-- Per-user notification routing preferences.
-- Safe to run multiple times.

create table if not exists public.user_notification_settings (
  user_id uuid primary key,
  notification_email text null,
  email_notifications_enabled boolean not null default true,
  in_app_notifications_enabled boolean not null default true,
  owner_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_notification_settings_updated_at
  on public.user_notification_settings (updated_at desc);
