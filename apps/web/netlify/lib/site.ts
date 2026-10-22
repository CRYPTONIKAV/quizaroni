import type { Context } from '@netlify/edge-functions';

// Shared by the edge functions in ../edge-functions. It lives outside that
// directory so Netlify doesn't try to deploy it as a function of its own.
// index.html and public/robots.txt are static and repeat this origin by hand.

// The site also answers on quizaroni.netlify.app and deploy-preview hosts;
// canonical URLs always name the custom domain so search engines and link
// unfurls settle on one URL.
export const SITE_ORIGIN = 'https://quizaroni.yusufaf.dev';

export type Site = {
    origin: string;
    indexable: boolean;
};

/**
 * Production names SITE_ORIGIN whichever host served the request. Deploy
 * previews, branch deploys and `netlify dev` name their own origin and are
 * noindex, so they never claim a production URL.
 */
export const resolveSite = (request: Request, context: Context): Site => {
    // A missing deploy context counts as production: wrongly noindexing
    // production would drop every public set from search, while a preview
    // naming the production origin only repeats the old behavior.
    const deployContext = context.deploy?.context ?? 'production';
    return deployContext === 'production'
        ? { origin: SITE_ORIGIN, indexable: true }
        : { origin: new URL(request.url).origin, indexable: false };
};
