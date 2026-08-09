# Native PHP and PHP-Wasm Conformance Evidence

Status: one Binding IR-derived PHP corpus now executes unchanged through the native Zend package and PHP-Wasm package. Both transports produced observation SHA-256 `5b4537ff7bbd450be84e26cce09fc642df62c858f7d0ac5ea31ef0cce9c6bd14`.

## One generated consumer program

`generatePhpConformanceCorpus` compiles the PHP projection and selects operations by their declared types, ownership, lifetime, effects, and failure policies. It does not select a transport. The generated PHP file contains no `NativeTransport`, Wasm URL, loader handle, dispatcher, `ccall`, or `cwrap` reference.

The runner changes only the application environment:

- native PHP loads the generated Zend extension and points Composer at the native package root;
- PHP-Wasm loads the generated package descriptor and mounts the same Composer files at `/vendor`.

Both hosts execute the same `conformance.php` bytes.

## Matched observations

The shared corpus established:

| Contract | Observation in both transports |
|---|---|
| Binding identity | `e3a9f0e95e65a76f8d4776ced695ae5a6fffd83028b2307fa2345c7a28a545a4` |
| copied record | `Bool`, `UInt32`, `String`, `ByteArray`, and `Array UInt32` returned as typed PHP values |
| resource read | `41` |
| canonical identity | `$box->identity() === $box` |
| callback result | `42` |
| returned Lean closure | `42` |
| callback failure | `error:callback-threw`, with the original PHP message at the root cause |
| closed resource failure | `error:disposed-resource` |
| runtime initialization | one run |
| component initialization | one run |
| live identities after cleanup | zero |
| readonly record reflection | true |
| Composer reflection metadata | byte-identical |
| Composer assurance metadata | byte-identical |
| generated package documentation | byte-identical |

The comparator validates required results before comparing the complete structured observations. Any differing field reports its exact path and fails the command.

## Current fixture gaps

The machine-readable capability report records two gaps:

- properties: the current Alpha Binding IR declares no property operation;
- generic specializations: the current Alpha Binding IR declares no finite generic specialization.

The generator does not mark these features as tested. A later parity fixture must add the declarations before the parent parity gate can close them.

## Reports and command

Run:

```sh
npm run test:php-transport-parity
```

The command builds both packages, runs the corpus, and writes:

- `build/php-transport-parity/conformance.php`
- `build/php-transport-parity/conformance.json`
- `build/php-transport-parity/parity.json`
- `build/php-transport-parity/capability-gaps.json`
- `build/php-transport-parity/parity.md`

`parity.json` includes the native runtime and extension hashes plus the PHP-Wasm runtime, component, and extension hashes. The two transports carry different executable artifacts while naming the same Binding IR contract.
