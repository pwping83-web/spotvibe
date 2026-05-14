/**
 * 시각장애인 이웃 도움 메시지 음성 — Web Speech API.
 * 기기에 설치된 한국어 음성 중 Google·Microsoft 등 우선 선택(고급 엔진이 있으면 자동).
 */
function pickPreferredKoreanVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const ko = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('ko'));
  if (!ko.length) return null;
  const score = (v: SpeechSynthesisVoice) => {
    const n = (v.name || '').toLowerCase();
    let s = 0;
    if (n.includes('google')) s += 40;
    if (n.includes('microsoft')) s += 30;
    if (n.includes('samsung')) s += 25;
    if (n.includes('premium') || n.includes('neural') || n.includes('natural')) s += 35;
    if (n.includes('heami') || n.includes('yuna') || n.includes('narae')) s += 20;
    if (v.localService) s += 5;
    return s;
  };
  return [...ko].sort((a, b) => score(b) - score(a))[0] ?? ko[0];
}

let voicesPrimed = false;
function primeVoices(): void {
  if (voicesPrimed || typeof window === 'undefined' || !window.speechSynthesis) return;
  voicesPrimed = true;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    window.speechSynthesis.getVoices();
  });
}

/**
 * 이웃이 보낸 짧은 안내를 읽어 줌. 같은 시각 연속 호출은 앞선 읽기를 취소.
 */
export function speakViNeighborMessage(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  primeVoices();
  const ss = window.speechSynthesis;
  ss.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  const v = pickPreferredKoreanVoice();
  if (v) u.voice = v;
  u.rate = 0.9;
  u.pitch = 1;
  u.volume = 1;
  ss.speak(u);
}

export function stopViNeighborSpeech(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
