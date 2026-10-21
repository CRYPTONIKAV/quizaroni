import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { HttpError, fetchJson, isHttpStatus } from './awsAPI';

const mockFetch = (response: Partial<Response> & { json?: () => unknown }) =>
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({}),
            text: async () => '',
            ...response,
        })
    );

describe('fetchJson', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('resolves with the parsed JSON body on a 2xx response', async () => {
        mockFetch({ json: async () => ({ hello: 'world' }) });

        const result = await fetchJson('https://example.com/api/thing');

        expect(result).toEqual({ hello: 'world' });
    });

    it('throws with the status included in the message on a non-2xx response', async () => {
        mockFetch({
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error',
        });

        await expect(
            fetchJson('https://example.com/api/thing')
        ).rejects.toThrow(/500/);
    });

    it('does not let a non-JSON error body mask the original status', async () => {
        mockFetch({
            ok: false,
            status: 502,
            text: async () => '<html>Bad Gateway</html>',
        });

        await expect(
            fetchJson('https://example.com/api/thing')
        ).rejects.toThrow(/502/);
    });

    it('exposes the status on the thrown error', async () => {
        mockFetch({
            ok: false,
            status: 404,
            text: async () => '{"message":"x"}',
        });

        const request = fetchJson('https://example.com/api/thing');

        await expect(request).rejects.toBeInstanceOf(HttpError);
        await expect(request).rejects.toMatchObject({ status: 404 });
    });
});

describe('isHttpStatus', () => {
    it.each([
        [new HttpError(404, 'x'), true],
        [new HttpError(500, 'x'), false],
        [new Error('404'), false],
        [null, false],
    ])('isHttpStatus(%o, 404) is %s', (error, expected) => {
        expect(isHttpStatus(error, 404)).toBe(expected);
    });
});
