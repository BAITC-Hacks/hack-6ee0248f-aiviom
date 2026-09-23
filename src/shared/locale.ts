export type Locale = 'ru' | 'kk' | 'en';
export const LOCALES: readonly Locale[] = ['ru', 'kk', 'en'];

/** Accept-Language negotiation. Locale never changes domain calculations. */
export function normalizeLocale(input?: string | null): Locale {
  const candidates = (input ?? '').split(',').map((part, index) => {
    const [tag, ...parameters] = part.trim().split(';');
    const quality = parameters.find(p => p.trim().startsWith('q='));
    const q = quality ? Number(quality.trim().slice(2)) : 1;
    return { language: tag.toLowerCase().split('-')[0], q, index };
  }).filter(c => Number.isFinite(c.q) && c.q > 0 && c.q <= 1)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const candidate of candidates) {
    if (LOCALES.includes(candidate.language as Locale)) return candidate.language as Locale;
  }
  return 'ru';
}

export const localeTag = (locale: Locale): string => ({ ru: 'ru-RU', kk: 'kk-KZ', en: 'en-GB' })[locale];
