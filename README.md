# Core War Evolution Kennel

A dependency-free static Core War evolution toy: a public read-only specimen museum plus browser-local workbench. It has no backend, accounts, submissions, database, cron, CDN, or external API.

## Implemented Redcode profile

Profile `kennel94` is an explicit ICWS '94-inspired subset, not a full Core War implementation.

Supported:
- opcodes: `DAT`, `MOV`, `ADD`, `SUB`, `JMP`, `JMZ`, `JMN`, `DJN`, `SPL`, `CMP`/`SEQ`, `SNE`, `SLT`, `NOP`
- only `.F` modifier
- addressing modes: immediate `#`, direct `$`/omitted, B-indirect `@`, predecrement `<`, postincrement `>`
- integer operands and simple labels
- two-warrior matches

Unsupported syntax/semantics fail explicitly: arithmetic expressions, multiple modifiers, `EQU`, `FOR/ROF`, assertions, P-space, ICWS '88 compatibility quirks, and full ICWS '94 modifier semantics.

Hard caps live in `engine/profiles.mjs` and `kennel/config.mjs`.

## Run locally

```sh
node kennel/build-site-data.mjs
python3 -m http.server 8000 -d docs
```

Open <http://localhost:8000>. The browser uses the same `engine/corewar-vm.mjs` and parser as Node.

## Advance one epoch

```sh
node kennel/evolve.mjs 1
```

Or use GitHub Actions: **Advance Kennel** -> `workflow_dispatch` -> `epochs` (default `1`, capped small). The workflow commits changed state and regenerated `docs/data/` only after a real epoch.

## Tests

```sh
node test/regression.mjs
```

## Deferred deliberately

Full ICWS '94 compatibility, large-scale lineage visualization, exhaustive replay archives, sophisticated strategy tagging, and any public submission/ranking service are intentionally out of scope for this dormant-capable first pass.
