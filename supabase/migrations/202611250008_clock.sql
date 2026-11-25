create function public.server_clock() returns timestamptz language sql volatile set search_path='' as $$
 select clock_timestamp();
$$;
revoke all on function public.server_clock() from public,anon,authenticated;
grant execute on function public.server_clock() to authenticated;
