# Recursive checked Subtypes in PHP-Wasm

Lean Bridge now checks selected `Subtype` constructors and `Fin` bounds while copying the tested recursive graph into PHP-Wasm. The accepted surface covers a recursive `Chain` variant, its transparent alias, and `Array (Option Chain)` carriers on both author routes.

The immutable [evidence index](recursive-subtype-php-wasm-20261015/index.json) authenticates producer commit `a54f8c653af24440754ff274df9095b54680f547`, both reports, both package-set receipts, six complete package archives, and fourteen selected producer sources.

## Installed observations

| Author route | Installed arrangements | Checks per arrangement | Retained packages |
| --- | ---: | ---: | --- |
| Ordinary Lean source | 12 | 24 | Composer API, npm component, npm shared runtime |
| Reviewed Binding IR | 12 | 24 | Composer API, npm component, npm shared runtime |

Each route runs eight Node arrangements across embedded and Composer installation, startup and lazy loading, and weak and strict PHP. Four Chromium arrangements cover bundled startup and lazy loading with weak and strict PHP. Every arrangement uses wasm32 PHP 8.4.1 and records `ready`, `autoload`, `invalid`, and `complete` phases.

The tests remove the author source before offline installation, move the installed tree, and repeat execution through public package APIs. The ordinary and reviewed routes share the same runtime archive and produce distinct API and component archives.

## Checked behavior

The fixture exercises two checked constructors for the same recursive `value` field. It also checks the adjacent `Fin 3` field at each recursive level. The generated adapter traverses the active variant case only.

Invalid values report the exact field, array index, option payload, and recursive position that rejected the call. Rejection leaves shared caller graphs unchanged. A valid call succeeds afterward. Self-cycles fail with `Cyclic copied value`; values deeper than 128 copied levels fail with `Copied value exceeds 128 levels`.

Results project the proof-backed base values without exposing proof fields or input constructor choices.

## Boundary

This evidence covers the named recursive variant, alias, and nested `Array` and `Option` carriers. Recursive checked records, generic record instantiations, owned values, callbacks, and dependent types have separate acceptance work. The runs did not measure dispatch counts or peak memory.

External compiler, browser, Node, PHP, and Composer binaries are recorded by identity rather than copied into the archive. Absolute temporary paths in the reports describe the original runs and are not CI inputs.

The local runs admitted heavy work below a load average of 8. They required at least 2 GiB of free disk and available memory before launch.
