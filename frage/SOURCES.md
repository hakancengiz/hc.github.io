# Sources

FRAGE is designed as an offline-first French-Turkish dictionary. The current repository contains a small development data package and metadata files that model how larger packages should be attributed.

## Current Metadata Files

- `data/metadata.json`: package name, version, build date, entry count, and runtime files.
- `data/attributions.json`: source names, URLs, licenses, and planned usage.
- `THIRD_PARTY_NOTICES.md`: third-party runtime notices, currently including sql.js.
- `DATA_LICENSES.md`: data-license separation and distribution rules.

## Planned Source List

### FreeDict French-Turkish

- URL: https://freedict.org/downloads/
- Planned use: direct French-Turkish translation layer.
- Requirement: preserve source dictionary license and notices.

### Wiktionary via Kaikki/Wiktextract

- URL: https://kaikki.org/dictionary/French/
- Planned use: definitions, parts of speech, forms, pronunciation metadata.
- Requirement: preserve attribution and any share-alike obligations for derived content.

### Tatoeba

- URL: https://tatoeba.org/
- Planned use: French example sentences and Turkish translations.
- Requirement: preserve sentence-level license and attribution metadata when available.

## Build Expectation

Future large-data builds should generate or update:

- source dump dates
- processing/build date
- source file checksums where practical
- entry-level source ids
- sentence-level source/license metadata for examples
