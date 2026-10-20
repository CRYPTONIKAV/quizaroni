import { describe, it, expect } from 'vite-plus/test';
import { SUBJECT_IDS } from '@quizaroni/shared-types';
import en from 'i18n/locales/en/common.json';
import es from 'i18n/locales/es/common.json';

const flatKeys = (obj: object, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([key, value]) =>
        typeof value === 'object' && value !== null
            ? flatKeys(value, `${prefix}${key}.`)
            : [`${prefix}${key}`]
    );

describe('publish strings', () => {
    it.each(['subjects', 'publish'] as const)(
        'has the same %s keys in en and es',
        (section) => {
            expect(flatKeys(es[section]).sort()).toEqual(
                flatKeys(en[section]).sort()
            );
        }
    );

    it.each(SUBJECT_IDS)('labels subject %s in en and es', (id) => {
        expect(en.subjects[id]).toBeTruthy();
        expect(es.subjects[id]).toBeTruthy();
    });
});
