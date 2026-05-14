-- 업로드 실패 완화: MIME 화이트리스트 제거(모바일 변종·빈 type 대응)
update storage.buckets
set allowed_mime_types = null
where id = 'spot-photos';

-- storage.foldername() 환경 차이 대비: 첫 경로 세그먼트 = auth.uid() 와 일치해야 업로드
drop policy if exists "auth users upload spot photos" on storage.objects;
drop policy if exists "auth users delete own spot photos" on storage.objects;

create policy "auth users upload spot photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'spot-photos'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  );

create policy "auth users delete own spot photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'spot-photos'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  );
