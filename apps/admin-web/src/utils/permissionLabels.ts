import type { TFunction } from 'i18next';

/**
 * Localized display for a permission string like "feature_flag:manage".
 * Labels live in locale files under `permLabels.<resource>.<action>.{label,desc}`
 * (the permission's `:` is split so it doesn't collide with i18next's key
 * separators). Falls back to the raw permission string if no translation
 * exists, so a newly-added permission still renders something sensible.
 */
export function permLabel(t: TFunction, permission: string): string {
  const [resource, action] = permission.split(':');
  const key = `permLabels.${resource}.${action}.label`;
  const translated = t(key);
  return translated === key ? permission : translated;
}

export function permDescription(t: TFunction, permission: string): string {
  const [resource, action] = permission.split(':');
  const key = `permLabels.${resource}.${action}.desc`;
  const translated = t(key);
  return translated === key ? '' : translated;
}
