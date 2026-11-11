# Deployment

NXSPACE is a static site. There is no install, dependency, build command or generated output directory.

## GitHub Pages

1. Publish the repository root from the selected branch.
2. Open `https://<account>.github.io/nxspace/` and `https://<account>.github.io/nxspace/admin/`.
3. Public and Dashboard navigation use hash routes, so refresh does not require server rewrites.
4. `404.html` returns unknown server paths to the project Home route and preserves the repository base path.

## Cloudflare Pages

- Framework preset: None
- Build command: leave empty
- Build output directory: `/` (repository root)
- Root directory: repository root
- Environment variables: none for Local/Static Demo
- `_headers` supplies baseline static security headers and disables Dashboard caching.

Preview and Production deployments must verify both entry points, asset paths, module MIME types and the Package 09 acceptance checklist. Protected writes must use a separate Worker/backend; never place a Secret in Pages variables consumed by browser JavaScript.
