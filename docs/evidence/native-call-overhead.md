# Generated native call overhead

Status: clean architecture measurement. This record measures generated JavaScript callables against one real Lean runtime and one independently compiled Alpha side module. It does not define a release budget.

## Public surface

The benchmark uses the object returned by the normal library loader:

```js
const alpha = await libraries.load(overheadDescriptor);

const box = new alpha.Box(41);
box.read();
alpha.roundTrip(payload);
alpha.withCallback(40, value => value);
const addOne = alpha.makeAdder(1);
await alpha.deferBoxValue(42);
[...alpha.sequence(10, 4)];
```

The benchmark client and harness cannot call a private symbol, Emscripten dispatch helper, pointer, or numeric handle. Binding IR generates every public name, argument adapter, result adapter, ownership rule, callback plan, Promise plan, and iterator plan.

`roundTrip` crosses a typed record containing `Bool`, `UInt32`, `String`, `ByteArray`, and `Array UInt32`. The generated frame copies each field according to its type. It does not serialize the record to JSON or another text format. `Box` and the callable returned by `makeAdder` retain Lean identity. Their JavaScript wrappers dispose deterministically and share the runtime's canonical identity maps.

## Clean run

The clean run used commit `6e29b03cfce187441bc293fc60d6695a86b1401c`. Git reported `dirty: false`. Node 22.23.1 ran on Linux x64 with an Intel Core i7-7700K and eight logical CPUs. `process.hrtime.bigint()` supplied the clock.

The benchmark records raw nanosecond samples plus minimum, median, p95, maximum, and total values. It runs 40 samples of 10,000 scalar calls, 30 samples of 100 small copied records, 30 large copied records, 40 callback samples, 30 iterator samples, 30 Promise samples, and 12 cancellation samples.

| Generated operation | Median | p95 |
|---|---:|---:|
| Lean closure call | 421 ns | 747 ns |
| retained `box.read()` | 302 ns | 503 ns |
| canonical `box.identity()` wrapper reuse | 1.277 µs | 1.643 µs |
| copied typed record, 8 array items | 16.825 µs | 24.653 µs |
| copied typed record, 1,024 array items | 210.300 µs | 421.461 µs |
| copied typed record, calculated per item | 205 ns | 412 ns |
| JavaScript callback invoked by Lean | 1.694 µs | 4.960 µs |
| nested JavaScript to Lean re-entry | 5.322 µs | 9.730 µs |
| iterator delivering 256 items | 666.069 µs | 1.293 ms |
| iterator, calculated per item | 2.602 µs | 5.049 µs |
| callback exception crossing the boundary | 10.003 µs | 13.237 µs |
| Promise settlement latency | 1.120 ms | 1.374 ms |
| shutdown cancelling 16 Promises | 152.480 µs | 603.924 µs |

The 1,024-item per-item value divides one batch duration by 1,024. It shows amortization inside one typed transfer. It does not claim that one batch has the same semantics as 1,024 independent calls.

## First observed calls

The benchmark creates the module and library loader before timing the first public call. The first `Box` construction triggers Lean runtime and component initialization.

| Call | Time |
|---|---:|
| `new alpha.Box(41)` | 37.552 ms |
| `box.read()` | 337.103 µs |
| `alpha.roundTrip(payload)` | 742.869 µs |
| `alpha.withCallback(...)` | 969.852 µs |
| `alpha.makeAdder(1)` | 321.978 µs |
| returned Lean closure | 233.677 µs |
| `alpha.sequence(10, 4)` | 715.201 µs |
| `alpha.deferBoxValue(42)` | 1.698 ms |

## Correctness and cleanup

The run completed 407,685 calls through one retained Lean closure and 7,684 iterator item deliveries. Every one of the 31 iterator cursors was released. The identity cache served 400,000 canonical hits. Twelve cancellation samples rejected all 192 pending public Promises with the generated cancellation error.

The run finished with zero live resources, zero live Lean closures, zero pending operations, zero live callbacks, and zero iterator cursors. Runtime shutdown succeeded.

## Artifact identity

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| browser main runtime | 1,296,987 | `b8c6328d558f793a4847e6465f432c6d19602d56c01852237e7629b3417743b1` |
| Alpha side module | 4,612 | `df3c7c6da8f919a3c0bb6748ec2a265841fa4ade4e69fdf9fed53e7f3f15beda` |
| locked component graph | 2,643 | `7a10491995e8023cb271521499049834437f6bddec7c2ce26f9a7aadf6156789` |
| Binding IR | | `0cb3a53415d72ee941b58c8a0291bb7ae6caf3218d97778ea247cee58acd4fd8` |

The machine record is 17,293 bytes with SHA-256 `9fb1d2d367e8f2fb5f2f14b601217551b3b0730f726dcf9b0534a1f4b5151e40`.

## Limits

The Promise fixture schedules Lean work after one millisecond, so its latency includes that delay. Cancellation measures runtime shutdown, not an `AbortSignal` operation. The iterator uses the generated JavaScript cursor adapter and invokes a real Lean closure for every item. Node and the filesystem cache were warm after the first-call record. The approved baseline collector repeats this suite in nine fresh processes before a release budget uses its values.

## Commands

```sh
npm run test:performance-overhead
npm run benchmark:overhead -- \
  --output build/lean-link-spike/native-overhead-suite.json
```
