/**
 * config/support-notice-recommend-heuristic.json — 고확률 Tier 1만 추리기
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {string} root 저장소 루트
 * @param {string} [relativePath] 기본 config/support-notice-recommend-heuristic.json
 */
export function loadRecommendHeuristic(root, relativePath) {
  const rel = relativePath || 'config/support-notice-recommend-heuristic.json';
  const p = path.isAbsolute(rel) ? rel : path.join(root, rel);
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { ...data, _path: p };
  } catch {
    return null;
  }
}

function titleHasAny(title, list) {
  if (!Array.isArray(list)) return false;
  return list.some((s) => s && title.includes(String(s)));
}

/**
 * @param {{ title?: string, source?: string }[]} items
 * @param {object | null} h
 */
export function pickTier1Items(items, h) {
  if (!h || !Array.isArray(items)) return [];

  const allowed = new Set(h.allowedRegionalBrackets || []);
  const useBracketGate = h.excludeTitleStartingWithBracketUnlessAllowed !== false;

  return items.filter((it) => {
    const title = String(it?.title || '');
    if (!title) return false;

    if (titleHasAny(title, h.excludeFromTier1Substring)) return false;

    const bracketM = title.match(/^\[([^\]]+)\]/);
    const bracket = bracketM ? `[${bracketM[1]}]` : null;
    if (useBracketGate && bracket && !allowed.has(bracket)) return false;

    const noise = h.industryNoiseSubstrings || [];
    const rescue = h.tier1RescueSubstrings || [];
    if (titleHasAny(title, noise) && !titleHasAny(title, rescue)) return false;

    if (titleHasAny(title, h.alwaysTier1IfSubstring)) return true;
    if (titleHasAny(title, h.tier1AnySubstring)) return true;

    const po = h.tier1PoC;
    if (po && titleHasAny(title, po.substrings || [])) {
      if (titleHasAny(title, po.excludeIfAlsoMatches || [])) return false;
      return true;
    }

    return false;
  });
}

/**
 * @param {{ title?: string }} it
 * @param {object | null} h
 */
export function tier1ReasonForItem(it, h) {
  const title = String(it?.title || '');
  const rules = h?.tier1ReasonRules;
  if (Array.isArray(rules)) {
    for (const r of rules) {
      const keys = r.ifTitleIncludes;
      if (!Array.isArray(keys)) continue;
      if (keys.some((k) => k && title.includes(String(k)))) return String(r.reason || '').trim();
    }
  }
  return String(h?.tier1ReasonDefault || '').trim() || 'Tier1 휴리스틱 통과. 원문으로 지원대상 확인.';
}

/**
 * @param {{ title?: string }[]} items
 * @param {object | null} h
 */
export function pickTier1ItemsWithReasons(items, h) {
  return pickTier1Items(items, h).map((it) => ({
    ...it,
    tier1Reason: tier1ReasonForItem(it, h),
  }));
}
