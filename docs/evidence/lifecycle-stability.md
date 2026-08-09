# Lifecycle and memory stability

Status: clean architecture measurement. The suite drives generated JavaScript functions, classes, callbacks, closures, Promises, and iterators through one real Lean runtime. It records high-water and retained state separately.

## Workload

The default run executes 24 rounds. Each round performs:

- 256 retained `Box` constructions, reads, identity checks, and explicit disposals;
- 32 retained Lean closure constructions, calls, and explicit disposals;
- 128 direct callbacks plus one nested callback path;
- 64 typed copied-record calls;
- 32 public Promise operations; and
- one 256-item iterator driven by a retained Lean closure.

The copied record preserves `Bool`, `UInt32`, `String`, `ByteArray`, and `Array UInt32` as typed fields. No workload call uses a generic dispatcher, pointer, numeric handle, or private symbol.

## Clean run

The clean run used commit `a2222469507814410d9a61e94d643d8bf1da8c3d`. Git reported `dirty: false`. Node 22.23.1 ran on Linux x64 with an Intel Core i7-7700K and eight logical CPUs. The command exposed explicit garbage collection so the host heap snapshots have a defined collection point.

The suite checked 12,288 retained-resource calls, 1,536 typed copied values, 3,120 callbacks, 768 Lean closures, 768 Promises, and 6,144 iterator items.

## Lifecycle result

| State | High-water | Retained after every round |
|---|---:|---:|
| Lean resources | 256 | 0 |
| host values | 0 | 0 |
| Lean closures | 32 | 0 |
| callbacks | 2 | 0 |
| callback depth | 2 | 0 active frames |
| pending operations | 32 | 0 |
| iterators | 1 | 0 |

All 24 rounds returned to zero live bridge state. A disposed wrapper failed with `resource-disposed`. A replacement resource remained usable after the registry reused its slot. A wrapper presented to another runtime failed with `cross-runtime-handle`.

The delayed-finalizer fixture queued one unreachable wrapper without releasing Lean during the finalizer callback. The next safe public call drained that queue. Native live resources moved from one to zero, the lease counter recorded one finalization, and the runtime retained no wrapper.

The shutdown scenario began with one live resource. Shutdown released it, moved the live count to zero, and expired its wrapper. The next method call failed with `runtime-shut-down`.

## Memory result

Wasm memory started at 17,039,360 bytes, remained at 17,039,360 bytes at every one of the 50 snapshots, and retained zero additional Wasm bytes after the workload. The suite rejects any page growth after the first lifecycle round.

| Process measure | Loaded baseline | High-water | Retained delta |
|---|---:|---:|---:|
| RSS | 70,553,600 bytes | 83,853,312 bytes | 13,299,712 bytes |
| JavaScript heap used | 7,943,840 bytes | 9,066,488 bytes | 1,065,216 bytes |
| external | 19,160,988 bytes | 19,187,515 bytes | 25,759 bytes |
| array buffers | 26,315 bytes | 27,083 bytes | 0 bytes |

The bridge counters and Wasm page count define native retained state. Process RSS also contains Node, generated bindings, benchmark records, allocator caches, and engine state. The report preserves the process deltas for later variance analysis instead of classifying them as live bridge objects.

## Artifact identity

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| browser main runtime | 1,296,987 | `b8c6328d558f793a4847e6465f432c6d19602d56c01852237e7629b3417743b1` |
| Alpha side module | 4,612 | `df3c7c6da8f919a3c0bb6748ec2a265841fa4ade4e69fdf9fed53e7f3f15beda` |
| locked component graph | 2,643 | `7a10491995e8023cb271521499049834437f6bddec7c2ce26f9a7aadf6156789` |
| Binding IR | | `0cb3a53415d72ee941b58c8a0291bb7ae6caf3218d97778ea247cee58acd4fd8` |

The machine record is 32,805 bytes with SHA-256 `c93103e5952d8b5bb9a114e8e9ac5cab53f517df5f7d9092c941ce9788de3c1a`.

## Measurement boundary

JavaScript does not provide deterministic finalizer timing. The suite uses an injected finalizer and weak-reference fixture to reproduce delayed collection. That fixture reads one private native live-handle diagnostic before and after the safe entry. Workload calls still use the generated package surface.

WebAssembly memory grows by pages and does not shrink. Process memory depends on the host engine and allocator. The performance methodology phase must define reference environments, repetitions, and variance rules before release budgets use process-memory deltas.

## Commands

```sh
npm run test:performance-lifecycle
npm run benchmark:lifecycle -- \
  --output build/lean-link-spike/lifecycle-stability-suite.json
```
