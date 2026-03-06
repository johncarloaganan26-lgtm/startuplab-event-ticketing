-- Event likes (heart reaction) storage.
-- Safe to run multiple times.

do $$
begin
  if to_regclass('public."eventLikes"') is null
     and to_regclass('public.eventlikes') is not null then
    execute 'alter table public.eventlikes rename to "eventLikes"';
  end if;
end $$;

create table if not exists public."eventLikes" (
  "eventLikeId" uuid primary key default gen_random_uuid(),
  "eventId" uuid not null,
  "userId" uuid not null,
  "created_at" timestamptz not null default now(),
  constraint eventLikes_event_fkey
    foreign key ("eventId") references public.events("eventId") on delete cascade,
  constraint eventLikes_user_fkey
    foreign key ("userId") references public.users("userId") on delete cascade,
  constraint eventLikes_unique_pair unique ("eventId", "userId")
);

create index if not exists idx_event_likes_event
  on public."eventLikes" ("eventId");

create index if not exists idx_event_likes_user
  on public."eventLikes" ("userId");
