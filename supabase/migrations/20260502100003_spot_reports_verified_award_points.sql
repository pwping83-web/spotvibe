-- verified 제보 확정 시 contribution_points +10 (클라이언트 직접 insert verified / Edge pending→verified 공통)
create or replace function public.spot_reports_award_points_on_verify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  amt integer := 10;
begin
  if tg_op = 'INSERT' then
    if new.status = 'verified' and new.user_id is not null then
      uid := new.user_id;
    else
      return new;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from 'pending' then
      return new;
    end if;
    if new.status is distinct from 'verified' or new.user_id is null then
      return new;
    end if;
    uid := new.user_id;
  else
    return new;
  end if;

  update public.profiles
  set contribution_points = contribution_points + amt
  where id = uid;

  return new;
end;
$$;

drop trigger if exists spot_reports_award_points_trg on public.spot_reports;

create trigger spot_reports_award_points_trg
  after insert or update of status on public.spot_reports
  for each row
  execute procedure public.spot_reports_award_points_on_verify();
