import type { Locale } from './locale.js';
import { enEvents, enSkills } from './catalog-translations/en.js';
import { ruEvents, ruSkills } from './catalog-translations/ru.js';
import { kkEvents, kkSkills } from './catalog-translations/kk.js';
import { departments, demo, enumLabels, rewards, roles, type DemoField } from './catalog-translations/labels.js';

export type CatalogKind = 'event' | 'skill' | 'role' | 'department' | 'reward' | 'demo';
export type CatalogField = 'title' | 'description' | 'deliverables' | 'criteria' | 'reason';
export type EnumKind = 'grade' | 'format' | 'eventType' | 'status' | 'skillType' | 'skillCategory' | 'proficiency';

/**
 * A presentation-only lookup. The immutable source catalog and imported data remain untouched.
 * A known ID is translated only when its original field matches our source snapshot: if an
 * imported or edited record reuses an ID, its own wording must not be replaced silently.
 */
export function catalogText(
  locale: Locale,
  kind: CatalogKind,
  id: string,
  original: string,
  field: CatalogField = 'title',
): string {
  if (kind === 'role' || kind === 'department') {
    const labels = (kind === 'role' ? roles : departments)[id];
    return labels && original === id ? labels[locale] : original;
  }
  if (kind === 'event' || kind === 'skill') {
    if (field !== 'title' && field !== 'description') return original;
    const index = field === 'title' ? 0 : 1;
    const source = kind === 'event' ? enEvents[id] : enSkills[id];
    const translated = kind === 'event'
      ? { ru: ruEvents, kk: kkEvents, en: enEvents }[locale][id]
      : { ru: ruSkills, kk: kkSkills, en: enSkills }[locale][id];
    return source && translated && original === source[index] ? translated[index] : original;
  }
  if (kind === 'reward') {
    if (field !== 'title' && field !== 'description') return original;
    const entry = rewards[id];
    const index = field === 'title' ? 0 : 1;
    return entry && original === entry.source[index] ? entry.text[locale][index] : original;
  }
  if (kind === 'demo') {
    const entry = demo[id]?.[field as DemoField];
    return entry && original === entry.source ? entry.text[locale] : original;
  }
  return original;
}

/** Controlled vocabulary only. Unknown values stay visible in their source language. */
export function enumText(locale: Locale, kind: EnumKind, value: string): string {
  return enumLabels[kind]?.[value]?.[locale] ?? value;
}
