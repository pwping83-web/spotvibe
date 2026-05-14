-- 모바일 카메라 MIME(image/heif, image/jpg 등)과 고해상도로 인한 업로드 실패 완화
update storage.buckets
set
  allowed_mime_types = array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[],
  file_size_limit = 15728640  -- 15MB
where id = 'spot-photos';
