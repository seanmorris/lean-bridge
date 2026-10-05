# Publication recipe acceptance, 2026-09-16

VO 1240. This milestone executes the documented Nix cache workflow and adds shell-contract checks for native package-manager publication. It changes no generated API, runtime ABI, package format or type-support claim.

## Corrections

| Recipe | Failure found | Correction |
| --- | --- | --- |
| Nix cache publication | A checkout path containing spaces produced an invalid `file://` store URL. | Encode the cache path with `pathToFileURL`; encode the temporary consumer root as a query parameter. |
| Nix clean fetch | Without shell error handling, the final `printf` could announce verification after a failed download. | Enable strict Bash handling in the consumer block; negative tests run without an inherited error guard and reject a success message. |
| Cargo publisher review | The shared example moved a file absent from ordinary crates and regenerated their supplied lockfile. | Move VCS metadata only when present; generate a lockfile only when absent. |
| C, C++ and WIT/WASI archive downloads | Upload paths were configurable, but download patterns and comparisons still named Alpha files. | Derive asset names from the approved archive paths and compare all downloads in a fresh directory. |

## Real Nix execution

[The Nix suite](../../tests/nix-publication.test.mjs) reads and executes the actual key-generation, signing, endpoint-audit and consumer-fetch blocks from the guides. It uses Nix 2.24.11, Node 22.23.2, Bash and curl on x86-64 Debian 12. The suite passed as root and as the unprivileged `nobody` account: **15 tests passed in each run**.

The test registers two small input-addressed paths in a private redirected store. The package references the runtime. These are transport fixtures, not compiled Lean packages. Content-addressed paths would not establish the signature-rejection cases because Nix accepts them through their content addresses.

The executed checks cover:

- Protected key permissions and refusal to overwrite an existing key directory.
- Recursive signing and preservation of both paths' signatures in the cache.
- Fresh-store downloads and byte comparison of both payloads.
- Rejection of unsigned packages, unsigned dependencies and unrelated signing keys.
- Rejection of modified references, damaged compressed archives, valid archives with the wrong NAR contents, and missing runtime archives.
- Rotation through a fresh cache root, acceptance by either overlap key, and rejection by an unrelated key. Copying to the old cache does not refresh its signatures.
- The publisher's endpoint audit and consumer fetch over loopback HTTP.
- Paths containing spaces, `#`, `&` and `%`, and absence of private keys from cache files and publication records.

The suite clears ambient Nix configuration, uses its own cache and state directories, disables builders and substituters, and removes its temporary keys, stores and caches. Imported store directories are read-only; cleanup restores owner access within the test's scratch tree so unprivileged runs can remove them.

The local run used the official `nix-2.24.11-x86_64-linux.tar.xz`, checked against its published SHA-256, `5f61d3cd8c7c48c7b28cba595ba31d134091014781d04dfb004ea35b256da127`. It ran through its bundled dynamic loader without installing Nix globally. CI installs Nix 2.24.11 in a dedicated `Signed Nix cache recipes` job and runs:

```sh
npm run test:nix-cache
```

HTTPS server configuration, SSH deployment, real flake-output substitution and package execution are not exercised by this small cache fixture. Existing downstream jobs build and execute the actual package profiles. No public cache was deployed.

## Publication shell contracts

[The shell suite](../../tests/publishing-recipes.test.mjs) executes documentation blocks in isolated workspaces with recording clients. **Nine tests passed**. The suite checks npm, PyPI, NuGet, Maven, RubyGems and GitHub archive-upload arguments with two unrelated package filenames, quoted paths, unchanged input bytes and client failure propagation. NuGet and RubyGems also reject missing credentials before client invocation.

Two Cargo fixtures check preservation of an ordinary crate's supplied lockfile and Alpha's optional VCS metadata and missing lockfile. The GitHub download fixture uses the requested asset names, compares the returned files with real `cmp`, and rejects changed bytes.

PATH contains the recording clients and explicitly allowed filesystem tools. The tests inherit no registry credentials and make no registry requests. They do not claim that a real registry accepted an upload or that the dummy archives contain valid packages. Existing installed-consumer tests cover generated package contents. PAUSE's web form and Composer repository administration remain operator workflows.

Run the shell checks with:

```sh
node --test tests/publishing-recipes.test.mjs
```

Both test files belong to the closed contract-test manifest. The real Nix suite requires `LEAN_BRIDGE_NIX_CACHE_TEST=1`; `npm run test:nix-cache` sets it. Its ungated contract checks that the dedicated CI job remains present.

## Repository validation

`npm run check:core` passed lint, checked-JavaScript types and 709 tests; 53 compiler/runtime-gated cases skipped. The real Nix suite ran separately as described above. All 65 documentation tests, the site typecheck and the production site build passed. The type inventory still records 656 installed-tested cells; this milestone adds no type-support claims.
