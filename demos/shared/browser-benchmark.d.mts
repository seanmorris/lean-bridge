/**
 * Typed public contract for the standalone and React benchmark controller.
 *
 * @file
 */

/** Checked per-operation solver timings in milliseconds. */
export interface BenchmarkSample {leanMs: number; javascriptMs: number;}
/** Aggregates passed to the visible benchmark summary formatter. */
export interface BenchmarkSummary {
	javascriptMedian: number;
	leanMedian: number;
	leanP95: number;
	ratio: number;
	samples: BenchmarkSample[];
	trialCount: number;
}
/** Actions owned by a benchmark mount. */
export interface BenchmarkControls {cancel(): void; run(): Promise<void>; refresh(): void; dispose(): void;}
/**
 * Attach a disposable controller to an otherwise static DOM scaffold.
 *
 * @param options Benchmark mount configuration.
 * @param options.root Static benchmark scaffold.
 * @param options.prepare Prepare the owned solver.
 * @param options.sample Return checked solver timings.
 * @param options.summarize Format the completed comparison.
 * @param options.canRun Whether the demo has settled; notify changes with refresh().
 * @param options.trialCount Number of measured samples.
 * @param options.warmupCount Number of excluded warmups.
 */
export function attachBrowserBenchmark(options: {
	root: Element;
	prepare: () => Promise<void>;
	sample: (index: number, warmup: boolean) => BenchmarkSample | Promise<BenchmarkSample>;
	summarize: (summary: BenchmarkSummary) => string;
	canRun?: () => boolean;
	trialCount?: number;
	warmupCount?: number;
}): BenchmarkControls;
/**
 * Measure a synchronous operation with adaptive batching.
 *
 * @param operation Operation to measure.
 * @param minimumMs Minimum accumulated duration per batch.
 */
export function measureSyncBenchmark<T>(operation: () => T, minimumMs?: number): {milliseconds: number; result: T};
/**
 * Measure an asynchronous operation with adaptive batching.
 *
 * @param operation Operation to measure.
 * @param minimumMs Minimum accumulated duration per batch.
 */
export function measureAsyncBenchmark<T>(operation: () => Promise<T>, minimumMs?: number):
Promise<{milliseconds: number; result: T}>;
