# Contributing

This project is currently a falsification-driven POC.

Before changing code:

1. read `README.md` and `docs/architecture/README.md`;
2. state effects on all six permanent architecture lenses;
3. preserve the one-runtime application boundary;
4. change Lean declarations or bridge metadata before generated public artifacts;
5. attach a reproducible command and raw evidence to architectural claims; and
6. do not introduce a Lean or Emscripten patch without satisfying `docs/architecture/patches.md`.

Generated files carry source/schema hashes and must not be edited manually. Runtime tests are evidence, not machine-checked proof. A reproducible binary is not itself a behavioral proof.

The many pre-existing directories under `/app` are outside this project. Do not modify them as part of bridge work.
