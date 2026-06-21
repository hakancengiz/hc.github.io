# FRAGE

FRAGE is an offline-first French-Turkish dictionary prototype.

## Current Runtime

- Static web app: `index.html`, `assets/app.css`, `assets/app.js`
- Data worker: `assets/db-worker.js`
- SQLite WASM runtime: `vendor/sql-wasm.js`, `vendor/sql-wasm.wasm`
- Worker loads `core.sqlite` and `forms.sqlite` for search, then lazy-loads `examples.sqlite` when entry details need examples.
- Recent searches are stored in `localStorage` when available, with an in-memory fallback for restricted browser contexts.
- Favorites use the same storage pattern and appear as quick-access chips below the search bar.
- Entry details show available inflected forms as clickable chips when form data exists.
- Search result match types are rendered as Turkish labels, with a short explanation in the entry detail panel.
- Search input uses a 160 ms debounce and shows lightweight skeleton result placeholders while queries are running.
- Entry details include a copy action for headword, translation, first definition, and first example.
- Example sentences can be filtered between French+Turkish, French only, and Turkish only views.
- Example cards show their source label so attribution stays visible in context.
- Result navigation keeps `aria-activedescendant` in sync and supports ArrowUp, ArrowDown, Home, and End from the search input.
- Example display mode is persisted when browser storage is available.
- The source/license dialog traps keyboard focus while open and restores focus on close.
- Search accepts French elision variants such as `l'école` and maps them to the underlying headword when possible.
- Source URLs are clickable in the source/license dialog.
- Data license and source tracking live in `DATA_LICENSES.md` and `SOURCES.md`.
- `manifest.webmanifest` and `sw.js` provide install metadata and a static offline cache when served over HTTP/HTTPS.
- Favorites can be exported to and imported from a JSON file.
- Release prep tasks are tracked in `RELEASE_CHECKLIST.md`.
- Model 2 data package:
  - `data/core.sqlite`
  - `data/forms.sqlite`
  - `data/examples.sqlite`
  - JS fallback files: `data/core.js`, `data/forms.js`, `data/examples.js`


## Opening The App

You can open `index.html` directly with a `file:///` URL. In that mode, browsers commonly block Worker/WASM/database file loading, so FRAGE intentionally uses the JS data fallback and shows `JS veri hazır (dosya modu)`.

Service worker caching and the SQLite WASM worker require an HTTP/HTTPS origin. They are intentionally not registered in `file:///` mode.

To verify the SQLite WASM runtime, serve the folder with a local static server and open the HTTP URL, for example:

```powershell
node -e "require('http').createServer((req,res)=>{const fs=require('fs'),path=require('path');const p=path.join(process.cwd(),decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/, '')||'index.html');fs.readFile(p,(e,d)=>{res.writeHead(e?404:200);res.end(e?'Not found':d)})}).listen(4173,'127.0.0.1')"
```

Then open `http://127.0.0.1:4173/`. In that mode the status should show `SQLite veri hazır`.

## Import Source Data

Large data sources should first be converted into FRAGE's normalized source package format, then merged into `data/source-seed.json`:

```powershell
python tools\build-data\convert_freedict_tei.py --input freedict-fra-tur.tei --output converted-freedict.json --source "FreeDict"
python tools\build-data\import_source_package.py --input converted-freedict.json --source "FreeDict"

python tools\build-data\convert_kaikki_jsonl.py --input kaikki-french.jsonl --output converted-kaikki.json --source "Wiktionary/Kaikki"
python tools\build-data\import_source_package.py --input converted-kaikki.json --source "Wiktionary/Kaikki"

python tools\build-data\convert_tatoeba_examples.py --fr-sentences sentences_fra.tsv --tr-sentences sentences_tur.tsv --links links.tsv --output converted-tatoeba.json --source "Tatoeba"
python tools\build-data\import_source_package.py --input converted-tatoeba.json --source "Tatoeba"

python tools\build-data\build_packages.py
```

The Tatoeba converter uses the current seed headwords and forms to attach short French sentences to matching entries when a linked Turkish sentence exists.

The importer accepts JSON, JSONL, or a JSON object with an `entries` array. Each entry can include `headword`, `pos`, `ipa`, `translations`, `definitions`, `forms`, and `examples`. It de-duplicates by normalized headword and part of speech, merges translations/sources, and assigns FRAGE ids for new senses, forms, and examples. Use `--dry-run` to preview counts before writing.

## Real Data Pipeline

The production data flow works only with local source exports. It never fetches raw source data in the browser and it does not overwrite the small development seed. A single command produces a generated seed, lazy SQLite shards, prefix search indexes, and a provenance record containing input hashes.

The browser fetches only the small index bucket for the typed query. It fetches the matching SQLite shard only when an entry is opened, then the service worker caches that shard for later use. Raw source dumps are never published to the client.

```powershell
python tools\build-data\build_data_pipeline.py `
  --base-seed data\source-seed.json `
  --freedict C:\data\freedict-fra-tur.tei `
  --kaikki C:\data\kaikki-french.jsonl `
  --tatoeba-fr C:\data\sentences_fra.tsv `
  --tatoeba-tr C:\data\sentences_tur.tsv `
  --tatoeba-links C:\data\links.tsv `
  --output-seed data\generated\source-seed.json `
  --output-dir data `
  --shard-prefix-length 2
```

The generated `build-provenance.json` records SHA-256 hashes, file sizes, import counters, and the final entry counts. Review source licenses and attribution before publishing a generated package; keep the raw downloads outside the public project directory.

## Build Data

Use the bundled Python runtime or any Python 3 with `sqlite3`:

```powershell
python tools\build-data\build_packages.py
```

In this Codex desktop workspace, the bundled runtime path is:

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" tools\build-data\build_packages.py
```

## Build Release

Run the full static release pipeline:

```powershell
python tools\build-data\build_release.py
```

This generates `data/quality-report.json`, refreshes `release-manifest.json`, verifies the static package, runs smoke tests, creates `dist/frage-static.zip`, and checks that the zip contents match the manifest.

## Verify Data

```powershell
python tools\build-data\smoke_test.py
```

## Verify Static Package

```powershell
python tools\build-data\verify_static_package.py
```

## Text Integrity Check

```powershell
python tools\build-data\check_text_integrity.py
```

This catches common UTF-8 mojibake and suspicious Turkish placeholder text before release.

## Data Quality Report

```powershell
python tools\build-data\quality_report.py
python tools\build-data\quality_report.py --json --output data\quality-report.json
```

## Release Manifest

```powershell
python tools\build-data\release_manifest.py
```

## Create Release Zip

```powershell
python tools\build-data\create_release_zip.py
```

For normal publishing, prefer `python tools\build-data\build_release.py` because it runs these checks in order before creating the zip.

Bundled runtime:

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" tools\build-data\smoke_test.py
```

The smoke test checks SQLite row counts, accent/form lookup, examples, metadata, and the JS fallback adapter.

## Licenses And Data Notices

Runtime code and dictionary data should be licensed separately. Third-party runtime notices are kept in `THIRD_PARTY_NOTICES.md`.
