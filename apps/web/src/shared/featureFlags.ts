// A function rather than a constant so tests can flip the flag with vi.stubEnv.
export const isPublishEnabled = (): boolean =>
    import.meta.env.VITE_FEATURE_PUBLISH === 'true';
