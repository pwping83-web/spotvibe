import { useEffect, useRef, useState } from 'react';
import type { NormalizedFace } from '@tensorflow-models/blazeface';
import type { BlazeFaceModel } from '@tensorflow-models/blazeface';

let modelLoadPromise: Promise<BlazeFaceModel> | null = null;

async function getBlazeFaceModel(): Promise<BlazeFaceModel> {
  if (modelLoadPromise) return modelLoadPromise;
  modelLoadPromise = (async () => {
    const tf = await import('@tensorflow/tfjs');
    await tf.ready();
    const { load } = await import('@tensorflow-models/blazeface');
    return load({
      maxFaces: 6,
      scoreThreshold: 0.55,
    });
  })();
  return modelLoadPromise;
}

async function toXY(p: NormalizedFace['topLeft']): Promise<[number, number]> {
  if (Array.isArray(p)) return [p[0], p[1]];
  const t = p as { data: () => Promise<Float32Array | Int32Array | Uint8Array>; dispose: () => void };
  const d = await t.data();
  t.dispose();
  return [d[0], d[1]];
}

function mosaicRect(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ix = Math.max(0, Math.floor(x));
  const iy = Math.max(0, Math.floor(y));
  const iw = Math.min(canvas.width - ix, Math.max(1, Math.ceil(w)));
  const ih = Math.min(canvas.height - iy, Math.max(1, Math.ceil(h)));
  if (iw < 6 || ih < 6) return;

  const blocks = Math.max(8, Math.min(24, Math.floor(Math.min(iw, ih) / 6)));
  const bh = Math.max(4, Math.round((ih / iw) * blocks));
  const t = document.createElement('canvas');
  t.width = blocks;
  t.height = bh;
  const tctx = t.getContext('2d');
  if (!tctx) return;
  tctx.drawImage(canvas, ix, iy, iw, ih, 0, 0, blocks, bh);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(t, 0, 0, blocks, bh, ix, iy, iw, ih);
  ctx.imageSmoothingEnabled = true;
  ctx.restore();
}

const MAX_PROCESS_SIDE = 640;

/** 미리보기·업로드용: 이미지 URL(blob/data/http)에서 얼굴 영역 모자이크 JPEG data URL 생성 */
export async function buildFaceMosaicDataUrl(imageUrl: string): Promise<string | null> {
  const img = new Image();
  // blob/data는 crossOrigin 없이 · 외부 URL은 CORS로 캔버스 export 가능하게
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    img.crossOrigin = 'anonymous';
  }
  img.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image load'));
    img.src = imageUrl;
  });

  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (nw < 2 || nh < 2) return null;

  const scale = Math.min(1, MAX_PROCESS_SIDE / Math.max(nw, nh));
  const cw = Math.max(1, Math.round(nw * scale));
  const ch = Math.max(1, Math.round(nh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, cw, ch);

  const model = await getBlazeFaceModel();
  const faces = await model.estimateFaces(canvas, false, false, false);

  if (faces.length === 0) {
    return canvas.toDataURL('image/jpeg', 0.88);
  }

  for (const face of faces) {
    const [x1, y1] = await toXY(face.topLeft);
    const [x2, y2] = await toXY(face.bottomRight);
    let fx = Math.min(x1, x2);
    let fy = Math.min(y1, y2);
    let fw = Math.abs(x2 - x1);
    let fh = Math.abs(y2 - y1);
    const padX = fw * 0.12;
    const padY = fh * 0.12;
    fx -= padX;
    fy -= padY;
    fw += padX * 2;
    fh += padY * 2;
    fx = Math.max(0, fx);
    fy = Math.max(0, fy);
    fw = Math.min(cw - fx, fw);
    fh = Math.min(ch - fy, fh);
    if (fw > 2 && fh > 2) {
      mosaicRect(ctx, canvas, fx, fy, fw, fh);
    }
  }

  try {
    return canvas.toDataURL('image/jpeg', 0.88);
  } catch {
    return null;
  }
}

export interface FaceMosaicImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}

export function FaceMosaicImage({ src, alt, className, imgClassName }: FaceMosaicImageProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    setDataUrl(null);
    setFailed(false);
    const id = ++seq.current;
    let cancelled = false;

    (async () => {
      try {
        const out = await buildFaceMosaicDataUrl(src);
        if (cancelled || seq.current !== id) return;
        if (out) setDataUrl(out);
        else setFailed(true);
      } catch {
        if (!cancelled && seq.current === id) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  const processing = !failed && dataUrl === null;
  const showSrc = failed || dataUrl === null;

  return (
    <div className={className ?? 'relative h-full w-full'}>
      <img
        src={showSrc ? src : dataUrl!}
        alt={alt}
        className={
          (imgClassName ?? '') +
          (processing ? ' scale-[1.03] blur-[10px] transition-[filter] duration-300' : '')
        }
        loading="lazy"
        decoding="async"
      />
      {processing ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
          <span className="rounded-full bg-black/45 px-2.5 py-1 text-[9px] font-medium text-white/85">
            얼굴 모자이크 처리 중…
          </span>
        </div>
      ) : null}
    </div>
  );
}
