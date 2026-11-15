alter type public.business_role add value if not exists 'professional';

alter table public.business_members
  drop constraint if exists business_members_check;
alter table public.business_members
  add constraint business_members_staff_role_check
  check ((role::text in ('barber', 'professional')) = (staff_id is not null));

alter table public.clients
  add column auth_user_id uuid references auth.users(id) on delete set null;

create unique index clients_business_auth_user_unique
  on public.clients (business_id, auth_user_id)
  where auth_user_id is not null;

create unique index if not exists appointments_business_id_id_unique
  on public.appointments (business_id, id);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public, anon, authenticated, service_role;

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.platform_admins p where p.user_id = auth.uid()
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
    and m.user_id = auth.uid()
    and m.role::text in ('barber', 'professional');
$$;

create function public.has_active_business_professional(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.business_members m
    join public.staff_members s
      on s.business_id = m.business_id and s.id = m.staff_id
    where m.business_id = p_business_id
      and m.user_id = auth.uid()
      and m.role::text in ('barber', 'professional')
      and s.active
  );
$$;

create function public.has_confirmed_phone_identity()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.phone_confirmed_at is not null
  );
$$;

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  subject_user_id uuid,
  business_id uuid,
  entity_type text not null,
  entity_id text,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_data jsonb,
  new_data jsonb,
  request_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(request_metadata) = 'object'),
  created_at timestamptz not null default now()
);

create function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_business_id uuid;
  v_entity_id text;
  v_subject_user_id uuid;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  v_row := coalesce(v_new, v_old);

  if v_row ? 'business_id' then
    v_business_id := (v_row ->> 'business_id')::uuid;
  end if;
  v_entity_id := coalesce(v_row ->> 'id', v_row ->> 'user_id');
  if tg_table_name = 'business_members' then
    v_entity_id := v_row ->> 'user_id';
    v_subject_user_id := (v_row ->> 'user_id')::uuid;
  elsif tg_table_name = 'platform_admins' then
    v_entity_id := v_row ->> 'user_id';
    v_subject_user_id := (v_row ->> 'user_id')::uuid;
  elsif v_row ? 'recipient_user_id' then
    v_subject_user_id := (v_row ->> 'recipient_user_id')::uuid;
  end if;

  insert into public.audit_logs (
    actor_user_id, subject_user_id, business_id, entity_type, entity_id,
    action, old_data, new_data
  ) values (
    auth.uid(), v_subject_user_id, v_business_id, tg_table_name, v_entity_id,
    lower(tg_op), v_old, v_new
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create index audit_logs_business_created_idx
  on public.audit_logs (business_id, created_at desc);
create index audit_logs_actor_created_idx
  on public.audit_logs (actor_user_id, created_at desc);

alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from public, anon, authenticated, service_role;
grant select on public.audit_logs to authenticated;

create policy audit_logs_authorized_read on public.audit_logs for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_business_role(
      business_id, array['owner', 'manager']::public.business_role[]
    )
  );

create function public.reject_audit_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'audit logs are append-only' using errcode = '42501';
end;
$$;

create trigger audit_logs_append_only
before update or delete on public.audit_logs
for each row execute function public.reject_audit_log_mutation();

create trigger audit_platform_admins
after insert or update or delete on public.platform_admins
for each row execute function public.audit_row_change();
create trigger audit_businesses
after insert or update or delete on public.businesses
for each row execute function public.audit_row_change();
create trigger audit_business_members
after insert or update or delete on public.business_members
for each row execute function public.audit_row_change();
create trigger audit_staff_members
after insert or update or delete on public.staff_members
for each row execute function public.audit_row_change();
create trigger audit_clients
after insert or update or delete on public.clients
for each row execute function public.audit_row_change();
create trigger audit_appointments
after insert or update or delete on public.appointments
for each row execute function public.audit_row_change();

create function public.guard_client_auth_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
begin
  if tg_op = 'UPDATE'
     and new.auth_user_id is not distinct from old.auth_user_id
     and new.phone is not distinct from old.phone then
    return new;
  end if;

  if new.auth_user_id is null then
    if tg_op = 'UPDATE' and old.auth_user_id is not null
       and auth.uid() is not null then
      raise exception 'client identity links cannot be removed by a client session'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if auth.uid() is not null and new.auth_user_id is distinct from auth.uid() then
    raise exception 'only the authenticated account may link itself'
      using errcode = '42501';
  end if;

  select regexp_replace(u.phone, '[^0-9]', '', 'g')
    into v_phone
  from auth.users u
  where u.id = new.auth_user_id and u.phone_confirmed_at is not null;

  if v_phone is null
     or v_phone <> regexp_replace(new.phone, '[^0-9]', '', 'g') then
    raise exception 'a confirmed matching authentication phone is required'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger clients_guard_auth_link
before insert or update on public.clients
for each row execute function public.guard_client_auth_link();

create function public.link_client_identity(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_rows integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select regexp_replace(u.phone, '[^0-9]', '', 'g') into v_phone
  from auth.users u
  where u.id = auth.uid() and u.phone_confirmed_at is not null;
  if v_phone is null then
    raise exception 'confirmed SMS phone authentication is required' using errcode = '42501';
  end if;

  update public.clients c
  set auth_user_id = auth.uid()
  where c.business_id = p_business_id
    and regexp_replace(c.phone, '[^0-9]', '', 'g') = v_phone
    and (c.auth_user_id is null or c.auth_user_id = auth.uid());
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'client record does not match the confirmed account phone'
      using errcode = '42501';
  end if;
end;
$$;

create function public.get_my_appointments()
returns table (
  id uuid,
  business_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status,
  service_name text,
  staff_name text,
  service_amount_cents bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.business_id, a.starts_at, a.ends_at, a.status,
         a.service_name, a.staff_name, a.service_amount_cents
  from public.appointments a
  join public.clients c
    on c.business_id = a.business_id and c.id = a.client_id
  where auth.uid() is not null and c.auth_user_id = auth.uid()
  order by a.starts_at desc;
$$;

create table public.company_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  cancellation_deadline_hours integer not null default 24
    check (cancellation_deadline_hours between 0 and 720),
  reschedule_deadline_hours integer not null default 24
    check (reschedule_deadline_hours between 0 and 720),
  check_in_window_minutes integer not null default 15
    check (check_in_window_minutes between 0 and 240),
  late_grace_minutes integer not null default 10
    check (late_grace_minutes between 0 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9_-]{1,49}$'),
  name text not null check (length(trim(name)) between 1 and 100),
  price_cents bigint not null check (price_cents >= 0),
  billing_interval text not null check (billing_interval in ('month', 'year')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan_id uuid not null references public.plan_catalog(id),
  pending_plan_id uuid references public.plan_catalog(id),
  status text not null check (status in ('trialing', 'active', 'past_due', 'paused', 'cancelled')),
  current_period_starts_at timestamptz not null,
  current_period_ends_at timestamptz not null,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_ends_at > current_period_starts_at),
  unique (business_id, id)
);

create unique index subscriptions_one_current_per_business
  on public.subscriptions (business_id)
  where status in ('trialing', 'active', 'past_due', 'paused');

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null check (length(trim(code)) between 1 and 50),
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(10, 2) not null check (discount_value > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, code),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (discount_type <> 'percentage' or discount_value <= 100)
);

create table public.cash_register (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  appointment_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  payment_method text not null check (payment_method in ('cash', 'pix', 'card', 'other')),
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  foreign key (business_id, appointment_id)
    references public.appointments(business_id, id),
  unique (business_id, appointment_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (length(trim(notification_type)) between 1 and 80),
  title text not null check (length(trim(title)) between 1 and 160),
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

insert into public.company_settings (business_id)
select b.id from public.businesses b
on conflict (business_id) do nothing;

alter table public.company_settings enable row level security;
alter table public.plan_catalog enable row level security;
alter table public.subscriptions enable row level security;
alter table public.coupons enable row level security;
alter table public.cash_register enable row level security;
alter table public.notifications enable row level security;

create policy company_settings_member_read on public.company_settings for select to authenticated
  using (public.has_business_role(business_id) or public.is_platform_admin());
create policy company_settings_admin_insert on public.company_settings for insert to authenticated
  with check (
    public.is_platform_admin()
    or public.has_business_role(business_id, array['owner', 'manager']::public.business_role[])
  );
create policy company_settings_admin_update on public.company_settings for update to authenticated
  using (
    public.is_platform_admin()
    or public.has_business_role(business_id, array['owner', 'manager']::public.business_role[])
  )
  with check (
    public.is_platform_admin()
    or public.has_business_role(business_id, array['owner', 'manager']::public.business_role[])
  );

create policy plan_catalog_platform_read on public.plan_catalog for select to authenticated
  using (public.is_platform_admin());
create policy plan_catalog_active_read on public.plan_catalog for select to authenticated
  using (active);
create policy subscriptions_admin_read on public.subscriptions for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_business_role(business_id, array['owner', 'manager']::public.business_role[])
  );

create policy coupons_member_read on public.coupons for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_business_role(
      business_id, array['owner', 'manager', 'receptionist']::public.business_role[]
    )
  );
create policy coupons_admin_write on public.coupons for all to authenticated
  using (
    public.is_platform_admin()
    or public.has_business_role(business_id, array['owner', 'manager']::public.business_role[])
  )
  with check (
    public.is_platform_admin()
    or public.has_business_role(business_id, array['owner', 'manager']::public.business_role[])
  );

create policy cash_register_scoped_read on public.cash_register for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_business_role(
      business_id, array['owner', 'manager', 'receptionist']::public.business_role[]
    )
    or (
      public.current_staff_id(business_id) is not null
      and exists (
        select 1 from public.appointments a
        where a.business_id = cash_register.business_id
          and a.id = cash_register.appointment_id
          and a.staff_id = public.current_staff_id(cash_register.business_id)
      )
    )
  );

create policy notifications_recipient_read on public.notifications for select to authenticated
  using (recipient_user_id = auth.uid());

create policy appointments_professional_own_read on public.appointments for select to authenticated
  using (
    exists (
      select 1 from public.business_members m
      where m.business_id = appointments.business_id and m.user_id = auth.uid()
        and m.role::text = 'professional'
        and m.staff_id = appointments.staff_id
    )
  );
create policy clients_professional_own_appointments_read on public.clients for select to authenticated
  using (
    exists (
      select 1 from public.business_members m
      join public.appointments a
        on a.business_id = m.business_id and a.staff_id = m.staff_id
      where m.business_id = clients.business_id and m.user_id = auth.uid()
        and m.role::text = 'professional' and a.client_id = clients.id
    )
  );

create function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger company_settings_set_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create function public.initialize_company_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.company_settings (business_id) values (new.id)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

create trigger businesses_initialize_settings
after insert on public.businesses
for each row execute function public.initialize_company_settings();

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
  v_is_client_reschedule boolean := false;
  v_is_linked_client boolean := false;
  v_is_professional_member boolean := false;
begin
  if p_exclude_appointment_id is not null then
    select exists (
      select 1 from public.appointments a
      join public.clients c on c.business_id = a.business_id and c.id = a.client_id
      where a.business_id = p_business_id and a.id = p_exclude_appointment_id
        and a.status = 'scheduled' and c.auth_user_id = auth.uid()
        and a.staff_id = p_staff_id and a.service_id = p_service_id
    ) into v_is_client_reschedule;
  end if;
  select exists (
    select 1 from public.clients c
    where c.business_id = p_business_id and c.auth_user_id = auth.uid()
  ) into v_is_linked_client;
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = auth.uid()
      and m.role::text in ('barber', 'professional')
  ) into v_is_professional_member;
  if v_is_professional_member and not public.is_platform_admin()
     and not public.has_active_business_professional(p_business_id) then
    raise exception 'professional membership is inactive' using errcode = '42501';
  end if;
  if not (
    public.is_platform_admin()
    or public.has_business_role(p_business_id)
    or v_is_client_reschedule
    or v_is_linked_client
  ) then
    raise exception 'not permitted to query availability' using errcode = '42501';
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

create or replace function public.save_appointment(
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
  v_is_professional boolean;
  v_has_professional_membership boolean;
begin
  v_has_professional_membership := exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = auth.uid()
      and m.role::text in ('barber', 'professional')
  );
  v_is_professional := public.has_active_business_professional(p_business_id);
  if v_has_professional_membership and not public.is_platform_admin()
     and not v_is_professional then
    raise exception 'professional membership is inactive' using errcode = '42501';
  end if;
  if not (
    public.is_platform_admin()
    or public.has_business_role(
      p_business_id,
      array['owner', 'manager', 'receptionist', 'barber']::public.business_role[]
    )
    or v_is_professional
  ) then
    raise exception 'not permitted to book appointments' using errcode = '42501';
  end if;
  if p_client_name is null or length(trim(p_client_name)) not between 1 and 100
     or p_client_phone is null
     or p_client_phone !~ '^55(11|12|13|14|15|16|17|18|19|21|22|24|27|28|31|32|33|34|35|37|38|41|42|43|44|45|46|47|48|49|51|53|54|55|61|62|63|64|65|66|67|68|69|71|73|74|75|77|79|81|82|83|84|85|86|87|88|89|91|92|93|94|95|96|97|98|99)9[0-9]{8}$'
     or p_date is null or p_time is null then
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
    where a.business_id = p_business_id and a.id = p_appointment_id
      and a.status = 'scheduled'
  ) then
    raise exception 'appointment not found or no longer editable' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.get_available_slots(
      p_business_id, p_staff_id, p_service_id, p_date, p_appointment_id
    ) s where s.slot = p_time
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

create function public.client_create_appointment(
  p_business_id uuid,
  p_client_name text,
  p_service_id uuid,
  p_staff_id uuid,
  p_date date,
  p_time time,
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_client_id uuid;
  v_client_auth_user_id uuid;
  v_appointment_id uuid;
  v_service public.services%rowtype;
  v_staff public.staff_members%rowtype;
  v_timezone text;
  v_start timestamptz;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_client_name is null or length(trim(p_client_name)) not between 1 and 100
     or p_date is null or p_time is null then
    raise exception 'invalid client or appointment data' using errcode = '22023';
  end if;

  select regexp_replace(u.phone, '[^0-9]', '', 'g') into v_phone
  from auth.users u
  where u.id = auth.uid() and u.phone_confirmed_at is not null;
  if v_phone is null
     or v_phone !~ '^55(11|12|13|14|15|16|17|18|19|21|22|24|27|28|31|32|33|34|35|37|38|41|42|43|44|45|46|47|48|49|51|53|54|55|61|62|63|64|65|66|67|68|69|71|73|74|75|77|79|81|82|83|84|85|86|87|88|89|91|92|93|94|95|96|97|98|99)9[0-9]{8}$' then
    raise exception 'confirmed Brazilian SMS phone authentication is required'
      using errcode = '42501';
  end if;

  insert into public.clients (business_id, name, phone, auth_user_id)
  values (p_business_id, trim(p_client_name), v_phone, auth.uid())
  on conflict (business_id, phone) do update set name = excluded.name
  returning id, auth_user_id into v_client_id, v_client_auth_user_id;
  if v_client_auth_user_id is null then
    update public.clients c set auth_user_id = auth.uid()
    where c.business_id = p_business_id and c.id = v_client_id
      and c.auth_user_id is null;
    select c.auth_user_id into v_client_auth_user_id
    from public.clients c
    where c.business_id = p_business_id and c.id = v_client_id;
  end if;
  if v_client_auth_user_id is distinct from auth.uid() then
    raise exception 'client phone is linked to a different authenticated account'
      using errcode = '42501';
  end if;

  select * into v_service from public.services
  where business_id = p_business_id and id = p_service_id and active;
  select * into v_staff from public.staff_members
  where business_id = p_business_id and id = p_staff_id and active;
  select b.timezone into v_timezone from public.businesses b where b.id = p_business_id;
  if v_service.id is null or v_staff.id is null or v_timezone is null then
    raise exception 'service, staff or business is unavailable' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.get_available_slots(
      p_business_id, p_staff_id, p_service_id, p_date
    ) s where s.slot = p_time
  ) then
    raise exception 'requested slot is no longer available' using errcode = '23P01';
  end if;

  v_start := (p_date + p_time) at time zone v_timezone;
  insert into public.appointments (
    business_id, client_id, staff_id, service_id, starts_at, ends_at,
    service_name, staff_name, service_amount_cents, duration_minutes,
    commission_type, commission_value, notes
  ) values (
    p_business_id, v_client_id, p_staff_id, p_service_id, v_start,
    v_start + make_interval(mins => v_service.duration_minutes),
    v_service.name, v_staff.name, v_service.price_cents, v_service.duration_minutes,
    v_staff.commission_type, v_staff.commission_value, coalesce(p_notes, '')
  ) returning id into v_appointment_id;
  return v_appointment_id;
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
  v_is_platform_admin boolean := public.is_platform_admin();
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select m.role into v_actor_role from public.business_members m
  where m.business_id = p_business_id and m.user_id = auth.uid();
  if not v_is_platform_admin
     and (v_actor_role is null or v_actor_role::text not in ('owner', 'manager')) then
    raise exception 'not permitted to manage business members' using errcode = '42501';
  end if;
  if not v_is_platform_admin and v_actor_role::text = 'manager' and p_role::text = 'owner' then
    raise exception 'only an owner may assign the owner role' using errcode = '42501';
  end if;
  if (p_role::text in ('barber', 'professional')) <> (p_staff_id is not null) then
    raise exception 'professional roles require a staff profile and other roles cannot use one'
      using errcode = '22023';
  end if;
  if p_staff_id is not null and not exists (
    select 1 from public.staff_members s
    where s.business_id = p_business_id and s.id = p_staff_id
  ) then
    raise exception 'staff profile belongs to a different business' using errcode = '22023';
  end if;

  select m.role into v_target_role from public.business_members m
  where m.business_id = p_business_id and m.user_id = p_user_id;
  if not v_is_platform_admin and v_target_role::text = 'owner'
     and v_actor_role::text <> 'owner' then
    raise exception 'only an owner may change an owner membership' using errcode = '42501';
  end if;
  if v_target_role::text = 'owner' and p_role::text <> 'owner'
     and not exists (
       select 1 from public.business_members m
       where m.business_id = p_business_id and m.user_id <> p_user_id
         and m.role::text = 'owner'
     ) then
    raise exception 'a business must retain at least one owner' using errcode = '42501';
  end if;

  insert into public.business_members (business_id, user_id, role, staff_id)
  values (p_business_id, p_user_id, p_role, p_staff_id)
  on conflict (business_id, user_id) do update
  set role = excluded.role, staff_id = excluded.staff_id;
end;
$$;

create function public.remove_business_member(p_business_id uuid, p_user_id uuid)
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
  select m.role into v_actor_role from public.business_members m
  where m.business_id = p_business_id and m.user_id = auth.uid();
  if not public.is_platform_admin()
     and (v_actor_role is null or v_actor_role::text not in ('owner', 'manager')) then
    raise exception 'not permitted to manage business members' using errcode = '42501';
  end if;
  select m.role into v_target_role from public.business_members m
  where m.business_id = p_business_id and m.user_id = p_user_id;
  if v_target_role is null then return; end if;
  if v_target_role::text = 'owner' and not public.is_platform_admin()
     and v_actor_role::text <> 'owner' then
    raise exception 'only an owner may remove an owner membership' using errcode = '42501';
  end if;
  if v_target_role::text = 'owner' and not exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id <> p_user_id
      and m.role::text = 'owner'
  ) then
    raise exception 'a business must retain at least one owner' using errcode = '42501';
  end if;
  delete from public.business_members
  where business_id = p_business_id and user_id = p_user_id;
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
  if exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = auth.uid()
      and m.role::text in ('barber', 'professional')
  ) and not public.is_platform_admin()
    and not public.has_active_business_professional(p_business_id) then
    raise exception 'professional membership is inactive' using errcode = '42501';
  end if;
  select a.staff_id into v_staff_id from public.appointments a
  where a.business_id = p_business_id and a.id = p_appointment_id and a.status = 'scheduled';
  if v_staff_id is null then
    raise exception 'appointment not found or already finalized' using errcode = 'P0002';
  end if;
  if p_status not in ('completed', 'cancelled')
     or not (
       public.is_platform_admin()
       or public.has_business_role(
         p_business_id, array['owner', 'manager', 'receptionist']::public.business_role[]
       )
       or public.has_active_business_professional(p_business_id)
     ) then
    raise exception 'not permitted to change this appointment' using errcode = '42501';
  end if;
  if p_status = 'completed' and exists (
    select 1 from public.appointments a
    where a.business_id = p_business_id and a.id = p_appointment_id
      and a.starts_at > now()
  ) then
    raise exception 'appointment cannot be completed before its scheduled start'
      using errcode = '22023';
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

create function public.client_cancel_appointment(p_business_id uuid, p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_starts_at timestamptz;
  v_status public.appointment_status;
  v_deadline integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select a.starts_at, a.status, coalesce(cs.cancellation_deadline_hours, 24)
    into v_starts_at, v_status, v_deadline
  from public.appointments a
  join public.clients c on c.business_id = a.business_id and c.id = a.client_id
  left join public.company_settings cs on cs.business_id = a.business_id
  where a.business_id = p_business_id and a.id = p_appointment_id
    and c.auth_user_id = auth.uid()
  for update of a;
  if not found or v_status <> 'scheduled' then
    raise exception 'appointment not found or no longer cancellable' using errcode = 'P0002';
  end if;
  if now() > v_starts_at - make_interval(hours => v_deadline) then
    raise exception 'company cancellation deadline has passed' using errcode = '42501';
  end if;
  update public.appointments set status = 'cancelled', updated_at = now()
  where business_id = p_business_id and id = p_appointment_id and status = 'scheduled';
end;
$$;

create function public.client_reschedule_appointment(
  p_business_id uuid,
  p_appointment_id uuid,
  p_date date,
  p_time time
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_timezone text;
  v_deadline integer;
  v_start timestamptz;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select a.* into v_appointment
  from public.appointments a
  join public.clients c on c.business_id = a.business_id and c.id = a.client_id
  where a.business_id = p_business_id and a.id = p_appointment_id
    and c.auth_user_id = auth.uid() and a.status = 'scheduled'
  for update of a;
  if not found then
    raise exception 'appointment not found or no longer reschedulable' using errcode = 'P0002';
  end if;
  select b.timezone into v_timezone from public.businesses b where b.id = p_business_id;
  select coalesce(cs.reschedule_deadline_hours, 24) into v_deadline
  from public.company_settings cs where cs.business_id = p_business_id;
  v_deadline := coalesce(v_deadline, 24);
  if now() > v_appointment.starts_at - make_interval(hours => v_deadline) then
    raise exception 'company reschedule deadline has passed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.get_available_slots(
      p_business_id, v_appointment.staff_id, v_appointment.service_id,
      p_date, p_appointment_id
    ) s where s.slot = p_time
  ) then
    raise exception 'requested slot is no longer available' using errcode = '23P01';
  end if;
  v_start := (p_date + p_time) at time zone v_timezone;
  update public.appointments set
    starts_at = v_start,
    ends_at = v_start + make_interval(mins => v_appointment.duration_minutes),
    updated_at = now()
  where business_id = p_business_id and id = p_appointment_id and status = 'scheduled';
end;
$$;

create function public.record_cash_receipt(
  p_business_id uuid,
  p_appointment_id uuid,
  p_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount bigint;
  v_staff_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_payment_method not in ('cash', 'pix', 'card', 'other') then
    raise exception 'unsupported payment method' using errcode = '22023';
  end if;
  select a.service_amount_cents, a.staff_id into v_amount, v_staff_id
  from public.appointments a
  where a.business_id = p_business_id and a.id = p_appointment_id
    and a.status = 'completed'
  for update;
  if not found then
    raise exception 'only completed appointments can be recorded' using errcode = '42501';
  end if;
  if not (
    public.is_platform_admin()
    or public.has_business_role(
      p_business_id, array['owner', 'manager', 'receptionist']::public.business_role[]
    )
    or (
      public.current_staff_id(p_business_id) is not null
      and public.current_staff_id(p_business_id) = v_staff_id
    )
  ) then
    raise exception 'not permitted to record this receipt' using errcode = '42501';
  end if;
  insert into public.cash_register (
    business_id, appointment_id, amount_cents, payment_method, recorded_by
  ) values (
    p_business_id, p_appointment_id, v_amount, p_payment_method, auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$$;

create trigger audit_company_settings
after insert or update or delete on public.company_settings
for each row execute function public.audit_row_change();
create trigger audit_subscriptions
after insert or update or delete on public.subscriptions
for each row execute function public.audit_row_change();
create trigger audit_coupons
after insert or update or delete on public.coupons
for each row execute function public.audit_row_change();
create trigger audit_cash_register
after insert or update or delete on public.cash_register
for each row execute function public.audit_row_change();
create trigger audit_commissions
after insert or update or delete on public.commissions
for each row execute function public.audit_row_change();
create trigger audit_notifications
after insert or update or delete on public.notifications
for each row execute function public.audit_row_change();
create trigger audit_plan_catalog
after insert or update or delete on public.plan_catalog
for each row execute function public.audit_row_change();

create policy plan_catalog_platform_write on public.plan_catalog for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy subscriptions_platform_write on public.subscriptions for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy commissions_professional_read on public.commissions for select to authenticated
  using (
    exists (
      select 1 from public.business_members m
      where m.business_id = commissions.business_id and m.user_id = auth.uid()
        and m.role::text = 'professional'
        and m.staff_id = commissions.staff_id
    )
  );
create policy commissions_platform_read on public.commissions for select to authenticated
  using (public.is_platform_admin());

revoke all on public.company_settings, public.plan_catalog, public.subscriptions,
  public.coupons, public.cash_register, public.notifications, public.audit_logs
  from public, anon, authenticated;
grant select, insert, update, delete on public.company_settings, public.coupons
  to authenticated;
revoke delete on public.company_settings from authenticated;
grant select, insert, update, delete on public.plan_catalog, public.subscriptions
  to authenticated;
grant select on public.plan_catalog, public.subscriptions, public.cash_register,
  public.notifications, public.audit_logs to authenticated;
grant select, insert, update, delete on public.plan_catalog, public.subscriptions,
  public.notifications to service_role;
grant select, insert on public.cash_register to service_role;
revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.reject_audit_log_mutation() from public, anon, authenticated;
revoke all on function public.guard_client_auth_link() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.initialize_company_settings() from public, anon, authenticated;
revoke all on function public.link_client_identity(uuid) from public, anon;
revoke all on function public.get_my_appointments() from public, anon;
revoke all on function public.get_available_slots(uuid, uuid, uuid, date, uuid) from public, anon;
revoke all on function public.client_create_appointment(uuid, text, uuid, uuid, date, time, text) from public, anon;
revoke all on function public.set_business_member(uuid, uuid, public.business_role, uuid) from public, anon;
revoke all on function public.remove_business_member(uuid, uuid) from public, anon;
revoke all on function public.set_appointment_status(uuid, uuid, public.appointment_status) from public, anon;
revoke all on function public.client_cancel_appointment(uuid, uuid) from public, anon;
revoke all on function public.client_reschedule_appointment(uuid, uuid, date, time) from public, anon;
revoke all on function public.record_cash_receipt(uuid, uuid, text) from public, anon;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.link_client_identity(uuid) to authenticated;
grant execute on function public.get_my_appointments() to authenticated;
grant execute on function public.get_available_slots(uuid, uuid, uuid, date, uuid) to authenticated;
grant execute on function public.client_create_appointment(uuid, text, uuid, uuid, date, time, text) to authenticated;
grant execute on function public.set_business_member(uuid, uuid, public.business_role, uuid) to authenticated;
grant execute on function public.remove_business_member(uuid, uuid) to authenticated;
grant execute on function public.set_appointment_status(uuid, uuid, public.appointment_status) to authenticated;
grant execute on function public.client_cancel_appointment(uuid, uuid) to authenticated;
grant execute on function public.client_reschedule_appointment(uuid, uuid, date, time) to authenticated;
grant execute on function public.record_cash_receipt(uuid, uuid, text) to authenticated;

drop policy appointments_scoped_read on public.appointments;
drop policy appointments_professional_own_read on public.appointments;
create policy appointments_scoped_read on public.appointments for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_business_role(
      business_id, array['owner', 'manager', 'receptionist']::public.business_role[]
    )
    or public.has_active_business_professional(business_id)
  );

drop policy clients_own_appointments_read on public.clients;
drop policy clients_professional_own_appointments_read on public.clients;
create policy clients_professional_company_read on public.clients for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_active_business_professional(business_id)
  );
create policy clients_professional_company_insert on public.clients for insert to authenticated
  with check (public.has_active_business_professional(business_id));
create policy clients_professional_company_update on public.clients for update to authenticated
  using (public.has_active_business_professional(business_id))
  with check (public.has_active_business_professional(business_id));
drop policy clients_admin_delete on public.clients;
create policy platform_admin_clients_write on public.clients for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy clients_admin_delete on public.clients for delete to authenticated
  using (
    public.is_platform_admin()
    or public.has_business_role(
      business_id, array['owner', 'manager', 'receptionist']::public.business_role[]
    )
  );
grant delete on public.clients to authenticated;

create policy businesses_booking_catalog_read on public.businesses for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_confirmed_phone_identity()
  );
create policy services_booking_catalog_read on public.services for select to authenticated
  using (
    active
    and (
      public.is_platform_admin()
      or public.has_confirmed_phone_identity()
    )
  );
drop policy staff_booking_catalog_read on public.staff_members;

drop policy commissions_owner_manager_read on public.commissions;
drop policy commissions_own_read on public.commissions;
drop policy commissions_professional_read on public.commissions;
drop policy commissions_platform_read on public.commissions;
create policy commissions_scoped_read on public.commissions for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_business_role(
      business_id, array['owner', 'manager', 'receptionist']::public.business_role[]
    )
    or (
      public.has_active_business_professional(business_id)
      and staff_id = public.current_staff_id(business_id)
    )
  );

drop policy cash_register_scoped_read on public.cash_register;
create policy cash_register_scoped_read on public.cash_register for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_business_role(
      business_id, array['owner', 'manager', 'receptionist']::public.business_role[]
    )
    or (
      public.has_active_business_professional(business_id)
      and exists (
        select 1 from public.appointments a
        where a.business_id = cash_register.business_id
          and a.id = cash_register.appointment_id
          and a.staff_id = public.current_staff_id(cash_register.business_id)
      )
    )
  );

create or replace function public.record_cash_receipt(
  p_business_id uuid,
  p_appointment_id uuid,
  p_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount bigint;
  v_staff_id uuid;
  v_has_professional_membership boolean;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_payment_method not in ('cash', 'pix', 'card', 'other') then
    raise exception 'unsupported payment method' using errcode = '22023';
  end if;
  v_has_professional_membership := exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = auth.uid()
      and m.role::text in ('barber', 'professional')
  );
  if v_has_professional_membership and not public.is_platform_admin()
     and not public.has_active_business_professional(p_business_id) then
    raise exception 'professional membership is inactive' using errcode = '42501';
  end if;

  select a.service_amount_cents, a.staff_id into v_amount, v_staff_id
  from public.appointments a
  where a.business_id = p_business_id and a.id = p_appointment_id
    and a.status = 'completed'
  for update;
  if not found then
    raise exception 'only completed appointments can be recorded' using errcode = '42501';
  end if;
  if not (
    public.is_platform_admin()
    or public.has_business_role(
      p_business_id, array['owner', 'manager', 'receptionist']::public.business_role[]
    )
    or (
      public.has_active_business_professional(p_business_id)
      and public.current_staff_id(p_business_id) = v_staff_id
    )
  ) then
    raise exception 'not permitted to record this receipt' using errcode = '42501';
  end if;
  insert into public.cash_register (
    business_id, appointment_id, amount_cents, payment_method, recorded_by
  ) values (
    p_business_id, p_appointment_id, v_amount, p_payment_method, auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$$;

create function public.request_subscription_plan_change(
  p_business_id uuid,
  p_subscription_id uuid,
  p_pending_plan_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.business_role;
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select m.role into v_actor_role
  from public.business_members m
  where m.business_id = p_business_id and m.user_id = auth.uid();
  if not public.is_platform_admin()
     and (v_actor_role is null or v_actor_role::text not in ('owner', 'manager')) then
    raise exception 'only company owners or managers may request subscription changes'
      using errcode = '42501';
  end if;
  if p_pending_plan_id is not null and not exists (
    select 1 from public.plan_catalog p
    where p.id = p_pending_plan_id and p.active
  ) then
    raise exception 'requested plan is unavailable' using errcode = '22023';
  end if;
  update public.subscriptions s
  set pending_plan_id = p_pending_plan_id,
      updated_at = now()
  where s.business_id = p_business_id
    and s.id = p_subscription_id
    and s.status in ('trialing', 'active', 'past_due', 'paused')
    and s.current_period_ends_at > now();
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'current subscription not found or period has ended'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.request_subscription_cancel_at_period_end(
  p_business_id uuid,
  p_subscription_id uuid,
  p_cancel_at_period_end boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.business_role;
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select m.role into v_actor_role
  from public.business_members m
  where m.business_id = p_business_id and m.user_id = auth.uid();
  if not public.is_platform_admin()
     and (v_actor_role is null or v_actor_role::text not in ('owner', 'manager')) then
    raise exception 'only company owners or managers may request subscription changes'
      using errcode = '42501';
  end if;
  if p_cancel_at_period_end is null then
    raise exception 'cancellation choice is required' using errcode = '22023';
  end if;
  update public.subscriptions s
  set cancel_at_period_end = p_cancel_at_period_end,
      updated_at = now()
  where s.business_id = p_business_id
    and s.id = p_subscription_id
    and s.status in ('trialing', 'active', 'past_due', 'paused')
    and s.current_period_ends_at > now();
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'current subscription not found or period has ended'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.has_active_business_professional(uuid) from public, anon;
revoke all on function public.has_confirmed_phone_identity() from public, anon;
revoke all on function public.request_subscription_cancel_at_period_end(uuid, uuid, boolean)
  from public, anon;
revoke all on function public.request_subscription_plan_change(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.has_active_business_professional(uuid) to authenticated;
grant execute on function public.has_confirmed_phone_identity() to authenticated;
grant execute on function public.request_subscription_cancel_at_period_end(uuid, uuid, boolean)
  to authenticated;
grant execute on function public.request_subscription_plan_change(uuid, uuid, uuid)
  to authenticated;

create function public.get_booking_catalog(p_business_id uuid)
returns table (
  business_id uuid,
  business_name text,
  timezone text,
  staff jsonb,
  services jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_confirmed_phone_identity() then
    raise exception 'confirmed phone authentication is required' using errcode = '42501';
  end if;

  return query
  select b.id, b.name, b.timezone,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'title', s.title,
        'photo_url', s.photo_url
      ) order by s.name, s.id)
      from public.staff_members s
      where s.business_id = b.id and s.active
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', svc.id,
        'name', svc.name,
        'description', svc.description,
        'price_cents', svc.price_cents,
        'duration_minutes', svc.duration_minutes
      ) order by svc.name, svc.id)
      from public.services svc
      where svc.business_id = b.id and svc.active
    ), '[]'::jsonb)
  from public.businesses b
  where b.id = p_business_id;
end;
$$;

revoke all on function public.get_booking_catalog(uuid) from public, anon;
grant execute on function public.get_booking_catalog(uuid) to authenticated;

create trigger audit_services
after insert or update or delete on public.services
for each row execute function public.audit_row_change();
create trigger audit_service_staff
after insert or update or delete on public.service_staff
for each row execute function public.audit_row_change();
create trigger audit_business_hours
after insert or update or delete on public.business_hours
for each row execute function public.audit_row_change();
create trigger audit_staff_hours
after insert or update or delete on public.staff_hours
for each row execute function public.audit_row_change();
create trigger audit_staff_blocks
after insert or update or delete on public.staff_blocks
for each row execute function public.audit_row_change();

create policy platform_admin_businesses_write on public.businesses for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy platform_admin_memberships_read on public.business_members for select to authenticated
  using (public.is_platform_admin());
create policy platform_admin_staff_write on public.staff_members for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy platform_admin_services_write on public.services for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy platform_admin_service_staff_write on public.service_staff for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy platform_admin_business_hours_write on public.business_hours for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy platform_admin_staff_hours_write on public.staff_hours for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy platform_admin_staff_blocks_write on public.staff_blocks for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy platform_admin_notifications_read on public.notifications for select to authenticated
  using (public.is_platform_admin());

grant insert, update, delete on public.businesses to authenticated;

-- Remaining product flows are intentionally not implied by these schema additions: platform-assisted
-- business creation with a distinct owner is not atomic: create_business assigns ownership to its
-- caller, while the platform-admin member RPC can associate the intended owner in a separate audited
-- step. Global platform-admin access is limited to explicit policies/RPCs below, not blanket access.
-- Suspension/disable enforcement, business check-in/statuses, cash-close and cash-movement accounting,
-- notification configuration/delivery, and billing-provider checkout, collection, retries, or
-- processing/proration of pending plan changes still require dedicated backend workflows. Coupon
-- redemption and commission adjustment/estorno also require dedicated audited RPCs; this migration
-- provides neither workflow.
