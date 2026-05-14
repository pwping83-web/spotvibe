-- spot-photos 스토리지 버킷 생성
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'spot-photos',
  'spot-photos',
  true,                           -- public: 누구나 URL로 사진 열람 가능
  15728640,                       -- 15MB (고해상도 카메라)
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- 로그인 사용자는 자신의 폴더(user_id/)에 업로드 가능
create policy "auth users upload spot photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'spot-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 누구나 읽기 가능 (public 버킷)
create policy "public read spot photos"
  on storage.objects for select
  to public
  using (bucket_id = 'spot-photos');

-- 본인 파일만 삭제 가능
create policy "auth users delete own spot photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'spot-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
