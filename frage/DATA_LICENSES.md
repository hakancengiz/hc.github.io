# Data Licenses

FRAGE separates application code from dictionary data. This file documents the data package that ships with the app and the obligations that must be preserved when larger packages are generated.

## Current Package

The checked-in runtime uses lazy SQLite shards generated from the FreeDict French-Turkish 2025.11.23 release, enriched with Kaikki forms and Tatoeba examples. The small JS and full SQLite files remain only as a `file:///` development fallback:

- `data/core.js`
- `data/forms.js`
- `data/examples.js`
- `data/core.sqlite`
- `data/forms.sqlite`
- `data/examples.sqlite`

The production shards are stored under `data/shards/`; their source hashes and build stages are recorded in `data/build-provenance.json`.

## Planned Data Sources

The planned production package may combine data from:

| Source | Planned Use | License Notes |
| --- | --- | --- |
| FreeDict French-Turkish | French-Turkish translations | Preserve the source dictionary license and notices. |
| Wiktionary via Kaikki/Wiktextract | definitions, parts of speech, forms, pronunciation metadata | Wiktionary-derived content can carry CC BY-SA obligations. Attribution and compatible share-alike terms must be preserved. |
| Tatoeba | example sentences and translations | Sentence-level license/attribution metadata must be preserved; licenses can vary by sentence. |

## Distribution Rules

- Keep source attribution visible in the app and repository.
- Keep data license metadata with every generated package.
- Do not mix code license and data license into a single vague statement.
- If CC BY-SA-derived content is included, publish the derived data package under compatible terms.
- For Tatoeba examples, preserve sentence-level attribution and license metadata when available.

## Runtime Notice

Web Speech API pronunciation is a browser/runtime feature. It is not part of the FRAGE dictionary data package and does not add a data license obligation to the repository.
