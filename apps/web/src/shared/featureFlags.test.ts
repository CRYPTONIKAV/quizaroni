import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { isPublishEnabled } from './featureFlags';

describe('isPublishEnabled', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it.each(['', 'false', '1', 'TRUE'])('is off for %p', (value) => {
        vi.stubEnv('VITE_FEATURE_PUBLISH', value);
        expect(isPublishEnabled()).toBe(false);
    });

    it('is on only for "true"', () => {
        vi.stubEnv('VITE_FEATURE_PUBLISH', 'true');
        expect(isPublishEnabled()).toBe(true);
    });
});
