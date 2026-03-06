-- Organizer profiles + event linkage
-- Run in Supabase SQL editor before deploying organizer feature.

create table if not exists public.organizers (
  "organizerId" uuid not null default extensions.uuid_generate_v4(),
  "ownerUserId" uuid not null,
  "organizerName" varchar(140) not null,
  "websiteUrl" text null,
  "bio" text null,
  "eventPageDescription" varchar(280) null,
  "facebookId" varchar(120) null,
  "twitterHandle" varchar(80) null,
  "emailOptIn" boolean not null default false,
  "profileImageUrl" text null,
  "followersCount" integer not null default 0,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  constraint organizers_pkey primary key ("organizerId"),
  constraint organizers_ownerUserId_key unique ("ownerUserId"),
  constraint organizers_followersCount_check check ("followersCount" >= 0)
) tablespace pg_default;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizers_ownerUserId_fkey'
  ) then
    alter table public.organizers
      add constraint organizers_ownerUserId_fkey
      foreign key ("ownerUserId") references public.users("userId") on delete cascade;
  end if;
end $$;

alter table public.events
  add column if not exists "organizerId" uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_organizerId_fkey'
  ) then
    alter table public.events
      add constraint events_organizerId_fkey
      foreign key ("organizerId") references public.organizers("organizerId") on delete set null;
  end if;
end $$;

create index if not exists idx_organizers_owner_user_id on public.organizers ("ownerUserId");
create index if not exists idx_events_organizer_id on public.events ("organizerId");

-- Compatibility: if an old lowercase table exists, rename it to the expected camelCase table.
do $$
begin
  if to_regclass('public."organizerFollowers"') is null
     and to_regclass('public.organizerfollowers') is not null then
    execute 'alter table public.organizerfollowers rename to "organizerFollowers"';
  end if;
end $$;

create table if not exists public."organizerFollowers" (
  "organizerFollowId" uuid not null default extensions.uuid_generate_v4(),
  "organizerId" uuid not null,
  "followerUserId" uuid not null,
  "created_at" timestamp with time zone not null default now(),
  constraint organizerFollowers_pkey primary key ("organizerFollowId"),
  constraint organizerFollowers_organizerId_fkey
    foreign key ("organizerId") references public.organizers("organizerId") on delete cascade,
  constraint organizerFollowers_followerUserId_fkey
    foreign key ("followerUserId") references public.users("userId") on delete cascade,
  constraint organizerFollowers_unique_pair unique ("organizerId", "followerUserId")
) tablespace pg_default;

-- Compatibility: normalize old lowercase column names if they exist.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizerFollowers'
      and column_name = 'organizerfollowid'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizerFollowers'
      and column_name = 'organizerFollowId'
  ) then
    execute 'alter table public."organizerFollowers" rename column organizerfollowid to "organizerFollowId"';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizerFollowers'
      and column_name = 'organizerid'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizerFollowers'
      and column_name = 'organizerId'
  ) then
    execute 'alter table public."organizerFollowers" rename column organizerid to "organizerId"';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizerFollowers'
      and column_name = 'followeruserid'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizerFollowers'
      and column_name = 'followerUserId'
  ) then
    execute 'alter table public."organizerFollowers" rename column followeruserid to "followerUserId"';
  end if;
end $$;

create index if not exists idx_organizer_followers_organizer
  on public."organizerFollowers" ("organizerId");
create index if not exists idx_organizer_followers_user
  on public."organizerFollowers" ("followerUserId");

-- Keep followersCount aligned with follow rows.
update public.organizers as o
set "followersCount" = counts.follow_count
from (
  select "organizerId", count(*)::int as follow_count
  from public."organizerFollowers"
  group by "organizerId"
) as counts
where o."organizerId" = counts."organizerId";

update public.organizers
set "followersCount" = 0
where "organizerId" not in (
  select distinct "organizerId" from public."organizerFollowers"
);

-- Backfill existing events if organizer profile for creator already exists.
update public.events as e
set "organizerId" = o."organizerId"
from public.organizers as o
where e."organizerId" is null
  and e."createdBy" = o."ownerUserId";
