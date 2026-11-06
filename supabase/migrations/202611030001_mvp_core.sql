create extension if not exists btree_gist with schema extensions;

create type public.business_role as enum ('owner', 'manager', 'barber', 'receptionist');
create type public.commission_type as enum ('percentage', 'fixed');
create type public.appointment_status as enum ('scheduled', 'completed', 'cancelled');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now()
);

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  title text not null default 'Barbeiro',
  phone text not null check (phone ~ '^55(11|12|13|14|15|16|17|18|19|21|22|24|27|28|31|32|33|34|35|37|38|41|42|43|44|45|46|47|48|49|51|53|54|55|61|62|63|64|65|66|67|68|69|71|73|74|75|77|79|81|82|83|84|85|86|87|88|89|91|92|93|94|95|96|97|98|99)9[0-9]{8}$'),
  email text,
  photo_url text,
  active boolean not null default true,
  commission_type public.commission_type not null default 'percentage',
  commission_value numeric(10, 2) not null default 40 check (commission_value >= 0),
  monthly_goal_cents bigint not null default 0 check (monthly_goal_cents >= 0),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  check (commission_type <> 'percentage' or commission_value <= 100)
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.business_role not null,
  staff_id uuid,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id),
  foreign key (business_id, staff_id) references public.staff_members(business_id, id),
  check ((role = 'barber') = (staff_id is not null))
);

create unique index business_members_staff_unique
  on public.business_members (business_id, staff_id)
  where staff_id is not null;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  phone text not null check (phone ~ '^55(11|12|13|14|15|16|17|18|19|21|22|24|27|28|31|32|33|34|35|37|38|41|42|43|44|45|46|47|48|49|51|53|54|55|61|62|63|64|65|66|67|68|69|71|73|74|75|77|79|81|82|83|84|85|86|87|88|89|91|92|93|94|95|96|97|98|99)9[0-9]{8}$'),
  email text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, phone)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  description text not null default '',
  price_cents bigint not null check (price_cents >= 0),
  duration_minutes integer not null check (duration_minutes between 5 and 480 and duration_minutes % 5 = 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);

create table public.service_staff (
  business_id uuid not null,
  service_id uuid not null,
  staff_id uuid not null,
  primary key (business_id, service_id, staff_id),
  foreign key (business_id, service_id) references public.services(business_id, id) on delete cascade,
  foreign key (business_id, staff_id) references public.staff_members(business_id, id) on delete cascade
);

create table public.business_hours (
  business_id uuid not null references public.businesses(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_open boolean not null default false,
  opens_at time,
  closes_at time,
  primary key (business_id, weekday),
  check (not is_open or (opens_at is not null and closes_at is not null and closes_at > opens_at))
);

create table public.staff_hours (
  business_id uuid not null,
  staff_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  is_open boolean not null default false,
  starts_at time,
  ends_at time,
  break_starts_at time,
  break_ends_at time,
  primary key (business_id, staff_id, weekday),
  foreign key (business_id, staff_id) references public.staff_members(business_id, id) on delete cascade,
  check (
    (not is_open)
    or (starts_at is not null and ends_at is not null and ends_at > starts_at
      and ((break_starts_at is null and break_ends_at is null)
        or (break_starts_at is not null and break_ends_at > break_starts_at
          and break_starts_at >= starts_at and break_ends_at <= ends_at)))
  )
);

create table public.staff_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  staff_id uuid not null,
  blocked_date date not null,
  starts_at time,
  ends_at time,
  note text not null default '',
  foreign key (business_id, staff_id) references public.staff_members(business_id, id) on delete cascade,
  check ((starts_at is null and ends_at is null) or (starts_at is not null and ends_at > starts_at))
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null,
  staff_id uuid not null,
  service_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  service_name text not null,
  staff_name text not null,
  service_amount_cents bigint not null check (service_amount_cents >= 0),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  commission_type public.commission_type not null,
  commission_value numeric(10, 2) not null check (commission_value >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, client_id) references public.clients(business_id, id),
  foreign key (business_id, staff_id) references public.staff_members(business_id, id),
  foreign key (business_id, service_id) references public.services(business_id, id),
  check (ends_at > starts_at),
  check (commission_type <> 'percentage' or commission_value <= 100)
);

alter table public.appointments
  add constraint appointments_no_staff_overlap
  exclude using gist (
    business_id with =,
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelled');

create index appointments_business_starts_idx on public.appointments (business_id, starts_at);
create index appointments_staff_starts_idx on public.appointments (business_id, staff_id, starts_at);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  appointment_id uuid not null,
  staff_id uuid not null,
  amount_cents bigint not null check (amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  earned_at timestamptz not null default now(),
  paid_at timestamptz,
  foreign key (business_id, appointment_id) references public.appointments(business_id, id),
  foreign key (business_id, staff_id) references public.staff_members(business_id, id),
  unique (business_id, appointment_id),
  check ((status = 'paid') = (paid_at is not null))
);

create table public.whatsapp_outbox (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid not null,
  event_type text not null check (event_type in ('created', 'rescheduled', 'cancelled')),
  recipient_phone text not null check (recipient_phone ~ '^55(11|12|13|14|15|16|17|18|19|21|22|24|27|28|31|32|33|34|35|37|38|41|42|43|44|45|46|47|48|49|51|53|54|55|61|62|63|64|65|66|67|68|69|71|73|74|75|77|79|81|82|83|84|85|86|87|88|89|91|92|93|94|95|96|97|98|99)9[0-9]{8}$'),
  template_parameters jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  next_attempt_at timestamptz not null default now(),
  processing_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  foreign key (business_id, appointment_id) references public.appointments(business_id, id)
);

create index whatsapp_outbox_queue_idx
  on public.whatsapp_outbox (next_attempt_at, id) where status in ('queued', 'failed');

create function public.has_business_role(p_business_id uuid, p_roles public.business_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

create function public.current_staff_id(p_business_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.staff_id
  from public.business_members m
  where m.business_id = p_business_id
    and m.user_id = (select auth.uid())
    and m.role = 'barber';
$$;

create function public.create_business(p_name text, p_timezone text default 'America/Sao_Paulo')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if length(trim(p_name)) not between 1 and 100 then
    raise exception 'business name is required' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;

  insert into public.businesses (name, timezone) values (trim(p_name), p_timezone)
  returning id into v_business_id;
  insert into public.business_members (business_id, user_id, role)
  values (v_business_id, auth.uid(), 'owner');
  return v_business_id;
end;
$$;

create function public.set_business_member(
  p_business_id uuid,
  p_user_id uuid,
  p_role public.business_role,
  p_staff_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.business_role;
  v_target_role public.business_role;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select m.role into v_actor_role
  from public.business_members m
  where m.business_id = p_business_id and m.user_id = auth.uid();
  if v_actor_role is null or v_actor_role not in ('owner', 'manager') then
    raise exception 'not permitted to manage business members' using errcode = '42501';
  end if;
  if v_actor_role = 'manager' and p_role = 'owner' then
    raise exception 'only an owner may assign the owner role' using errcode = '42501';
  end if;
  if (p_role = 'barber') <> (p_staff_id is not null) then
    raise exception 'barbers require a staff profile and other roles cannot use one' using errcode = '22023';
  end if;
  if p_staff_id is not null and not exists (
    select 1 from public.staff_members s
    where s.business_id = p_business_id and s.id = p_staff_id
  ) then
    raise exception 'staff profile belongs to a different business' using errcode = '22023';
  end if;

  select m.role into v_target_role from public.business_members m
  where m.business_id = p_business_id and m.user_id = p_user_id;
  if v_target_role = 'owner' and v_actor_role <> 'owner' then
    raise exception 'only an owner may change an owner membership' using errcode = '42501';
  end if;

  insert into public.business_members (business_id, user_id, role, staff_id)
  values (p_business_id, p_user_id, p_role, p_staff_id)
  on conflict (business_id, user_id) do update
  set role = excluded.role, staff_id = excluded.staff_id;
end;
$$;

create function public.get_available_slots(
  p_business_id uuid,
  p_staff_id uuid,
  p_service_id uuid,
  p_date date,
  p_exclude_appointment_id uuid default null
)
returns table (slot time)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_duration integer;
  v_start time;
  v_end time;
  v_break_start time;
  v_break_end time;
  v_weekday smallint;
begin
  if not public.has_business_role(p_business_id) then
    raise exception 'not a member of this business' using errcode = '42501';
  end if;
  if public.has_business_role(p_business_id, array['barber']::public.business_role[])
     and public.current_staff_id(p_business_id) <> p_staff_id then
    raise exception 'barbers can only query their own availability' using errcode = '42501';
  end if;

  select b.timezone into v_timezone from public.businesses b where b.id = p_business_id;
  select s.duration_minutes into v_duration
  from public.services s
  where s.business_id = p_business_id and s.id = p_service_id and s.active;
  if v_timezone is null or v_duration is null then return; end if;
  if p_date < (now() at time zone v_timezone)::date then return; end if;

  v_weekday := extract(dow from p_date)::smallint;
  select greatest(bh.opens_at, sh.starts_at),
         least(bh.closes_at, sh.ends_at),
         sh.break_starts_at,
         sh.break_ends_at
    into v_start, v_end, v_break_start, v_break_end
  from public.business_hours bh
  join public.staff_hours sh
    on sh.business_id = bh.business_id and sh.weekday = bh.weekday
  join public.staff_members sm
    on sm.business_id = sh.business_id and sm.id = sh.staff_id and sm.active
  where bh.business_id = p_business_id
    and bh.weekday = v_weekday and bh.is_open and sh.is_open
    and sh.staff_id = p_staff_id;
  if v_start is null or v_end is null or v_end <= v_start then return; end if;
  if exists (
    select 1 from public.service_staff ss
    where ss.business_id = p_business_id and ss.service_id = p_service_id
  ) and not exists (
    select 1 from public.service_staff ss
    where ss.business_id = p_business_id and ss.service_id = p_service_id and ss.staff_id = p_staff_id
  ) then return; end if;

  v_start := time '00:00' + make_interval(mins =>
    ceil((extract(hour from v_start) * 60 + extract(minute from v_start)) / 15.0)::integer * 15
  );
  return query
  select candidate::time
  from generate_series(
    (p_date + v_start)::timestamp,
    (p_date + v_end - make_interval(mins => v_duration))::timestamp,
    interval '15 minutes'
  ) as slots(candidate)
  where (p_date <> (now() at time zone v_timezone)::date
      or candidate > (now() at time zone v_timezone))
    and not (
      v_break_start is not null and v_break_end is not null
      and candidate::time < v_break_end
      and candidate::time + make_interval(mins => v_duration) > v_break_start
    )
    and not exists (
      select 1 from public.staff_blocks sb
      where sb.business_id = p_business_id and sb.staff_id = p_staff_id
        and sb.blocked_date = p_date
        and (
          (sb.starts_at is null and sb.ends_at is null)
          or (candidate::time < sb.ends_at
              and candidate::time + make_interval(mins => v_duration) > sb.starts_at)
        )
    )
    and not exists (
      select 1 from public.appointments a
      where a.business_id = p_business_id and a.staff_id = p_staff_id
        and a.status <> 'cancelled'
        and a.id is distinct from p_exclude_appointment_id
        and tstzrange(a.starts_at, a.ends_at, '[)')
          && tstzrange(
            (p_date + candidate::time) at time zone v_timezone,
            (p_date + candidate::time + make_interval(mins => v_duration)) at time zone v_timezone,
            '[)'
          )
    )
  order by candidate;
end;
$$;

create function public.save_appointment(
  p_business_id uuid,
  p_client_name text,
  p_client_phone text,
  p_service_id uuid,
  p_staff_id uuid,
  p_date date,
  p_time time,
  p_notes text default '',
  p_appointment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment_id uuid;
  v_client_id uuid;
  v_service public.services%rowtype;
  v_staff public.staff_members%rowtype;
  v_timezone text;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not coalesce(public.has_business_role(p_business_id, array['owner','manager','receptionist','barber']::public.business_role[]), false) then
    raise exception 'not permitted to book appointments' using errcode = '42501';
  end if;
  if public.has_business_role(p_business_id, array['barber']::public.business_role[])
     and public.current_staff_id(p_business_id) <> p_staff_id then
    raise exception 'barbers can only book their own appointments' using errcode = '42501';
  end if;
  if p_client_name is null or length(trim(p_client_name)) not between 1 and 100
     or p_client_phone is null
     or p_client_phone !~ '^55(11|12|13|14|15|16|17|18|19|21|22|24|27|28|31|32|33|34|35|37|38|41|42|43|44|45|46|47|48|49|51|53|54|55|61|62|63|64|65|66|67|68|69|71|73|74|75|77|79|81|82|83|84|85|86|87|88|89|91|92|93|94|95|96|97|98|99)9[0-9]{8}$'
     or p_date is null
     or p_time is null then
    raise exception 'invalid client or appointment data' using errcode = '22023';
  end if;

  select * into v_service from public.services
  where business_id = p_business_id and id = p_service_id and active;
  select * into v_staff from public.staff_members
  where business_id = p_business_id and id = p_staff_id and active
  for update;
  select timezone into v_timezone from public.businesses where id = p_business_id;
  if v_service.id is null or v_staff.id is null or v_timezone is null then
    raise exception 'service, staff or business is unavailable' using errcode = '22023';
  end if;

  if p_appointment_id is not null and not exists (
    select 1 from public.appointments a
    where a.business_id = p_business_id and a.id = p_appointment_id and a.status = 'scheduled'
  ) then
    raise exception 'appointment not found or no longer editable' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.get_available_slots(
      p_business_id, p_staff_id, p_service_id, p_date, p_appointment_id
    ) s
    where s.slot = p_time
  ) then
    raise exception 'requested slot is no longer available' using errcode = '23P01';
  end if;

  insert into public.clients (business_id, name, phone)
  values (p_business_id, trim(p_client_name), p_client_phone)
  on conflict (business_id, phone) do update set name = excluded.name
  returning id into v_client_id;

  v_start := (p_date + p_time) at time zone v_timezone;
  v_end := v_start + make_interval(mins => v_service.duration_minutes);
  if p_appointment_id is null then
    insert into public.appointments (
      business_id, client_id, staff_id, service_id, starts_at, ends_at,
      service_name, staff_name, service_amount_cents, duration_minutes,
      commission_type, commission_value, notes
    ) values (
      p_business_id, v_client_id, p_staff_id, p_service_id, v_start, v_end,
      v_service.name, v_staff.name, v_service.price_cents, v_service.duration_minutes,
      v_staff.commission_type, v_staff.commission_value, coalesce(p_notes, '')
    ) returning id into v_appointment_id;
  else
    update public.appointments set
      client_id = v_client_id, staff_id = p_staff_id, service_id = p_service_id,
      starts_at = v_start, ends_at = v_end,
      service_name = v_service.name, staff_name = v_staff.name,
      service_amount_cents = v_service.price_cents,
      duration_minutes = v_service.duration_minutes,
      commission_type = v_staff.commission_type,
      commission_value = v_staff.commission_value,
      notes = coalesce(p_notes, ''), updated_at = now()
    where business_id = p_business_id and id = p_appointment_id and status = 'scheduled'
    returning id into v_appointment_id;
    if v_appointment_id is null then
      raise exception 'appointment not found or no longer editable' using errcode = 'P0002';
    end if;
  end if;
  return v_appointment_id;
end;
$$;

create function public.set_appointment_status(
  p_business_id uuid,
  p_appointment_id uuid,
  p_status public.appointment_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_id uuid;
  v_updated integer;
begin
  select a.staff_id into v_staff_id from public.appointments a
  where a.business_id = p_business_id and a.id = p_appointment_id and a.status = 'scheduled';
  if v_staff_id is null then
    raise exception 'appointment not found or already finalized' using errcode = 'P0002';
  end if;
  if p_status not in ('completed', 'cancelled')
     or not (
       public.has_business_role(p_business_id, array['owner','manager','receptionist']::public.business_role[])
       or (public.has_business_role(p_business_id, array['barber']::public.business_role[])
           and public.current_staff_id(p_business_id) = v_staff_id)
     ) then
    raise exception 'not permitted to change this appointment' using errcode = '42501';
  end if;
  if p_status = 'completed' and exists (
    select 1 from public.appointments a
    join public.businesses b on b.id = a.business_id
    where a.business_id = p_business_id and a.id = p_appointment_id
      and a.starts_at > now()
  ) then
    raise exception 'appointment cannot be completed before its scheduled start' using errcode = '22023';
  end if;
  update public.appointments
  set status = p_status, updated_at = now()
  where business_id = p_business_id and id = p_appointment_id and status = 'scheduled';
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'appointment was already finalized' using errcode = 'P0002';
  end if;
end;
$$;

create function public.record_completed_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount bigint;
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    v_amount := case new.commission_type
      when 'percentage' then round(new.service_amount_cents * new.commission_value / 100)::bigint
      when 'fixed' then least(new.service_amount_cents, round(new.commission_value * 100)::bigint)
    end;
    insert into public.commissions (business_id, appointment_id, staff_id, amount_cents)
    values (new.business_id, new.id, new.staff_id, v_amount)
    on conflict (business_id, appointment_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger appointments_record_commission
after update of status on public.appointments
for each row execute function public.record_completed_appointment();

create function public.queue_appointment_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
  v_phone text;
  v_timezone text;
  v_customer_name text;
  v_business_name text;
  v_service_name text;
  v_staff_name text;
begin
  if tg_op = 'INSERT' then
    v_event := 'created';
  elsif new.status = 'cancelled' and old.status is distinct from new.status then
    v_event := 'cancelled';
  elsif new.status = 'scheduled' and old.status = 'scheduled'
    and (new.starts_at, new.ends_at, new.staff_id, new.service_id)
      is distinct from (old.starts_at, old.ends_at, old.staff_id, old.service_id) then
    v_event := 'rescheduled';
  else
    return new;
  end if;

  select c.phone, b.timezone, c.name, b.name,
         coalesce(s.name, new.service_name), coalesce(sm.name, new.staff_name)
    into v_phone, v_timezone, v_customer_name, v_business_name, v_service_name, v_staff_name
  from public.clients c
  join public.businesses b on b.id = c.business_id
  left join public.services s on s.business_id = new.business_id and s.id = new.service_id
  left join public.staff_members sm on sm.business_id = new.business_id and sm.id = new.staff_id
  where c.business_id = new.business_id and c.id = new.client_id;
  if v_phone is null then return new; end if;

  insert into public.whatsapp_outbox (
    business_id, appointment_id, event_type, recipient_phone, template_parameters
  ) values (
    new.business_id, new.id, v_event, v_phone,
    jsonb_build_object(
      'customer_name', v_customer_name,
      'service_name', v_service_name,
      'staff_name', v_staff_name,
      'date', to_char(new.starts_at at time zone v_timezone, 'DD/MM/YYYY'),
      'time', to_char(new.starts_at at time zone v_timezone, 'HH24:MI'),
      'business_name', v_business_name
    )
  );
  return new;
end;
$$;

create trigger appointments_queue_whatsapp
after insert or update of status, starts_at, ends_at, staff_id, service_id on public.appointments
for each row execute function public.queue_appointment_whatsapp();

create function public.claim_whatsapp_outbox(p_limit integer default 20)
returns setof public.whatsapp_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with picked as (
    select o.id from public.whatsapp_outbox o
    where ((o.status = 'queued' or (o.status = 'failed' and o.attempts < 5))
           and o.next_attempt_at <= now())
       or (o.status = 'processing' and o.processing_at < now() - interval '5 minutes' and o.attempts < 5)
    order by o.next_attempt_at, o.id
    for update skip locked
    limit greatest(1, least(p_limit, 100))
  )
  update public.whatsapp_outbox o
  set status = 'processing', processing_at = now(), attempts = o.attempts + 1
  from picked p
  where o.id = p.id
  returning o.*;
end;
$$;

create function public.finish_whatsapp_outbox(p_id bigint, p_sent boolean, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.whatsapp_outbox
  set status = case when p_sent then 'sent' else 'failed' end,
      sent_at = case when p_sent then now() else null end,
      last_error = case when p_sent then null else left(coalesce(p_error, 'Delivery failed'), 500) end,
      next_attempt_at = case when p_sent then next_attempt_at
        else now() + make_interval(secs => least(3600, 30 * power(2, least(attempts, 7))::integer)) end,
      processing_at = null
  where id = p_id and status = 'processing';
end;
$$;

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.staff_members enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.service_staff enable row level security;
alter table public.business_hours enable row level security;
alter table public.staff_hours enable row level security;
alter table public.staff_blocks enable row level security;
alter table public.appointments enable row level security;
alter table public.commissions enable row level security;
alter table public.whatsapp_outbox enable row level security;

create policy businesses_member_read on public.businesses for select to authenticated
  using (public.has_business_role(id));
create policy memberships_member_read on public.business_members for select to authenticated
  using (user_id = (select auth.uid()) or public.has_business_role(business_id, array['owner','manager']::public.business_role[]));
create policy staff_member_read on public.staff_members for select to authenticated
  using (public.has_business_role(business_id));
create policy staff_manager_write on public.staff_members for all to authenticated
  using (public.has_business_role(business_id, array['owner','manager']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner','manager']::public.business_role[]));
create policy clients_operational_read on public.clients for select to authenticated
  using (public.has_business_role(business_id, array['owner','manager','receptionist']::public.business_role[]));
create policy clients_operational_insert on public.clients for insert to authenticated
  with check (public.has_business_role(business_id, array['owner','manager','receptionist']::public.business_role[]));
create policy clients_own_appointments_read on public.clients for select to authenticated
  using (
    public.has_business_role(business_id, array['barber']::public.business_role[])
    and exists (
      select 1 from public.appointments a
      where a.business_id = clients.business_id and a.client_id = clients.id
        and a.staff_id = public.current_staff_id(clients.business_id)
    )
  );
create policy clients_manager_update on public.clients for update to authenticated
  using (public.has_business_role(business_id, array['owner','manager','receptionist']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner','manager','receptionist']::public.business_role[]));
create policy services_member_read on public.services for select to authenticated
  using (public.has_business_role(business_id));
create policy services_manager_write on public.services for all to authenticated
  using (public.has_business_role(business_id, array['owner','manager']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner','manager']::public.business_role[]));
create policy service_staff_member_read on public.service_staff for select to authenticated
  using (public.has_business_role(business_id));
create policy service_staff_manager_write on public.service_staff for all to authenticated
  using (public.has_business_role(business_id, array['owner','manager']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner','manager']::public.business_role[]));
create policy business_hours_member_read on public.business_hours for select to authenticated
  using (public.has_business_role(business_id));
create policy business_hours_manager_write on public.business_hours for all to authenticated
  using (public.has_business_role(business_id, array['owner','manager']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner','manager']::public.business_role[]));
create policy staff_hours_member_read on public.staff_hours for select to authenticated
  using (public.has_business_role(business_id));
create policy staff_hours_manager_write on public.staff_hours for all to authenticated
  using (public.has_business_role(business_id, array['owner','manager']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner','manager']::public.business_role[]));
create policy staff_blocks_member_read on public.staff_blocks for select to authenticated
  using (public.has_business_role(business_id));
create policy staff_blocks_manager_write on public.staff_blocks for all to authenticated
  using (public.has_business_role(business_id, array['owner','manager']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner','manager']::public.business_role[]));
create policy appointments_scoped_read on public.appointments for select to authenticated
  using (
    public.has_business_role(business_id, array['owner','manager','receptionist']::public.business_role[])
    or (public.has_business_role(business_id, array['barber']::public.business_role[])
        and staff_id = public.current_staff_id(business_id))
  );
create policy commissions_owner_manager_read on public.commissions for select to authenticated
  using (public.has_business_role(business_id, array['owner','manager']::public.business_role[]));
create policy commissions_own_read on public.commissions for select to authenticated
  using (
    public.has_business_role(business_id, array['barber']::public.business_role[])
    and staff_id = public.current_staff_id(business_id)
  );

revoke all on public.businesses, public.business_members, public.staff_members, public.clients,
  public.services, public.service_staff, public.business_hours, public.staff_hours,
  public.staff_blocks, public.appointments, public.commissions, public.whatsapp_outbox
  from anon, authenticated;

grant select on public.businesses, public.business_members, public.staff_members,
  public.clients, public.services, public.service_staff, public.business_hours,
  public.staff_hours, public.staff_blocks, public.appointments, public.commissions
  to authenticated;
grant insert, update, delete on public.staff_members, public.services, public.service_staff,
  public.business_hours, public.staff_hours, public.staff_blocks to authenticated;
grant insert, update on public.clients to authenticated;
grant usage, select on sequence public.whatsapp_outbox_id_seq to service_role;

revoke all on function public.has_business_role(uuid, public.business_role[]) from public, anon;
revoke all on function public.current_staff_id(uuid) from public, anon;
revoke all on function public.create_business(text, text) from public, anon;
revoke all on function public.set_business_member(uuid, uuid, public.business_role, uuid) from public, anon;
revoke all on function public.get_available_slots(uuid, uuid, uuid, date, uuid) from public, anon;
revoke all on function public.save_appointment(uuid, text, text, uuid, uuid, date, time, text, uuid) from public, anon;
revoke all on function public.set_appointment_status(uuid, uuid, public.appointment_status) from public, anon;
revoke all on function public.claim_whatsapp_outbox(integer) from public, anon, authenticated;
revoke all on function public.finish_whatsapp_outbox(bigint, boolean, text) from public, anon, authenticated;

grant execute on function public.has_business_role(uuid, public.business_role[]) to authenticated;
grant execute on function public.current_staff_id(uuid) to authenticated;
grant execute on function public.create_business(text, text) to authenticated;
grant execute on function public.set_business_member(uuid, uuid, public.business_role, uuid) to authenticated;
grant execute on function public.get_available_slots(uuid, uuid, uuid, date, uuid) to authenticated;
grant execute on function public.save_appointment(uuid, text, text, uuid, uuid, date, time, text, uuid) to authenticated;
grant execute on function public.set_appointment_status(uuid, uuid, public.appointment_status) to authenticated;
grant execute on function public.claim_whatsapp_outbox(integer) to service_role;
grant execute on function public.finish_whatsapp_outbox(bigint, boolean, text) to service_role;
