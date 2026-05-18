-- 관리자 제보·Storage 즉시 삭제 (Edge Function 미배포·로컬 개발에서도 동작)
create or replace function public.spot_photos_object_path_from_url(p_url text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  needle constant text := '/spot-photos/';
  pos int;
  raw text;
begin
  if p_url is null or trim(p_url) = '' then
    return null;
  end if;
  pos := position(needle in p_url);
  if pos = 0 then
    return null;
  end if;
  raw := substring(p_url from pos + length(needle));
  raw := trim(both '/' from raw);
  if raw = '' then
    return null;
  end if;
  return raw;
end;
$$;

revoke all on function public.spot_photos_object_path_from_url(text) from public;
grant execute on function public.spot_photos_object_path_from_url(text) to authenticated, service_role;

create or replace function public.admin_delete_spot_report(p_report_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_path text;
  v_deleted int;
begin
  if not (select public.is_spotvibe_admin()) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_report_id is null then
    return json_build_object('ok', false, 'error', 'report_id_required');
  end if;

  select photo_url into v_url
  from public.spot_reports
  where id = p_report_id;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  v_path := public.spot_photos_object_path_from_url(v_url);

  delete from public.spot_reports where id = p_report_id;
  get diagnostics v_deleted = row_count;

  if v_deleted < 1 then
    return json_build_object('ok', false, 'error', 'not_found_after_delete');
  end if;

  -- Storage 파일 경로를 클라이언트에 반환 (클라이언트가 Storage API로 삭제)
  return json_build_object('ok', true, 'deleted', true, 'photo_path', v_path);
exception
  when others then
    return json_build_object('ok', false, 'error', 'delete_failed', 'detail', sqlerrm);
end;
$$;

revoke all on function public.admin_delete_spot_report(uuid) from public;
grant execute on function public.admin_delete_spot_report(uuid) to authenticated;
