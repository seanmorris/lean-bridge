# Generated Package Drift Gate Evidence

Status: JavaScript, PHP, Python, C, and Rust packages regenerate deterministically and match one reviewed hash report. Public package files pass backend-specific audits and one shared forbidden-surface scan.

## Release check

Run:

```sh
npm run binding-packages
```

The command reads the canonical Alpha Binding IR and compares generated output with `poc/lean-link-spike/bindings/generated-package-gate.json`.

The report records for each backend:

- generator identity and version;
- public export names;
- declared capability gaps;
- one file-set SHA-256 hash; and
- every file path, UTF-8 byte length, and SHA-256 hash.

Changing generated implementation code, headers, type declarations, stubs, docs, manifests, package metadata, exports, or capability gaps changes the report. The check prints backend file-set hashes on success and emits structured diff paths on failure.

## Determinism

`compileGeneratedPackageGate` runs every generator twice. The second run receives a cloned Binding IR object. Canonical comparison covers the complete in-memory file map. A backend that depends on object identity, insertion order, time, temporary paths, environment data, or another undeclared input fails before the reviewed report comparison.

The reviewed report binds all packages to Alpha's canonical Binding IR SHA-256:

```text
e3a9f0e95e65a76f8d4776ced695ae5a6fffd83028b2307fa2345c7a28a545a4
```

## Public-surface scan

Each backend keeps its detailed audit. The shared gate also scans the files a package consumer reads:

| Backend | Scanned surface |
|---|---|
| JavaScript | module entry, TypeScript declaration, package export map, README |
| PHP | public classes and functions, generated stub, Composer metadata, README |
| Python | module entry, `.pyi` stub, project metadata, README |
| C | public header, README |
| Rust | public module, Cargo metadata, README |

The shared scan rejects `ccall`, `cwrap`, generic dispatcher instructions, private bridge symbols, raw WebAssembly types, calling-convention directions, and ownership flags. Backend audits add target rules, including JavaScript `any`, PHP `mixed` in the public stub, Python `Any`, C runtime identity types, internal package subpaths, and mismatched export manifests.

Package documentation describes the callable API directly. It does not teach consumers about private dispatch or transport conventions.

## Executed checks

`tests/generated-package-gate.test.mjs` proves:

- the current generators match the reviewed report;
- the report contains the five expected backends and distinct package hashes;
- changing one reviewed file hash produces a precise blocking diff;
- adding generic dispatcher instructions to generated package docs fails the shared scan; and
- the CLI validates the reviewed report and returns machine-readable package identities.

The repository test suite runs this gate with the backend-specific generator and execution tests.
