# External component CLI evidence

Observed on 2026-08-11 with the plain `onboarding-small@1.0.0` Lean project.

## Command

```sh
LEAN_BRIDGE_BUILD_BACKEND=nix node scripts/lean-bridge.mjs build \
  --project tests/fixtures/onboarding/small \
  --output /tmp/lean-bridge-cli-979.final \
  --target npm \
  --format json \
  --progress plain
```

The command completed with exit code 0 and no diagnostics. It emitted request `d13fa226c8da222be8ad544e654edd420db3e395c06533b5a4c7cb9d9cae8095` and bundle identity `3839bed53a7833a39816de80e4960c6378d94e54ecaf528f3257db7939685789`.

The public progress stream reported these operations:

1. Prepare the isolated build environment.
2. Prepare the verified component input.
3. Compile the Lean component once.
4. Validate component and provenance identities.
5. Complete the canonical build.

The progress stream contains no flake or builder-image terminology. Public build and publish dry-run tests inject lower-level execution failures and verify that the CLI returns `package-build-failed` without exposing the backend command, stderr, flake, or image details.
