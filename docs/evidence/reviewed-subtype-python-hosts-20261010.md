# Reviewed Subtype packages on Python 3.11 and 3.12

Both pinned Python consumers passed the complete reviewed Subtype corpus at producer `274b8685d25caebb422ac4d31be09c2948fef84c`. Python 3.11.16 and 3.12.14 each executed 2,025 checks before and after relocating the installed environment. Each selection built from two independent author roots, reproduced identical model, receipt and wheel hashes, and removed the author roots before offline installation. Consumer execution had no compiler on its search path.

The twelve-export review includes checked UInt8, Nat, Int, String and byte-array inputs; a mixed Fin input; late-argument rejection; two instances of one generic function with different constructors; normalization above 64 bits; and a zero-argument refined result. Each caller preserves the original 1,000 rejection/recovery pairs. The eight extra checks include unchanged-input assertions. The constructor and dispatch entry counts were not measured.

The Python environment guard authenticates the bootstrap and installed package files, retains normal site initialization, and redirects bytecode lookup to a fresh empty directory. It checks the environment before and after execution, including after relocation. These runs used a local glibc floor of 2.36.

## Original records

The [archive index](reviewed-subtype-python-hosts-20261010/index.json) authenticates 53 records. Its SHA-256 is `8e7b279ecb100eca3701083bd3984d53e7d4b8cfefd9deb5379007441fd3a2b0`. Records include both reports, both pairs of build records, original TAP and runner records, the runner source, and fifteen selected source snapshots matched to their Git revisions.

Both Python floors produced wheel SHA-256 `4608495c3451e638e9bc02ed9bac1e03e27d23dc5741929a0aaca9b046c44fd6`. Original package binaries are not retained in this archive. The selected snapshots do not constitute a complete compiler and toolchain input archive.

The first attempt at `aa55d66542b4e173fc64ef0c0dee5aa6384ecb86` failed before packaging. The new portable export name was `byteValue`, but its reviewed overload identifier still named `Subtypes.byte`. Fresh Lean reconciliation rejected the mismatch. The failed review, Lean source, original TAP and runner records remain in `failed-overload/`. The fix changed the fixture's overload identifier; no production reconciliation check changed.

## Independent checks

Run the archive and report controls with:

```sh
node --test tests/helpers/reviewed-subtype-python-archive-tests.mjs
```

The reader uses archive-relative paths. It never opens the recorded absolute producer paths. It checks both reviewed APIs, constructor selections, complete build identities, package receipts, caller hashes, Python versions, environment inventories, relocation flags and exact check counts. Controls reject changed original bytes, missing executions, changed constructors even with adjusted model hashes, false isolation claims, wrong Python floors and invented entry measurements.

This archive covers the reviewed top-level Python slice. It adds no type-surface support observations. Remaining native hosts, reviewed browser contexts, nested or nominal Subtypes, callbacks and broader generic combinations remain under #1444 and #1220.
