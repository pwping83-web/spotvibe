export const PHOTO_CATEGORIES = [
  { key: 'scenery',    label: '풍경',  emoji: '🏙️' },
  { key: 'night',      label: '야경',  emoji: '🌙' },
  { key: 'busking',    label: '버스킹', emoji: '🎸' },
  { key: 'food',       label: '음식',  emoji: '🍜' },
  { key: 'cafe',       label: '카페',  emoji: '☕' },
  { key: 'shopping',   label: '쇼핑',  emoji: '🛍️' },
  { key: 'festival',   label: '축제',  emoji: '🎉' },
  { key: 'sports',     label: '운동',  emoji: '⚽' },
  { key: 'nature',     label: '자연',  emoji: '🌿' },
  { key: 'club',       label: '클럽',  emoji: '🎵' },
  { key: 'exhibition', label: '전시',  emoji: '🎨' },
  { key: 'daily',      label: '일상',  emoji: '📸' },
] as const;

export type PhotoCategoryKey = typeof PHOTO_CATEGORIES[number]['key'];

/** 갤러리 탭용 — "전체" 포함 */
export const PHOTO_GALLERY_TABS = [
  { key: 'all' as const, label: '전체', emoji: '🌐' },
  ...PHOTO_CATEGORIES,
];

export type GalleryCategoryKey = 'all' | PhotoCategoryKey;
