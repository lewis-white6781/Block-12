// crypto.randomUUID() only exists in secure contexts (https, localhost). This app is
// meant to run offline on a phone, often reached over plain http on a LAN — an insecure
// context where randomUUID is undefined and calling it throws, silently killing whatever
// click handler called it (e.g. logging a set). crypto.getRandomValues() has no such
// restriction, so it's the fallback; Math.random() only backstops environments with
// neither.
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
