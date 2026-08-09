# PHP Release Gate Evidence

Status: passed for native Zend, PHP-Wasm lazy, and PHP-Wasm startup packages. The gate built each profile twice in separate empty output roots, compared 174 files, verified both hash layers, executed one semantic corpus through all three profiles, and ran the two-component PHP-Wasm composition test.

## Release result

| Profile | Files | Package bytes | Release manifest SHA-256 |
|---|---:|---:|---|
| native Zend | 48 | 14,292,674 | `a4bc0a4cb63a3e0a7d238d253934829ab50dac00c39cb0434a91bdc5e5bd2786` |
| PHP-Wasm lazy | 63 | 9,217,044 | `6720384892aa3dcdd7099c981837c97403e0bf33c18e2d2e38e47c44341466f3` |
| PHP-Wasm startup | 63 | 9,212,868 | `484e80fa4c4965997ff8e0568660390b690e5b3383e863ea0a24ca2d29e5b87c` |

No path differed between build A and build B for any profile.

The native release now retains the normalized sources used to build the extension. Its compared tree contains 18 PHP files, 13 C or header files, 2 native shared objects, 12 JSON manifests or metadata documents, 1 PHP stub, and 1 package document.

Each PHP-Wasm release contains 21 PHP files, 12 C or header files, 3 Wasm component files, 2 compiled Wasm shared objects, 18 manifests, 2 PHP stubs, and 2 package documents. A file can belong to more than one reporting category.

## Four blocking checks

The gate applies four checks before publication:

1. The generated Binding IR conformance corpus must produce the same typed observations through native Zend, PHP-Wasm lazy, and PHP-Wasm startup.
2. Every profile must report the same declared capability coverage and gaps.
3. Every file named by a release manifest and sorted SHA-256 inventory must match its recorded byte count and hash. Unlisted or unhashed files fail the gate.
4. Two builds of each profile must contain the same paths and bytes.

The current semantic observation hash is `5b4537ff7bbd450be84e26cce09fc642df62c858f7d0ac5ea31ef0cce9c6bd14`. The fixture declares two coverage gaps because its Binding IR contains no property operation and no finite generic specialization. Both transports report those same gaps. An undocumented difference fails the gate.

The PHP-Wasm composition stage also verifies that eager and lazy profiles pass one retained Alpha value through Beta, preserve canonical PHP identity, attach both components to one shared runtime, and reject a conflicting private runtime identity.

## Reproduce

Run:

```sh
npm run test:php-release
```

The command writes `build/php-release-gate/release-gate.json` and `build/php-release-gate/release-gate.md`. A failure report includes the failing check, both hashes for byte differences, likely entropy sources, and the reproduction command. The script exits unsuccessfully, so a publishing job cannot continue.
