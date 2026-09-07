# Proven Lean token-bucket rate limiter

A token bucket permits a bounded burst while limiting sustained spending. Requests consume integer credits, time restores credits, and the balance cannot exceed capacity. The generic Lean implementation and its optimized refill arithmetic are proved directly, then compiled to WebAssembly.

## Interaction

The page opens with eight simultaneous one-token requests against a five-token bucket. Five pass and three are throttled. The clock is paused, so the empty balance and each decision remain available to inspect.

Select **Replay burst & refill** to watch that burst, followed by two requests at 0.5 and 1 second. A refill rate of two tokens per second supplies each later request. Simultaneous arrivals are revealed separately for readability but retain their shared timestamp.

Send individual requests or bursts, advance the clock manually, or let it play. Capacity and refill controls start a new full bucket; changing request cost preserves the current balance. Reset preserves your settings, while replay restores the introductory example. Throttled requests are not queued. Selecting an arrival shows the balance at that request, its cost, remaining balance, and retry advice.

## Generic API

```js
import { createBucket, prepareTrace } from "./runtime.mjs";

const bucket = await createBucket({ capacity: 5000, rate: 2 });
bucket.request(0, 5000);  // allowed, no credits remain
bucket.request(250, 1000);
// throttled, 500 credits remain, retryAfter: 250 ticks
bucket.request(500, 1000); // allowed, no credits remain
bucket.snapshot();        // { tokens: 0, timestamp: 500 }
bucket.dispose();

const run = await prepareTrace({
  capacity: 5, rate: 1, now: 0,
  operations: new Uint32Array([0, 5, 0, 1, 1, 1])
});
const records = run(); // three seven-word result records
run.dispose();
```

Lean uses natural numbers with no API, browser, or wall-clock dependency. Configuration supplies capacity in credits and refill rate in credits per tick. State starts full at the optional initial timestamp, which defaults to zero. The page chooses 1,000 credits per displayed token and one millisecond per tick. This preserves fractional tokens without floating-point accumulation or rounding them into spendable tokens.

For a request at a nondecreasing timestamp:

```text
available = min(capacity, previous balance + elapsed ticks × rate)
allowed   = cost ≤ available
balance   = available − cost if allowed, otherwise available
```

The stored timestamp advances even when a request is throttled. A backward timestamp instead produces a distinct clock-regression result and leaves both stored fields unchanged. Requests at the same timestamp spend serially. Zero capacity, zero refill, and zero cost are supported. Costs above capacity always throttle. A zero-cost request is allowed when its timestamp is valid; `advance(timestamp)` uses that operation without introducing a separate refill implementation.

`request` returns `status`, `allowed`, `tokens`, `timestamp`, `available`, `refilled`, and `retryAfter`. A finite retry is the earliest integer delay that can cover the rejected cost, assuming no intervening spending. Zero refill or a cost above capacity gives `null`; allowed requests give zero. Clock regressions also give `null` and must be retried with a valid timestamp.

`bucket.run(operations)` continues the current state. `prepareTrace` snapshots the input and configuration before its first await, then returns a reusable synchronous function that starts each run from the same full initial bucket. Both accept timestamp/cost pairs and return these seven words per request:

| Word | Meaning |
| --- | --- |
| 0 | Status: 0 allowed, 1 throttled, 2 clock regression |
| 1 | Remaining credits |
| 2 | Stored timestamp |
| 3 | Credits available before spending |
| 4 | Credits added by this refill |
| 5 | Whether a finite retry delay is present, 0 or 1 |
| 6 | Retry delay in ticks, or zero when absent |

The browser adapter accepts unsigned 32-bit configuration, timestamps, and costs, including `0xffffffff`. Traces must be `Uint32Array` pairs and contain at most one million requests. Invalid inputs are rejected before mutation. Handles own independent storage, returned arrays own their data, and disposal is idempotent. Using a disposed handle throws.

## Proofs and arithmetic

The refill implementation tests whether elapsed time saturates the remaining capacity before multiplying. In the unsaturated branch, the product is bounded by that remaining capacity. Retry calculation uses `(cost - available - 1) / rate + 1` after establishing insufficient credit, avoiding an overflow-prone ceiling numerator. Lean's natural-number arithmetic is exact; the word-bound proofs show that the exported results fit the adapter's representation.

The batch loop carries balance and timestamp as scalar arguments instead of allocating a state record for every event. `runCredits_eq` proves it returns exactly the same state and output as the reference transition loop. Inlining also removes intermediate decision records from this path.

Checked guarantees include:

- `refill_eq` and `refill_product_bounded`: optimized refill equals the capped mathematical formula, and its unsaturated product stays within the remaining capacity.
- `exportedStep_admitted_iff`: the actual serialized admission status is allowed exactly when the timestamp is valid and the request is affordable.
- `request_valid`, `request_conservation`, and `rejected_unspent`: transitions preserve capacity, account for every spent credit, and never charge a rejected request.
- `clock_regression_unchanged` and `request_time_monotone`: regressing timestamps leave state unchanged and stored time never decreases.
- `trace_interval_bound`: spending over any contiguous history interval is bounded by capacity plus the interval's elapsed refill allowance.
- `exportedRun_wire` and `exportedRun_no_over_admission`: batch output equals the proved transition sequence; the costs marked allowed in that exact output cannot exceed initial credit plus elapsed refill.
- `request_retry_earliest`: a returned finite retry delay is the first tick at which the actual next request can succeed without intervening requests.
- `exportedStep_word_bounds` and `exportedRun_word_bounds`: bounded valid inputs produce bounded output words, including full-width timestamps and retry delays.

Both Lean source modules appear in the syntax-highlighted viewer, build receipt, and browser checker bundles. The build checks their proofs and executable guards before compiling the core. The receipt records the checked source hashes. There is no runtime certificate, fallback limiter, or unchecked proof declaration. The C bridge copies and owns values; JavaScript supplies timestamps, selects display units, and renders the results.

## Verification and benchmark

```sh
bash demos/lean-token-bucket/build.sh
node --test demos/lean-token-bucket/test.mjs
node demos/lean-token-bucket/benchmark.mjs --assert
```

The compiled tests compare complete records against an independent BigInt oracle. They cover 14,753 exhaustive small traces, full-width boundary arithmetic, backward clocks, zero values, oversized costs, the introductory scenario, a 100,000-request trace, copied inputs and outputs, independent handles, and disposal. A one-million-request test checks output length and existing handles after heap growth.

The automatic browser benchmark compares Lean/Wasm against an exact numeric JavaScript limiter on the same 1,024-request trace. Preparation is outside timing; each implementation allocates and returns the same complete seven-word records inside timing. Every comparison is checked against the BigInt oracle. Five excluded samples warm both implementations before 100 measured pairs, with alternating order and adaptive batching for coarse browser timers. The command-line benchmark also checks 4,096 requests and enforces absolute and relative performance gates.

Chromium on the development machine measured a 0.07 ms Lean median and 0.16 ms p95 against a 0.02 ms JavaScript median for 1,024 requests, a 3.3× relative cost using unrounded measurements. A repeat measured 3.4×. These measurements were taken on September 7, 2026; the page measures the current browser again. The scalar loop and inlining reduced the initial Node median from 0.112 to 0.070 ms for 1,024 requests and from 0.427 to 0.274 ms for 4,096 requests.

## Source

The single-bucket, whole-request admission rule follows the strict token-bucket model in [RFC 3290, Appendix A.4](https://www.rfc-editor.org/rfc/rfc3290#appendix-A.4). This directory contains a new Lean implementation and proofs. Retry advice and rejection of backward timestamps are explicit API decisions.
