# Zero-payload checked records in Rust

The immutable [hosted evidence archive](zero-payload-checked-record-rust-20261021/index.json) records all four ordinary-source, reviewed-IR, full and result-only Rust Cargo crate selections from [GitHub Actions run 39561655967](https://github.com/seanmorris/lean-bridge/actions/runs/39561655967). The archived artifact is `12329518106`; its SHA-256 is `a5f727dae9dcf0041af6cdea635649c8a3c409270ef188188123943111e125eb`.

Each selection reproduces the complete crate from two author roots, removes the author sources, installs without network access from retained dependencies, relocates the installed tree and replays an independently compiled Rust caller. The run used Ubuntu 24.04, x64, glibc 2.39, Rust 1.90.0 and Cargo 1.90.0.

The fixture distinguishes these values:

- proof-only `Witness`, checked through a selected nullary Lean constructor;
- `Token`, whose `Unit` field remains present;
- plain empty `Marker`;
- `Option<Witness>`, including explicit absence;
- vectors of zero-payload values; and
- the active and inactive branches of `Mark`.

Rust exposes `Witness` as a nominal empty struct. It is not `()`, absence, a zero-sized substitute of another type, or interchangeable with `Marker` or `Token`. Vectors preserve their lengths and contain independent nominal values.

Full crates run the exact selected nullary constructor on checked inputs, reject wrong nominal values at compile time or the package boundary, preserve rejected caller values and recover on the next valid call. Result-only crates project Lean-produced proof-erased values without input-constructor metadata.

The archive retains every crate, dependency, receipt, report, caller observation, terminal TAP stream, generated probe, tool identity, GitHub API record, artifact ZIP byte and exact producer, consumer, checker and archiver source closure at revision `a6173cade3bbe158baa1a5695e3e93e1037359b0`. The independent verifier is [`tests/helpers/zero-payload-checked-record-rust-evidence.mjs`](../../tests/helpers/zero-payload-checked-record-rust-evidence.mjs).

This evidence promotes copied parameter and result sites for the named fixtures in Rust. It does not promote fields, callbacks, owned positions, other zero-payload shapes or another host. Lean, Rust, Cargo and the operating system remain trusted external toolchains.
