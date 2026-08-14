/**
 * Implements the overhead module in the performance subsystem.
 *
 * @file
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";

import createLazyModule from "../../build/lean-link-spike/lazy/main.mjs";
import { createLibraryLoader } from "../../poc/link-spike/loader.mjs";
import {
	installOverheadIteratorRuntime,
	overheadBindingIrSha256,
	overheadDescriptor,
} from "./overhead-fixture.mjs";

const nowNs = () => process.hrtime.bigint();
const toNumber = value => Number(value);

const percentile = (sorted, probability) => sorted[
	Math.min(sorted.length - 1, Math.ceil(sorted.length * probability) - 1)
] ?? null;

const summarize = samples => {
	const sorted = [...samples].sort((left, right) => left - right);
	return Object.freeze({
		samples: samples.length
		, samplesNs: Object.freeze([...samples])
		, minimumNs: sorted[0] ?? null
		, medianNs: percentile(sorted, 0.5)
		, p95Ns: percentile(sorted, 0.95)
		, maximumNs: sorted.at(-1) ?? null
		, totalNs: samples.reduce((sum, value) => sum + value, 0)
	});
};

const measureSync = operation => {
	const started = nowNs();
	const value = operation();
	return { value, durationNs: toNumber(nowNs() - started) };
};

const measureAsync = async operation => {
	const started = nowNs();
	const value = await operation();
	return { value, durationNs: toNumber(nowNs() - started) };
};

const sampleSync = ({ samples, iterations, operation }) => {
	const values = [];
	for(let sample = 0; sample < samples; sample += 1)
	{
		const started = nowNs();
		for(let index = 0; index < iterations; index += 1) operation(index);
		values.push(toNumber(nowNs() - started) / iterations);
	}
	return summarize(values);
};

const sampleAsync = async ({ samples, operation }) => {
	const values = [];
	for(let sample = 0; sample < samples; sample += 1)
	{
		const invoked = await measureAsync(() => operation(sample));
		values.push(invoked.durationNs);
	}
	return summarize(values);
};

const currentRevision = () => {
	try
	{
		return Object.freeze({
			commit: execFileSync("git", ["rev-parse", "HEAD"], {
				encoding: "utf8"
				, cwd: new URL("../../", import.meta.url).pathname
			}).trim()
			, dirty: execFileSync("git", ["status", "--porcelain"], {
				encoding: "utf8"
				, cwd: new URL("../../", import.meta.url).pathname
			}).trim().length > 0
		});
	} catch
	{
		return Object.freeze({ commit: null, dirty: null });
	}
};

const artifact = async path => {
	const bytes = await readFile(new URL(`../../${path}`, import.meta.url));
	return Object.freeze({
		path
		, bytes: bytes.byteLength
		, sha256: createHash("sha256").update(bytes).digest("hex")
	});
};

const payload = ({ width, count }) => Object.freeze({
	enabled: true
	, count
	, label: `typed-${"λ".repeat(width)}`
	, bytes: new Uint8Array(Array.from({ length: width }, (_, index) => index & 0xff))
	, values: Object.freeze(Array.from({ length: width }, (_, index) => index >>> 0))
});

const assertRoundTrip = (input, output) => {
	if(
		output.enabled !== !input.enabled || output.count !== input.count + 1
    || output.label !== input.label || output.bytes.length !== input.bytes.length
    || output.values.length !== input.values.length
	) throw new Error("copied record did not preserve its typed shape");
};

const createRuntime = async options => {
	const module = await createLazyModule();
	const iterator = installOverheadIteratorRuntime(module);
	const libraries = createLibraryLoader(module, {
		libraries: [overheadDescriptor],
		...options
	});
	const api = await libraries.load(overheadDescriptor);
	return { module, iterator, libraries, api };
};

const cancellationSamples = async ({ samples = 12, width = 16 } = {}) => {
	const durations = [];
	let checked = 0;
	for(let sample = 0; sample < samples; sample += 1)
	{
		const transitions = [];
		const runtime = await createRuntime({
			onPendingTransition: transition => transitions.push(transition.event)
		});
		const pending = Array.from(
			{ length: width },
			(_, index) => runtime.api.deferBoxValue(index + 1),
		);
		const shutdown = measureSync(() => runtime.libraries.shutdown());
		if(!shutdown.value) throw new Error("cancellation runtime rejected shutdown");
		durations.push(shutdown.durationNs);
		const settled = await Promise.allSettled(pending);
		if(settled.some(item => item.status !== "rejected" || item.reason.code !== "operation-cancelled"))
		{
			throw new Error("shutdown did not cancel every pending public Promise");
		}
		if(
			transitions.filter(event => event === "begin").length !== width
      || transitions.filter(event => event === "cancel").length !== width
		) throw new Error("pending transition record omitted cancellation");
		checked += settled.length;
	}
	return Object.freeze({
		pendingPerSample: width
		, checkedPromises: checked
		, shutdown: summarize(durations)
	});
};

/**
 * Runs native overhead suite and returns a structured result suitable for the reproducible performance evidence pipeline.
 *
 * @param options - Sample and iteration counts for every scalar, lifecycle, copy, callback, iterator, Promise, and cancellation metric.
 */
export const runNativeOverheadSuite = async (options = {}) => {
	const configuration = Object.freeze({
		scalarSamples: options.scalarSamples ?? 40
		, scalarIterations: options.scalarIterations ?? 10_000
		, lifecycleSamples: options.lifecycleSamples ?? 40
		, lifecycleIterations: options.lifecycleIterations ?? 1_000
		, copiedSamples: options.copiedSamples ?? 30
		, copiedIterations: options.copiedIterations ?? 100
		, batchSamples: options.batchSamples ?? 30
		, iteratorSamples: options.iteratorSamples ?? 30
		, callbackSamples: options.callbackSamples ?? 40
		, callbackIterations: options.callbackIterations ?? 1_000
		, nestedCallbackIterations: options.nestedCallbackIterations ?? 100
		, exceptionIterations: options.exceptionIterations ?? 100
		, promiseSamples: options.promiseSamples ?? 30
		, cancellationSamples: options.cancellationSamples ?? 12
		, cancellationWidth: options.cancellationWidth ?? 16
	});
	const runtime = await createRuntime();
	const { api, iterator, libraries } = runtime;
	let checksum = 0;

	const first = {};
	const firstBox = measureSync(() => new api.Box(41));
	first.Box = firstBox.durationNs;
	const box = firstBox.value;
	const firstRead = measureSync(() => box.read());
	first.read = firstRead.durationNs;
	checksum += firstRead.value;
	const smallPayload = payload({ width: 8, count: 41 });
	const largePayload = payload({ width: 1024, count: 41 });
	const firstCopied = measureSync(() => api.roundTrip(smallPayload));
	first.roundTrip = firstCopied.durationNs;
	assertRoundTrip(smallPayload, firstCopied.value);
	const firstCallback = measureSync(() => api.withCallback(40, value => value));
	first.withCallback = firstCallback.durationNs;
	checksum += firstCallback.value;
	const firstClosureFactory = measureSync(() => api.makeAdder(1));
	first.makeAdder = firstClosureFactory.durationNs;
	const addOne = firstClosureFactory.value;
	iterator.setTransform(addOne);
	const firstClosure = measureSync(() => addOne(40));
	first.closureCall = firstClosure.durationNs;
	checksum += firstClosure.value;
	const firstIterator = measureSync(() => [...api.sequence(10, 4)]);
	first.sequence = firstIterator.durationNs;
	if(firstIterator.value.join(",") !== "11,12,13,14")
	{
		throw new Error("generated iterator returned the wrong Lean values");
	}
	const firstPromise = await measureAsync(() => api.deferBoxValue(42));
	first.deferBoxValue = firstPromise.durationNs;
	if(firstPromise.value !== 42) throw new Error("public Promise returned the wrong value");

	const scalarClosure = sampleSync({
		samples: configuration.scalarSamples
		, iterations: configuration.scalarIterations
		, operation:
			/**
       * Invokes the retained Lean closure and incorporates its scalar result into the anti-optimization checksum.
       *
       * @param index - Sample iteration used as the closure input.
       */
			function(index) { checksum += addOne(index & 0xffff); }
	});
	const retainedRead = sampleSync({
		samples: configuration.scalarSamples
		, iterations: configuration.scalarIterations
		, operation:
			/**
       * Reads the retained Box value and incorporates it into the anti-optimization checksum.
       */
			function() { checksum += box.read(); }
	});
	const boxLifecycle = sampleSync({
		samples: configuration.lifecycleSamples
		, iterations: configuration.lifecycleIterations
		, operation:
			/**
       * Measures a complete Box allocation, read, and explicit-disposal lifecycle.
       *
       * @param index - Sample iteration encoded as the temporary Box value.
       */
			function(index) {
				const temporary = new api.Box(index >>> 0);
				checksum += temporary.read();
				if(!temporary.dispose()) throw new Error("temporary Box did not dispose");
			}
	});
	const identityCache = sampleSync({
		samples: configuration.scalarSamples
		, iterations: configuration.scalarIterations
		, operation:
			/**
       * Confirms repeated identity lookups return the canonical wrapper for the retained Box.
       */
			function() {
				if(box.identity() !== box) throw new Error("canonical resource identity changed");
				checksum += 1;
			}
	});
	const copiedSmall = sampleSync({
		samples: configuration.copiedSamples
		, iterations: configuration.copiedIterations
		, operation:
			/**
       * Round-trips and validates the small copied payload across the generated binding boundary.
       */
			function() {
				const output = api.roundTrip(smallPayload);
				assertRoundTrip(smallPayload, output);
				checksum += output.count;
			}
	});
	const copiedLarge = sampleSync({
		samples: configuration.batchSamples
		, iterations: 1
		, operation:
			/**
       * Round-trips and validates the 1,024-value payload used to measure amortized copy cost.
       */
			function() {
				const output = api.roundTrip(largePayload);
				assertRoundTrip(largePayload, output);
				checksum += output.values.length;
			}
	});
	const callback = sampleSync({
		samples: configuration.callbackSamples
		, iterations: configuration.callbackIterations
		, operation:
			/**
       * Crosses the callback boundary once and incorporates the returned scalar into the checksum.
       *
       * @param index - Sample iteration reduced to the callback’s unsigned scalar input.
       */
			function(index) { checksum += api.withCallback(index & 0xffff, value => value); }
	});
	const nestedCallback = sampleSync({
		samples: configuration.callbackSamples
		, iterations: configuration.nestedCallbackIterations
		, operation:
			/**
       * Measures nested callback re-entry by forwarding the outer callback value through an inner callback.
       *
       * @param index - Sample iteration reduced to the outer callback’s unsigned scalar input.
       */
			function(index) {
				const value = api.withCallback(index & 0xffff, outer => (
					api.withCallback(outer, inner => inner)
				));
				checksum += value;
			}
	});
	const iteratorDelivery = sampleSync({
		samples: configuration.iteratorSamples
		, iterations: 1
		, operation:
			/**
       * Consumes and validates all 256 projected sequence values for one iterator sample.
       *
       * @param sample - Starting value passed to the generated sequence operation.
       */
			function(sample) {
				let seen = 0;
				let total = 0;
				for(const value of api.sequence(sample, 256))
				{
					seen += 1;
					total += value;
				}
				if(seen !== 256) throw new Error("generated iterator stopped early");
				checksum += total;
			}
	});
	const callbackException = sampleSync({
		samples: configuration.callbackSamples
		, iterations: configuration.exceptionIterations
		, operation:
			/**
       * Verifies that a callback exception crosses the binding boundary without losing object identity.
       */
			function() {
				const expected = new Error("measured callback failure");
				try
				{
					api.withCallback(40, () => { throw expected; });
					throw new Error("callback exception did not cross the boundary");
				} catch(error)
				{
					if(error !== expected) throw error;
					checksum += 1;
				}
			}
	});
	const promiseLatency = await sampleAsync({
		samples: configuration.promiseSamples
		, operation:
			/**
       * Awaits one deferred Box value and verifies the projected Promise preserves its scalar result.
       *
       * @param index - Sample iteration offset to form the expected deferred value.
       */
			async function(index) {
				const result = await api.deferBoxValue(index + 100);
				if(result !== index + 100) throw new Error("Promise result drifted");
				checksum += result;
			}
	});
	const cancellation = await cancellationSamples({
		samples: configuration.cancellationSamples
		, width: configuration.cancellationWidth
	});

	const diagnosticsBeforeCleanup = libraries.diagnostics();
	if(
		diagnosticsBeforeCleanup.pendingOperations.live !== 0
    || diagnosticsBeforeCleanup.callbacks.live !== 0
    || diagnosticsBeforeCleanup.callbacks.activeFrames !== 0
    || iterator.diagnostics().live !== 0
	) throw new Error("overhead suite retained transient state before cleanup");
	if(!addOne.dispose()) throw new Error("Lean closure did not dispose");
	if(!box.dispose()) throw new Error("Box did not dispose");
	const diagnosticsAfterCleanup = libraries.diagnostics();
	if(
		diagnosticsAfterCleanup.resources.live !== 0
    || diagnosticsAfterCleanup.nativeClosures.live !== 0
	) throw new Error("overhead suite retained an owned value after cleanup");
	const shutdown = libraries.shutdown();
	if(!shutdown) throw new Error("overhead suite runtime did not shut down");
	if(checksum === 0) throw new Error("overhead benchmark checksum stayed zero");

	const batchPerItem = Object.freeze({
		samples: copiedLarge.samples
		, samplesNs: Object.freeze(copiedLarge.samplesNs.map(value => value / 1024))
		, minimumNs: copiedLarge.minimumNs / 1024
		, medianNs: copiedLarge.medianNs / 1024
		, p95Ns: copiedLarge.p95Ns / 1024
		, maximumNs: copiedLarge.maximumNs / 1024
		, totalNs: copiedLarge.totalNs / 1024
	});

	return Object.freeze({
		schemaVersion: 1
		, kind: "lean-bridge-native-overhead-suite"
		, recordedAt: new Date().toISOString()
		, source: currentRevision()
		, environment: Object.freeze({
			node: process.version
			, platform: `${os.platform()} ${os.release()}`
			, architecture: os.arch()
			, cpu: os.cpus()[0]?.model ?? "unknown"
			, logicalCpuCount: os.cpus().length
			, clock: "process.hrtime.bigint"
			, timingUnit: "nanoseconds"
			, cacheState: "warm-runtime-and-filesystem-after-first-call-record"
		})
		, artifacts: Object.freeze(await Promise.all([
			artifact("build/lean-link-spike/lazy/main.wasm")
			, artifact("build/lean-link-spike/lazy/alpha.so.wasm")
			, artifact("poc/lean-link-spike/graph-lock.json")
		]))
		, bindingIrSha256: overheadBindingIrSha256
		, method: configuration
		, firstCallsNs: Object.freeze(first)
		, operations: Object.freeze({
			scalarLeanClosure: scalarClosure
			, retainedBoxRead: retainedRead
			, boxConstructReadDispose: boxLifecycle
			, canonicalIdentityCache: identityCache
			, copiedRecordSmall: copiedSmall
			, copiedRecord1024Items: copiedLarge
			, copiedRecordPerItem: batchPerItem
			, callback: callback
			, nestedCallback
			, iterator256Items: iteratorDelivery
			, iteratorPerItem: Object.freeze({
				...iteratorDelivery,
				samplesNs: Object.freeze(iteratorDelivery.samplesNs.map(value => value / 256))
				, minimumNs: iteratorDelivery.minimumNs / 256
				, medianNs: iteratorDelivery.medianNs / 256
				, p95Ns: iteratorDelivery.p95Ns / 256
				, maximumNs: iteratorDelivery.maximumNs / 256
				, totalNs: iteratorDelivery.totalNs / 256
			})
			, callbackException
			, promiseLatency
			, cancellationShutdown: cancellation.shutdown
		})
		, cancellation: Object.freeze({
			pendingPerSample: cancellation.pendingPerSample
			, checkedPromises: cancellation.checkedPromises
		})
		, correctness: Object.freeze({
			accepted: true
			, checksum
			, iterator: iterator.diagnostics()
			, diagnosticsBeforeCleanup
			, diagnosticsAfterCleanup
			, shutdown
		})
		, limitations: Object.freeze([
			"Promise samples include the fixture's one millisecond asynchronous scheduling delay."
			, "Cancellation measures runtime shutdown with sixteen pending public Promises, not an AbortSignal API."
			, "The generated iterator adapter owns its cursor in JavaScript and invokes a real Lean closure for every item. It is an adapter measurement, not a native Lean cursor implementation."
			, "The 1,024-item copied record measures one rich-value boundary transfer. It does not claim semantic equivalence to 1,024 scalar calls."
			, "This single-process run is diagnostic. Only the approved nine-fork collector can promote its measurements into a baseline."
		])
	});
};
