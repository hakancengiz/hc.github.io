# Third-Party Notices

## sql.js

FRAGE includes the sql.js WebAssembly runtime files:

- `vendor/sql-wasm.js`
- `vendor/sql-wasm.wasm`

The sql.js license text is preserved at:

- `vendor/sql.js-LICENSE`

Project source:

- https://github.com/sql-js/sql.js

## Dictionary Data Sources

The current checked-in data package is a small development fixture generated from `data/source-seed.json`.

The planned production data sources are documented in `data/attributions.json` and `PROJECT_PLAN.md`.


See also:

- `DATA_LICENSES.md`
- `SOURCES.md`


## Service Worker Cache

FRAGE includes a first-party `sw.js` file that caches local application, data, SQLite, and sql.js runtime files for offline use when served over HTTP/HTTPS. It does not introduce an additional third-party dependency.
