# GitHub Pages and the existing SAI site

The public frontend is published at `https://sai-story-studio.github.io/experience/`. The original Sites URL remains available. Both frontends use the existing Sites server and D1 database for public registration; no applicant database, API secret, backup or local runtime record belongs in the public repository or Pages artifact.

`scripts/build-github-pages.mjs` copies only public assets, strips ancillary identity metadata from PNG copies and omits three unused legacy photos. It never copies application server files, `.openai`, `.env`, `.wrangler`, local logs or database files into Pages. The GitHub workflow builds and publishes that output on main updates.

Only the exact Pages origin is allowed on public configuration and registration routes. Browser requests from Pages omit cookies and authorization. Consent validation, request limits and payload checks remain on the server. Admin listing, exports, deletion and operator management keep their existing authenticated same-origin checks. Pages administrator entry points navigate to the original protected site so ChatGPT login continues to be verified by Sites.

The two URLs use one production database. A Pages deployment does not migrate or duplicate records. Backups are separate access-restricted local snapshots and are never committed. There is no automatic recurring backup unless it is separately configured.

Verify public preflights, unauthorized-origin rejection, denied unauthenticated admin access, static assets and both entry URLs after deployment. Do not submit real registrations or mutate production records for QA.
