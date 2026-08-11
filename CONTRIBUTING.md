# Contributing

This project is an active, falsification-driven POC.

Before changing code:

1. read `README.md` and `docs/architecture/README.md`;
2. state effects on all eight permanent architecture lenses;
3. preserve the one-runtime application boundary;
4. change Lean declarations or bridge metadata before generated public artifacts;
5. attach a reproducible command and raw evidence to architectural claims; and
6. do not introduce a Lean or Emscripten patch without satisfying `docs/architecture/patches.md`.

Generated files carry source/schema hashes and must not be edited manually. Runtime tests are evidence, not machine-checked proof. A reproducible binary is not itself a behavioral proof.

Preserve unrelated work in a dirty tree. Limit each change to named project paths and stop when an unexpected conflict makes that impossible.

Documentation changes must:

- lead with the supported outcome or measured result;
- distinguish current evidence from planned product behavior once, without repeating caveats;
- use plain punctuation and active voice;
- replace broad claims with named systems, measurements, consequences, or explicit unknowns;
- link historical and technical claims to primary sources; and
- avoid presenting tests, reproducible builds, provenance, or type checking as behavioral proof.

Run the local documentation and downstream-support contract before opening a change:

```sh
npm run test:docs
```

The dedicated consumer workflow runs the heavier clean-package checks through the pinned Nix and Docker toolchains.
