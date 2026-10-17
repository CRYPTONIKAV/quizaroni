import type { Context } from '@netlify/edge-functions';
import { resolveSite } from '../lib/site.ts';

// Netlify Edge Functions run on Deno, not Node. This directory is outside
// tsconfig.json's `include`, so it gets no ambient Deno types — declare just
// the slice of the API this file actually calls.
declare const Deno: { env: { get(key: string): string | undefined } };

/**
 * Per-set Open Graph / Twitter meta for public study sets.
 *
 * Quizaroni is a client-rendered SPA: the HTML that crawlers and social
 * scrapers receive is a static shell with generic meta tags, so a shared
 * `/view/:id` link previews as the generic app everywhere. This edge function
 * runs on `/view/*`, fetches the (public) set from the API, and rewrites the
 * <title> + OG/Twitter/description/canonical tags in the shell before it is
 * served — so link unfurls and search snippets reflect the actual set.
 *
 * It runs before netlify.toml's redirects, so `context.next()` returns
 * whatever they serve. Non-HTML and non-200 responses (e.g. the catch-all 404
 * for `/view/<id>/extra`) pass through untouched. Otherwise the set comes
 * from the same unauthenticated endpoint the client uses
 * (`/api/public/studyset/:id`):
 *
 * - Public set: the tags above are rewritten for the set.
 * - API 404 (private or nonexistent; the API doesn't say which): the shell,
 *   still 200, marked noindex and stripped of its canonical/OG/Twitter tags.
 * - Any other API failure: the shell, unchanged.
 *
 * Outside production, URLs use the request's own origin and rewritten pages
 * are noindex (see ../lib/site.ts).
 */

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

/**
 * Replaces a tag matched by `regex` if present; otherwise leaves html as-is.
 * The replacement goes through a function so `$&`, `$'` etc. in set titles
 * are inserted literally instead of as replacement patterns.
 */
const replaceTag = (html: string, regex: RegExp, replacement: string): string =>
    regex.test(html) ? html.replace(regex, () => replacement) : html;

const addNoindex = (html: string): string =>
    html.replace(
        '</head>',
        '<meta name="robots" content="noindex" />\n</head>'
    );

/** Drops the shell's canonical/OG/Twitter tags, which all name the home page. */
const stripIdentityTags = (html: string): string =>
    html
        .replace(/\s*<link\s+rel="canonical"[^>]*>/g, '')
        .replace(/\s*<meta\s+(?:property="og:|name="twitter:)[^>]*>/g, '');

const serveShell = (
    html: string,
    from: Response,
    indexable: boolean
): Response => {
    const headers = new Headers(from.headers);
    headers.set('content-type', 'text/html; charset=utf-8');
    // One policy whether or not the set was found: it's the same URL, its
    // answer flips with the set's visibility, and neither answer is per-user.
    // Netlify doesn't cache edge-function output without `cache = "manual"`,
    // so this still runs (and calls the API) on every request; s-maxage only
    // bounds shared caches downstream, and browsers revalidate every time.
    headers.set('cache-control', 'public, max-age=0, s-maxage=300');
    headers.delete('content-length');
    // The copied ETag is the untouched shell's, but the body now varies.
    headers.delete('etag');
    if (indexable) {
        return new Response(html, { status: 200, headers });
    }
    headers.set('x-robots-tag', 'noindex');
    return new Response(addNoindex(html), { status: 200, headers });
};

type PublicSet = {
    title?: string;
    description?: string;
    username?: string | null;
    cards?: unknown[];
};

export default async (request: Request, context: Context) => {
    // Read lazily inside the handler, not at module top level: Netlify's
    // build-time edge-function bundler evaluates this module to extract its
    // config before deploy, when site env vars aren't injected yet — a
    // top-level throw here fails the build itself, not just a bad request.
    // The deployed AWS API Gateway (matches BASE_API_URL in the web app),
    // set as a Netlify site env var, visible to edge functions regardless of
    // the VITE_ prefix. We call the API directly rather than through
    // netlify.toml's redirects — there is no `/api/*` proxy to rely on.
    const API_BASE = Deno.env.get('API_BASE_URL');
    if (!API_BASE) {
        throw new Error('API_BASE_URL env var is not set');
    }

    const response = await context.next();

    // Non-HTML, or a path netlify.toml already answered with 404 (e.g.
    // /view/<id>/extra) — leave it alone rather than dress it up as the set.
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') || response.status !== 200) {
        return response;
    }

    const url = new URL(request.url);
    const id = url.pathname.split('/view/')[1]?.split('/')[0] ?? '';
    if (!id) {
        return response;
    }

    let set: PublicSet | null = null;
    let notFound = false;
    try {
        const apiResponse = await fetch(
            `${API_BASE}/public/studyset/${encodeURIComponent(id)}`,
            { headers: { accept: 'application/json' } }
        );
        if (apiResponse.ok) {
            const payload = await apiResponse.json();
            set = payload?.studyset ?? null;
        } else {
            notFound = apiResponse.status === 404;
        }
    } catch {
        // Network/API failure — fall through and serve the default shell.
    }

    // Private or nonexistent set; the API answers 404 for both. Not an HTTP
    // 404: an owner opening their own private set in a fresh tab gets this
    // same document, and an API 404 for any other reason would turn every set
    // page into one. Crawlers get noindex and no claim to the home page.
    if (notFound) {
        return serveShell(
            stripIdentityTags(await response.text()),
            response,
            false
        );
    }

    if (!set || !set.title) {
        return response;
    }

    const title = escapeHtml(set.title);
    const cardCount = Array.isArray(set.cards) ? set.cards.length : 0;
    const author = set.username ? ` by ${set.username}` : '';
    const description = escapeHtml(
        (set.description && set.description.trim()) ||
            `${cardCount} flashcard${
                cardCount === 1 ? '' : 's'
            }${author} — study free on Quizaroni.`
    );
    const pageTitle = `${title} · Quizaroni`;
    const site = resolveSite(request, context);
    const canonical = `${site.origin}/view/${id}`;

    let html = await response.text();

    html = replaceTag(
        html,
        /<title>[\s\S]*?<\/title>/,
        `<title>${pageTitle}</title>`
    );
    html = replaceTag(
        html,
        /<meta\s+name="description"[^>]*>/,
        `<meta name="description" content="${description}" />`
    );
    html = replaceTag(
        html,
        /<link\s+rel="canonical"[^>]*>/,
        `<link rel="canonical" href="${canonical}" />`
    );
    html = replaceTag(
        html,
        /<meta\s+property="og:type"[^>]*>/,
        `<meta property="og:type" content="article" />`
    );
    html = replaceTag(
        html,
        /<meta\s+property="og:url"[^>]*>/,
        `<meta property="og:url" content="${canonical}" />`
    );
    html = replaceTag(
        html,
        /<meta\s+property="og:title"[^>]*>/,
        `<meta property="og:title" content="${pageTitle}" />`
    );
    html = replaceTag(
        html,
        /<meta\s+property="og:description"[^>]*>/,
        `<meta property="og:description" content="${description}" />`
    );
    html = replaceTag(
        html,
        /<meta\s+name="twitter:title"[^>]*>/,
        `<meta name="twitter:title" content="${pageTitle}" />`
    );
    html = replaceTag(
        html,
        /<meta\s+name="twitter:description"[^>]*>/,
        `<meta name="twitter:description" content="${description}" />`
    );

    // The shell's large image is a capture of the landing page, which under a
    // set's title would pass for a preview of the set. Set pages get the
    // square app icon and a small summary card instead.
    const image = `${site.origin}/icon-512x512.png`;
    html = replaceTag(
        html,
        /<meta\s+property="og:image"[^>]*>/,
        `<meta property="og:image" content="${image}" />`
    );
    html = replaceTag(
        html,
        /<meta\s+property="og:image:width"[^>]*>/,
        `<meta property="og:image:width" content="512" />`
    );
    html = replaceTag(
        html,
        /<meta\s+property="og:image:height"[^>]*>/,
        `<meta property="og:image:height" content="512" />`
    );
    html = replaceTag(
        html,
        /<meta\s+property="og:image:alt"[^>]*>/,
        `<meta property="og:image:alt" content="Quizaroni flashcard set: ${title}" />`
    );
    html = replaceTag(
        html,
        /<meta\s+name="twitter:card"[^>]*>/,
        `<meta name="twitter:card" content="summary" />`
    );
    html = replaceTag(
        html,
        /<meta\s+name="twitter:image"[^>]*>/,
        `<meta name="twitter:image" content="${image}" />`
    );

    return serveShell(html, response, site.indexable);
};

// The `/view/*` path binding is declared in netlify.toml ([[edge_functions]])
// so all routing lives in one place.
