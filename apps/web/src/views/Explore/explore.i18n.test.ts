import { describe, it, expect } from 'vite-plus/test';
import i18n from 'i18n/index';
import en from 'i18n/locales/en/explore.json';
import es from 'i18n/locales/es/explore.json';

const flatKeys = (obj: object, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([key, value]) =>
        typeof value === 'object' && value !== null
            ? flatKeys(value, `${prefix}${key}.`)
            : [`${prefix}${key}`]
    );

describe('explore i18n namespace', () => {
    it('has the same keys in en and es', () => {
        expect(flatKeys(es).sort()).toEqual(flatKeys(en).sort());
    });

    it('is registered for both languages', () => {
        expect(i18n.hasResourceBundle('en', 'explore')).toBe(true);
        expect(i18n.hasResourceBundle('es', 'explore')).toBe(true);
    });
});
