-- SOS 현장 사진 URL + AI 요약(유형 일치·규모 등)
alter table public.sos_signals
  add column if not exists photo_url text,
  add column if not exists ai_photo_summary text;

comment on column public.sos_signals.photo_url is '공개 스토리지(sos-photos) 사진 URL — 없으면 텍스트만 신호';
comment on column public.sos_signals.ai_photo_summary is 'Groq 비전 한 줄 요약(예: 연기 규모·화재 추정)';

-- SOS 현장 사진 버킷 (spot-photos와 동일 패턴: 공개 읽기, 본인 폴더만 업로드)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sos-photos',
  'sos-photos',
  true,
  10485760,
  null
)
on conflict (id) do nothing;

drop policy if exists "auth users upload sos photos" on storage.objects;
drop policy if exists "public read sos photos" on storage.objects;
drop policy if exists "auth users delete own sos photos" on storage.objects;

create policy "auth users upload sos photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'sos-photos'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  );

create policy "public read sos photos"
  on storage.objects for select
  to public
  using (bucket_id = 'sos-photos');

create policy "auth users delete own sos photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'sos-photos'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  );
