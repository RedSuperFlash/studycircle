create table internal.push_subscriptions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles on delete cascade,
 endpoint text not null unique,
 device_key text not null,
 device_secret text not null,
 created_at timestamptz not null default now()
);
create index push_subscriptions_owner on internal.push_subscriptions(user_id);
create table internal.push_deliveries(
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null references public.notifications on delete cascade,
 subscription_id uuid not null references internal.push_subscriptions on delete cascade,
 attempts integer not null default 0,
 next_attempt timestamptz not null default now(),
 finished boolean not null default false,
 unique(notification_id,subscription_id)
);

create function public.manage_push_subscription(device_endpoint text, device_public_key text default null, device_auth text default null)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if device_public_key is null and device_auth is null then
  delete from internal.push_subscriptions where endpoint=device_endpoint and user_id=actor;
  return;
 end if;
 perform internal.limit_action('push',12,interval '1 day');
 if length(device_endpoint)>1500 or device_endpoint !~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|([a-z0-9-]+[.])?web[.]push[.]apple[.]com|([a-z0-9-]+[.])?push[.]apple[.]com|[a-z0-9-]+[.]notify[.]windows[.]com)/[A-Za-z0-9_~./=%+?&:-]+$'
   or device_public_key is null or device_public_key !~ '^[A-Za-z0-9_-]{87}$'
   or device_auth is null or device_auth !~ '^[A-Za-z0-9_-]{22}$' then
  raise exception 'Unsupported push service or invalid device keys';
 end if;
 if (select count(*) from internal.push_subscriptions where user_id=actor and endpoint<>device_endpoint)>=5 then raise exception 'This account already has five push devices';end if;
 insert into internal.push_subscriptions(user_id,endpoint,device_key,device_secret)
 values(actor,device_endpoint,device_public_key,device_auth)
 on conflict(endpoint) do update set device_key=excluded.device_key,device_secret=excluded.device_secret
 where internal.push_subscriptions.user_id=actor;
 if not found then raise exception 'This browser subscription belongs to another account. Remove the old subscription from browser settings.';end if;
end $$;

create function public.claim_push_batch() returns table(id uuid,notification_id uuid,endpoint text,device_key text,device_secret text)
language plpgsql security definer set search_path='' as $$
begin
 insert into internal.push_deliveries(notification_id,subscription_id)
 select n.id,s.id from public.notifications n join internal.push_subscriptions s on s.user_id=n.user_id
 join public.student_preferences p on p.user_id=n.user_id
 where n.created_at>s.created_at and n.created_at>now()-interval '1 day' and n.read_at is null
 and internal.active(n.user_id) and not(n.category=any(p.muted_categories))
 and not exists(select 1 from internal.push_deliveries d where d.notification_id=n.id and d.subscription_id=s.id)
 order by n.created_at limit 200 on conflict do nothing;
 return query
 with work as (
   select d.id from internal.push_deliveries d join public.notifications n on n.id=d.notification_id
   join public.student_preferences p on p.user_id=n.user_id
   where not d.finished and d.attempts<3 and d.next_attempt<=now() and n.read_at is null
   and n.created_at>now()-interval '1 day' and internal.active(n.user_id) and not(n.category=any(p.muted_categories))
   order by d.next_attempt limit 30 for update of d skip locked
 ), claimed as (
  update internal.push_deliveries d set attempts=d.attempts+1,next_attempt=now()+interval '5 minutes'
  from work w where d.id=w.id returning d.id,d.notification_id,d.subscription_id
 )
 select c.id,c.notification_id,s.endpoint,s.device_key,s.device_secret from claimed c
 join internal.push_subscriptions s on s.id=c.subscription_id;
end $$;
create function public.finish_push_attempt(delivery uuid,outcome text) returns void language plpgsql security definer set search_path='' as $$
begin
 if outcome='expired' then delete from internal.push_subscriptions where id=(select subscription_id from internal.push_deliveries where id=delivery);
 elsif outcome in ('delivered','rejected') then update internal.push_deliveries set finished=true where id=delivery;
 elsif outcome<>'retry' then raise exception 'Invalid outcome';end if;
end $$;

revoke all on function public.manage_push_subscription(text,text,text),public.claim_push_batch(),public.finish_push_attempt(uuid,text) from public,anon,authenticated;
grant execute on function public.manage_push_subscription(text,text,text) to authenticated;
grant execute on function public.claim_push_batch(),public.finish_push_attempt(uuid,text) to service_role;
