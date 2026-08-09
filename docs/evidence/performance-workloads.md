# Deterministic spatial workloads

Status: executable fixture contract. The workload manifest fixes the input distributions and operation traces that the shared-runtime performance harness must run.

## Commands

```sh
npm run inspect:performance-workloads
npm run test:performance-workloads
```

`poc/performance/workloads.v1.json` declares four workloads. The browser-safe tier contains a small clustered 2D workload and a medium uniform 4D workload. The extended Node tier contains a large clustered 8D workload and an adversarial 8D workload whose points lie on one diagonal with repeated coordinates.

The reviewed manifest SHA-256 is `a5b519b1380656be4441e3a9766a30873125037e9efa9630d4052c04fe2fd169`.

Every workload records:

- the reviewed generator name, version, and integer PRNG algorithm;
- one unsigned 32-bit seed;
- dimensionality, point count, coordinate bounds, distribution, target duplicate rate, locality, hit ratio, and range radius;
- warmup and measured operation counts;
- a CC0-1.0 license;
- a SHA-256 for the generated points and complete operation trace;
- a SHA-256 for every expected result in sequence; and
- the exact operation count.

The generator uses integer operations and a fixed `mulberry32-integer-v1` random stream. It expands the compact manifest into canonical points, warmup calls, shuffled measured calls, and cleanup. Calls include lower bound, nearest neighbor, inclusive range, insertion, an independent consumer checksum, and disposal.

The result digest comes from a separate JavaScript reference execution. Changing a seed, generator, coordinate, operation mix, query, insertion, result order, or expected value changes a reviewed hash and fails the test.

The fixture layer does not record timing. The harness must first compare every native result with the generated expected result, confirm the retained index reaches the ownership baseline after disposal, and only then accept timing samples.
