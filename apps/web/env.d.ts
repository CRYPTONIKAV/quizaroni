/// <reference types="vite-plus/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
    readonly VITE_AWS_API_KEY: string;
    readonly VITE_LOGTO_ENDPOINT: string;
    readonly VITE_LOGTO_APP_ID: string;
    readonly VITE_LOGTO_API_RESOURCE: string;
    readonly VITE_API_BASE_URL: string;
    readonly VITE_FEATURE_PUBLISH?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
}
