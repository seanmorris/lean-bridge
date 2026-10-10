# Reviewed Subtype packages on Ruby, Java and Kotlin

Ruby, Java and Kotlin passed installed reviewed-Subtype acceptance at producer `274b8685d25caebb422ac4d31be09c2948fef84c`. Ruby and Java each ran 2,024 checks; Kotlin ran 2,023. Each consumer repeated its complete caller after relocation. The Ruby selection and the shared Java/Kotlin selection each reproduced their package archives, model and receipt from two author roots, then removed those roots before offline, compiler-free installation.

All three callers retain their original 1,000 rejection/recovery pairs. Eight additional checks cover UInt8, independently chosen rejecting and normalizing constructors for the same generic source, normalization above 64 bits, a zero-argument refined result, and unchanged inputs after rejection and normalization. Runtime constructor and source-entry counts were not measured.

RubyGems installation derives its allowed files from the original gem before loading an installed specification. The guard checks the receipt payload, cached gem, installed gemspec and selected interpreter before and after execution. JVM installation checks the original JAR and its receipt before compiling the consumer, then checks the consumer source and compiled classpath inputs before and after execution. Both guards repeat those checks after relocation.

## Original records

The [archive index](reviewed-subtype-ruby-jvm-hosts-20261010/index.json) authenticates 53 records, including both complete reports, their two-root build records, original TAP and runner records, and 19 selected source snapshots matched to Git. Its SHA-256 is `71bc6109a5a14d6d25530947bcd00f95ea9c053394b59038b204b0216ff9021f`.

The runs used a local glibc floor of 2.36. The archive contains package hashes and installed environment inventories, not the original gem/JAR binaries or a complete toolchain input archive. Recorded absolute paths are provenance; the verifier reads only archive-relative records.

## Independent checks

```sh
node --test tests/helpers/reviewed-subtype-ruby-jvm-archive-tests.mjs
```

The verifier checks the independent twelve-export review, both reproduced builds, exact caller checks, constructor selections, package receipts, RubyGems file closure, JAR identity, Java/Kotlin classpaths and relocation observations. Controls reject all 108 appended-byte or same-length corruptions of the records and index, plus 64 changes to execution, receipt and environment claims.

These observations cover reviewed top-level Subtypes on Ruby, Java and Kotlin. They do not resolve the separate Fin-container JVM debugger-exit failure. This archive adds no type-surface support observations; broader reviewed positions and remaining hosts stay under #1444 and #1220.
