-- 제목·설명 금지어(음란·야동·성희롱 등) — src/lib/spotReportModeration.ts 와 키워드 목록을 맞출 것
create or replace function public.spot_reports_text_haystack(p_place text, p_desc text)
returns text
language sql
immutable
as $$
  select lower(
    regexp_replace(
      regexp_replace(
        coalesce(p_place, '') || coalesce(p_desc, ''),
        E'\\s+',
        '',
        'g'
      ),
      '[·・._*\-]+',
      '',
      'g'
    )
  );
$$;

create or replace function public.spot_reports_text_is_blocked(p_place text, p_desc text)
returns boolean
language plpgsql
immutable
security invoker
set search_path = public
as $$
declare
  hay text := public.spot_reports_text_haystack(p_place, p_desc);
  needles text[] := array[
    '야동','야사','야한말','야한','음란','음탕','포르노','porn','porno','xvideos','pornhub','redtube','xhamster','hentai','onlyfans','deepfake','딥페이크','19금','섹스','sex','sextape','섹파','원나잇','노출','nude','naked','nsfw','야추','자지','보지','좆','씹','ㅈㅈ','ㅂㅈ','ㅅㅅ','자위','오럴','oral','blowjob','펠라','강간','성희롱','성폭행','미성년자','n번방','몸캠','벗어','벗겨','야설','masturb','ejacul','cumshot','dick','cock','penis','vagina','fuck','fuk','shit','bitch','slut','whore','hooker','escort','prostitut','rape','grope','molest','jav','av배우','야한사진','야한동영상','성인방','성인용','딸딸이','딸친','캠걸','캠보이','노팬','노브라','노팬티'
  ];
  n text;
begin
  foreach n in array needles loop
    if position(lower(n) in hay) > 0 then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

create or replace function public.spot_reports_enforce_clean_text()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.spot_reports_text_is_blocked(new.place_name, new.description) then
    raise exception 'SPOTVIBE_BLOCKED_TEXT' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists spot_reports_clean_text_trg on public.spot_reports;
create trigger spot_reports_clean_text_trg
  before insert or update of place_name, description on public.spot_reports
  for each row
  execute function public.spot_reports_enforce_clean_text();

revoke all on function public.spot_reports_text_haystack(text, text) from public;
revoke all on function public.spot_reports_text_is_blocked(text, text) from public;
revoke all on function public.spot_reports_enforce_clean_text() from public;

grant execute on function public.spot_reports_text_haystack(text, text) to authenticated, service_role;
grant execute on function public.spot_reports_text_is_blocked(text, text) to authenticated, service_role;
grant execute on function public.spot_reports_enforce_clean_text() to authenticated, service_role;
