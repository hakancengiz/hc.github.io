# Release Checklist

Use this checklist before publishing FRAGE as a static/open-source package.

## Runtime

- Run `python tools\build-data\build_release.py`.
- Review `data\quality-report.json` for coverage and issue output.
- If debugging individual steps, run `smoke_test.py`, `verify_static_package.py`, `quality_report.py`, `release_manifest.py`, or `create_release_zip.py` directly.
- Serve the folder over HTTP and confirm the status pill shows `SQLite veri hazır`.
- Open `index.html` via `file:///` and confirm JS fallback mode still works.

## Data And Licenses

- Confirm `data/metadata.json` has the correct version, build date, and runtime files.
- Confirm `data/attributions.json` lists every data source used in the build.
- Update `DATA_LICENSES.md` and `SOURCES.md` when source data changes.
- Preserve sentence-level attribution/license metadata for examples when available.
- For a real-data release, retain the generated `build-provenance.json` beside the published data package and review its source hashes.

## UI QA

- Check light and dark mode.
- Check search, form matches, accentless matches, and elision searches like `l'école`.
- Check favorites, recent searches, example filters, copy action, and pronunciation action.
- Check keyboard navigation: Ctrl/Cmd+K, ArrowUp/Down, Home, End, Escape.
- Check source/license modal focus trap and external links.

## Packaging

- Bump cache query versions in `index.html`, `assets/app.js`, and `sw.js` when cached files change.
- Confirm `manifest.webmanifest`, `assets/icon.svg`, and `sw.js` are present.
- If distributing as a zip/release artifact, include docs and license notices.
- Include `release-manifest.json` so recipients can verify file sizes and SHA-256 checksums.
- Include `data/build-provenance.json` with real-data releases so source processing can be audited.
- Confirm `dist/frage-static.zip` opens and contains the files listed in `release-manifest.json`.
