import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files directly for bundling
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enStudy from './locales/en/study.json';
import enProfile from './locales/en/profile.json';
import enAi from './locales/en/ai.json';
import enExplore from './locales/en/explore.json';

import esCommon from './locales/es/common.json';
import esAuth from './locales/es/auth.json';
import esStudy from './locales/es/study.json';
import esProfile from './locales/es/profile.json';
import esAi from './locales/es/ai.json';
import esExplore from './locales/es/explore.json';

export const SUPPORTED_LANGUAGES = {
    en: { nativeName: 'English' },
    es: { nativeName: 'Español' },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

i18n.use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: {
                common: enCommon,
                auth: enAuth,
                study: enStudy,
                profile: enProfile,
                ai: enAi,
                explore: enExplore,
            },
            es: {
                common: esCommon,
                auth: esAuth,
                study: esStudy,
                profile: esProfile,
                ai: esAi,
                explore: esExplore,
            },
        },
        fallbackLng: 'en',
        defaultNS: 'common',
        ns: ['common', 'auth', 'study', 'profile', 'ai', 'explore'],
        interpolation: {
            escapeValue: false, // React already escapes
        },
        detection: {
            order: ['localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage'],
            lookupLocalStorage: 'i18nextLng',
        },
    });

export default i18n;
