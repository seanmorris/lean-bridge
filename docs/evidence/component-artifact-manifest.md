# Component artifact manifest evidence

## Result

The medium onboarding build emits `component-artifact-manifest.json` with SHA-256 identity `7daf881e5597de28c423f12a46a1340a5b39afd186ee34fc92a2ab6dd69bcec3`.

The manifest connects one 2,363-byte Wasm artifact to every input and decision that produced it:

- source tree `10c62aa00149d5be4c18e0e67c26849085f68aa6905d5fe088345502e00c2aca`;
- Binding IR `4c3d7aeb0cd80d16ace71dd38758edba5a941d35e105520eb2a1480ceb9daf33`;
- compiler adapter plan `cd01624ff2b1b6f042b4570750d4128dd4f340026704b9da73a5649c33adbd4d`;
- private ABI `43d5159d60ae41f0dea9db5ee46c1abb26694addd17caa65d6e3ecebd10cfcf8`;
- component plan `a932a2cbfa31cc1b3b3a7940e6e038fcc8aa67049c9f3ccc975ba4483979f442`;
- compilation plan `cf46c019996ba05fac9deb43b2192ff26ab3df1e5d1851926bb358c9c496c9d3`;
- target C manifest `13499eca07cbc3fdae6478360d0243cceeaa631e316f8f3e9464e0e9759ca8ba`;
- side-module link manifest `7d3d9a626bfdf958aad0e8e871a1b178c70519b125ae11f8a5a022f74d1d89be`;
- side-module audit `fda8a87cc4ffe014c18f53f34da43bdf6c190184dff90a586a1ee083010dd282`;
- Wasm artifact `030318765bd7851be0f90a8ce92980891f672d4d9ae58068ce284f65b70a30ff`.

It records Lean 4.32.2, the exact Lean Git commit, the runtime patch set, Emscripten 6.0.6 and its Git commit, every direct symbol, runtime imports, memory and table ownership, and compile-once policies.

The writer rejects a broken target C, link, audit, or artifact identity before creating the manifest. Two builds from different checkout roots produce the same manifest identity.

[`schema/component-artifact-manifest.schema.json`](../../schema/component-artifact-manifest.schema.json) closes the top level and every nested object. Package generators can consume this manifest without rebuilding the component or inventing target-specific semantics.
