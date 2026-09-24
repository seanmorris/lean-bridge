# Current source bindings for the structured-type inventory

The [source-update record](structured-source-refresh-20260924.json) accounts for
47 changed files in the support inventory. Each transition requires measured
compiled regressions, an exact checker-only change, a reviewed documentation
update or checked additive registrations. Every current inventory source hash
now matches its file.

The compiled records are:

- [Current C# families](dotnet-current-family-regressions-20260924.md).
- [Current native PHP families](php-current-family-regressions-20260924.md).
- [Shared native backends](native-shared-regressions-20260924.md).

[Documentation and registration changes](recursive-documentation-updates-20260924.md)
have separate checks. The source-update record retains predecessor hashes and
the original C# source texts. Historical package receipts keep their original
source hashes and archive identities.

This refresh changes evidence bindings only. Inventory 0.83.0 still records
4,182 installed cells and eleven accepted recursive profiles. C#, Java, Kotlin,
native PHP and PHP-Wasm require completion of the final acceptance checks before
their recursive cells are promoted. WIT/WASI recursion, structured callable
payloads and resource-containing aggregates remain open.
