import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vite-plus/test';
import { ROUTES } from 'shared/constants';

// netlify.toml answers 404 for any path without its own 200 rule, so every
// client-side route needs one. Both files are read as text: AppRoutes.tsx
// can't be imported here (see the react-router-dom note in NavDrawer.test.tsx).
const appRoutesSource = readFileSync(
    new URL('./AppRoutes.tsx', import.meta.url),
    'utf8'
);
const netlifyToml = readFileSync(
    new URL('../../../netlify.toml', import.meta.url),
    'utf8'
);

// Matches both `<Route path="/login">` and `{ path: '/create', ... }`. "/" is
// index.html itself and "*" is the NotFound route, so neither needs a rule.
const routePaths = [
    ...appRoutesSource.matchAll(/\bpath(?:=|:\s*)["']([^"']+)["']/g),
]
    .map(([, path]) => path)
    .filter((path): path is string => !!path && path !== '/' && path !== '*');

const redirects = netlifyToml
    .split(/^\[\[redirects\]\]\s*$/m)
    .slice(1)
    .map((section) => {
        const block = section.split(/^\[/m)[0] ?? '';
        const field = (key: string) =>
            new RegExp(`^${key}\\s*=\\s*"?([^"\\n]*)"?`, 'm').exec(block)?.[1];
        return {
            from: field('from'),
            to: field('to'),
            status: Number(field('status')),
        };
    });

const shellRules = redirects
    .filter(({ to, status }) => to === '/index.html' && status === 200)
    .map(({ from }) => from ?? '');

// React Router and Netlify both spell params `:name`; only the names differ.
const normalize = (path: string) => path.replace(/:\w+/g, ':param');
const shellRuleSet = new Set(shellRules.map(normalize));

describe('netlify.toml SPA rules', () => {
    it('finds the routes in AppRoutes.tsx', () => {
        expect(routePaths).toContain('/login');
        expect(routePaths).toContain('/view/:id');
        expect(routePaths).toContain('/study/:studysetId/:mode');
    });

    it('has a 200 rule for every route in AppRoutes.tsx', () => {
        const missing = routePaths.filter(
            (path) => !shellRuleSet.has(normalize(path))
        );
        expect(missing).toEqual([]);
    });

    // React Router matches case-insensitively but Netlify doesn't, so the
    // exact spelling the app links to needs its own rule.
    it('has a 200 rule for every path in ROUTES', () => {
        const missing = Object.values(ROUTES).filter(
            (path) => !shellRuleSet.has(normalize(path))
        );
        expect(missing).toEqual([]);
    });

    it('has no 200 rule for a route that no longer exists', () => {
        const known = new Set(
            routePaths.map((path) => normalize(path).toLowerCase())
        );
        const stale = shellRules.filter(
            (from) => !known.has(normalize(from).toLowerCase())
        );
        expect(stale).toEqual([]);
    });

    // Netlify applies the first matching rule, so anything after the
    // catch-all can never match.
    it('ends with the 404 catch-all', () => {
        expect(redirects.at(-1)).toEqual({
            from: '/*',
            to: '/index.html',
            status: 404,
        });
    });
});
