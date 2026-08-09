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
import { createDeterministicFinalizerControls } from "./lifecycle-fixture.mjs";

const projectRoot = new URL("../../", import.meta.url);

const currentRevision = () => {
  try {
    return Object.freeze({
      commit: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: new URL(projectRoot).pathname,
        encoding: "utf8",
      }).trim(),
      dirty: execFileSync("git", ["status", "--porcelain"], {
        cwd: new URL(projectRoot).pathname,
        encoding: "utf8",
      }).trim().length > 0,
    });
  } catch {
    return Object.freeze({ commit: null, dirty: null });
  }
};

const artifact = async path => {
  const bytes = await readFile(new URL(path, projectRoot));
  return Object.freeze({
    path,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
};

const processMemory = () => {
  const value = process.memoryUsage();
  return Object.freeze({
    rssBytes: value.rss,
    heapUsedBytes: value.heapUsed,
    externalBytes: value.external,
    arrayBuffersBytes: value.arrayBuffers,
  });
};

const createRuntime = async (options = {}) => {
  let maximumCallbackDepth = 0;
  const module = await createLazyModule();
  const iterator = installOverheadIteratorRuntime(module);
  const libraries = createLibraryLoader(module, {
    libraries: [overheadDescriptor],
    ...options,
    onCallbackFrame(event) {
      maximumCallbackDepth = Math.max(maximumCallbackDepth, event.depth);
      options.onCallbackFrame?.(event);
    },
  });
  const api = await libraries.load(overheadDescriptor);
  return Object.freeze({
    module,
    iterator,
    libraries,
    api,
    maximumCallbackDepth: () => maximumCallbackDepth,
  });
};

const assertZeroLiveState = (diagnostics, iterator, label) => {
  const live = Object.freeze({
    resources: diagnostics.resources.live,
    hostValues: diagnostics.hostValues.live,
    nativeClosures: diagnostics.nativeClosures.live,
    callbacks: diagnostics.callbacks.live,
    callbackFrames: diagnostics.callbacks.activeFrames,
    pendingOperations: diagnostics.pendingOperations.live,
    iterators: iterator.live,
  });
  if (Object.values(live).some(value => value !== 0)) {
    throw new Error(`${label} retained lifecycle state: ${JSON.stringify(live)}`);
  }
  return live;
};

const richPayload = count => Object.freeze({
  enabled: true,
  count,
  label: `lifecycle-${count}`,
  bytes: new Uint8Array([0, 1, 127, 128, 255]),
  values: Object.freeze([0, count >>> 0, 0xffff_ffff]),
});

const assertCopiedPayload = (input, output) => {
  if (
    output.enabled !== false || output.count !== input.count + 1 ||
    output.label !== input.label || output.bytes.length !== input.bytes.length ||
    output.values.length !== input.values.length
  ) throw new Error("lifecycle copied-value result drifted");
};

const maximum = (values, fallback = 0) => values.length === 0 ? fallback : Math.max(...values);

export const runLifecycleStabilitySuite = async (options = {}) => {
  const method = Object.freeze({
    rounds: options.rounds ?? 24,
    resourcesPerRound: options.resourcesPerRound ?? 256,
    closuresPerRound: options.closuresPerRound ?? 32,
    callbacksPerRound: options.callbacksPerRound ?? 128,
    copiedValuesPerRound: options.copiedValuesPerRound ?? 64,
    pendingPerRound: options.pendingPerRound ?? 32,
    iteratorItemsPerRound: options.iteratorItemsPerRound ?? 256,
    collectHostGarbage: options.collectHostGarbage ?? true,
  });
  for (const [name, value] of Object.entries(method)) {
    if (name === "collectHostGarbage") continue;
    if (!Number.isInteger(value) || value < 1) {
      throw new TypeError(`${name} must be a positive integer`);
    }
  }
  const hostGcAvailable = typeof globalThis.gc === "function";
  const memorySamples = [];
  const sampleMemory = (phase, round, modules) => {
    if (method.collectHostGarbage && hostGcAvailable) globalThis.gc();
    const sample = Object.freeze({
      phase,
      round,
      process: processMemory(),
      wasmMemoryBytes: modules.reduce(
        (sum, module) => sum + module.HEAP8.buffer.byteLength,
        0,
      ),
      runtimeInstances: modules.length,
    });
    memorySamples.push(sample);
    return sample;
  };

  const runtime = await createRuntime();
  const { api, libraries, iterator, module } = runtime;
  const baselineDiagnostics = libraries.diagnostics();
  const baselineLive = assertZeroLiveState(
    baselineDiagnostics,
    iterator.diagnostics(),
    "loaded baseline",
  );
  const initialMemory = sampleMemory("loaded-baseline", null, [module]);
  const rounds = [];
  let stableWasmBytes = null;
  let checkedResourceCalls = 0;
  let checkedCopiedValues = 0;
  let checkedCallbacks = 0;
  let checkedClosures = 0;
  let checkedPromises = 0;
  let checkedIteratorItems = 0;

  for (let round = 0; round < method.rounds; round += 1) {
    const boxes = Array.from(
      { length: method.resourcesPerRound },
      (_, index) => new api.Box((round + index) >>> 0),
    );
    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index];
      if (box.read() !== ((round + index) >>> 0) || box.identity() !== box) {
        throw new Error("retained resource identity or value drifted");
      }
      checkedResourceCalls += 2;
    }
    const resourcesPeak = libraries.diagnostics().resources.live;
    sampleMemory("resource-high-water", round, [module]);

    for (let index = 0; index < method.copiedValuesPerRound; index += 1) {
      const input = richPayload((round + index) >>> 0);
      assertCopiedPayload(input, api.roundTrip(input));
      checkedCopiedValues += 1;
    }

    for (let index = 0; index < method.callbacksPerRound; index += 1) {
      const expected = (index + 2) >>> 0;
      const actual = api.withCallback(index, value => value);
      if (actual !== expected) throw new Error("callback result drifted");
      checkedCallbacks += 1;
    }
    const nested = api.withCallback(round, outer => (
      api.withCallback(outer, inner => inner)
    ));
    if (nested !== round + 4) throw new Error("nested callback result drifted");
    checkedCallbacks += 2;

    const closures = Array.from(
      { length: method.closuresPerRound },
      (_, index) => api.makeAdder(index),
    );
    for (let index = 0; index < closures.length; index += 1) {
      if (closures[index](round) !== round + index) {
        throw new Error("retained Lean closure result drifted");
      }
      checkedClosures += 1;
    }
    const closuresPeak = libraries.diagnostics().nativeClosures.live;

    const pending = Array.from(
      { length: method.pendingPerRound },
      (_, index) => api.deferBoxValue((round + index) >>> 0),
    );
    const pendingPeak = libraries.diagnostics().pendingOperations.live;
    const settled = await Promise.all(pending);
    if (settled.some((value, index) => value !== ((round + index) >>> 0))) {
      throw new Error("pending operation result drifted");
    }
    checkedPromises += settled.length;

    iterator.setTransform(closures[0]);
    const cursor = api.sequence(round, method.iteratorItemsPerRound)[Symbol.iterator]();
    const first = cursor.next();
    if (first.done || first.value !== round) throw new Error("iterator first item drifted");
    const iteratorPeak = iterator.diagnostics().live;
    let iteratorCount = 1;
    while (!cursor.next().done) iteratorCount += 1;
    if (iteratorCount !== method.iteratorItemsPerRound) {
      throw new Error("iterator item count drifted");
    }
    checkedIteratorItems += iteratorCount;

    for (const closure of closures) {
      if (!closure.dispose()) throw new Error("Lean closure did not dispose");
    }
    const stale = boxes[0];
    for (const box of boxes) {
      if (!box.dispose()) throw new Error("retained resource did not dispose");
    }
    let staleCode = null;
    try {
      stale.read();
    } catch (error) {
      staleCode = error.code;
    }
    if (staleCode !== "resource-disposed") throw new Error("disposed wrapper remained callable");
    const replacement = new api.Box(round);
    if (replacement.read() !== round) throw new Error("replacement resource was rejected");
    replacement.dispose();

    const diagnostics = libraries.diagnostics();
    const liveAfter = assertZeroLiveState(
      diagnostics,
      iterator.diagnostics(),
      `round ${round}`,
    );
    const settledMemory = sampleMemory("round-settled", round, [module]);
    if (stableWasmBytes === null) stableWasmBytes = settledMemory.wasmMemoryBytes;
    else if (settledMemory.wasmMemoryBytes !== stableWasmBytes) {
      throw new Error("Wasm memory grew after the warmup lifecycle round");
    }
    rounds.push(Object.freeze({
      round,
      peaks: Object.freeze({
        resources: resourcesPeak,
        nativeClosures: closuresPeak,
        pendingOperations: pendingPeak,
        iterators: iteratorPeak,
        callbackDepth: runtime.maximumCallbackDepth(),
      }),
      liveAfter,
      staleWrapperError: staleCode,
      wasmMemoryBytes: settledMemory.wasmMemoryBytes,
    }));
  }

  const primaryFinalDiagnostics = libraries.diagnostics();
  const primaryFinalMemory = sampleMemory("primary-retained", null, [module]);
  if (!libraries.shutdown()) throw new Error("primary lifecycle runtime rejected shutdown");

  const firstRuntime = await createRuntime();
  const secondRuntime = await createRuntime();
  const foreignBox = new firstRuntime.api.Box(41);
  let crossRuntimeCode = null;
  try {
    secondRuntime.api.Box.prototype.read.call(foreignBox);
  } catch (error) {
    crossRuntimeCode = error.code;
  }
  if (crossRuntimeCode !== "cross-runtime-handle") {
    throw new Error("cross-runtime resource use was not rejected");
  }
  foreignBox.dispose();
  firstRuntime.libraries.shutdown();
  secondRuntime.libraries.shutdown();

  const finalizerControls = createDeterministicFinalizerControls();
  const finalizerRuntime = await createRuntime(finalizerControls.loaderOptions);
  new finalizerRuntime.api.Box(42);
  finalizerControls.queueLastResource();
  const beforeSafeEntry = finalizerControls.nativeLiveResources(finalizerRuntime.module);
  const triggerPayload = richPayload(41);
  assertCopiedPayload(triggerPayload, finalizerRuntime.api.roundTrip(triggerPayload));
  const afterSafeEntry = finalizerControls.nativeLiveResources(finalizerRuntime.module);
  const finalizerDiagnostics = finalizerRuntime.libraries.diagnostics();
  if (
    beforeSafeEntry !== 1 || afterSafeEntry !== 0 ||
    finalizerDiagnostics.leases.finalized !== 1 ||
    finalizerDiagnostics.resources.live !== 0
  ) throw new Error("queued finalization did not release at the next safe entry");
  finalizerRuntime.libraries.shutdown();

  const shutdownRuntime = await createRuntime();
  const shutdownBox = new shutdownRuntime.api.Box(43);
  const liveBeforeShutdown = shutdownRuntime.libraries.diagnostics().resources.live;
  const shutdownAccepted = shutdownRuntime.libraries.shutdown();
  const shutdownDiagnostics = shutdownRuntime.libraries.diagnostics();
  let expiredWrapperCode = null;
  try {
    shutdownBox.read();
  } catch (error) {
    expiredWrapperCode = error.code;
  }
  if (
    liveBeforeShutdown !== 1 || !shutdownAccepted ||
    shutdownDiagnostics.resources.live !== 0 ||
    expiredWrapperCode !== "runtime-shut-down"
  ) throw new Error("shutdown did not drain live ownership and expire its wrapper");

  const processFields = ["rssBytes", "heapUsedBytes", "externalBytes", "arrayBuffersBytes"];
  const highWaterProcess = Object.freeze(Object.fromEntries(processFields.map(field => [
    field,
    maximum(memorySamples.map(sample => sample.process[field])),
  ])));

  return Object.freeze({
    schemaVersion: 1,
    kind: "lean-bridge-lifecycle-stability-suite",
    recordedAt: new Date().toISOString(),
    source: currentRevision(),
    environment: Object.freeze({
      node: process.version,
      platform: `${os.platform()} ${os.release()}`,
      architecture: os.arch(),
      cpu: os.cpus()[0]?.model ?? "unknown",
      logicalCpuCount: os.cpus().length,
      hostGcAvailable,
    }),
    artifacts: Object.freeze(await Promise.all([
      artifact("build/lean-link-spike/lazy/main.wasm"),
      artifact("build/lean-link-spike/lazy/alpha.so.wasm"),
      artifact("poc/lean-link-spike/graph-lock.json"),
    ])),
    bindingIrSha256: overheadBindingIrSha256,
    method,
    memory: Object.freeze({
      samples: Object.freeze(memorySamples),
      baseline: initialMemory,
      highWater: Object.freeze({
        process: highWaterProcess,
        wasmMemoryBytes: maximum(memorySamples.map(sample => sample.wasmMemoryBytes)),
      }),
      retained: Object.freeze({
        process: Object.freeze(Object.fromEntries(processFields.map(field => [
          field,
          primaryFinalMemory.process[field] - initialMemory.process[field],
        ]))),
        wasmMemoryBytes: primaryFinalMemory.wasmMemoryBytes - initialMemory.wasmMemoryBytes,
      }),
      stableWasmBytesAfterWarmup: stableWasmBytes,
      hostHeapReliability: hostGcAvailable && method.collectHostGarbage
        ? "explicit-gc-between-snapshots"
        : "observational-only",
    }),
    lifecycle: Object.freeze({
      baselineLive,
      rounds: Object.freeze(rounds),
      highWater: Object.freeze({
        resources: maximum(rounds.map(round => round.peaks.resources)),
        nativeClosures: maximum(rounds.map(round => round.peaks.nativeClosures)),
        pendingOperations: maximum(rounds.map(round => round.peaks.pendingOperations)),
        iterators: maximum(rounds.map(round => round.peaks.iterators)),
        callbackDepth: maximum(rounds.map(round => round.peaks.callbackDepth)),
      }),
      retained: Object.freeze({
        resources: primaryFinalDiagnostics.resources.live,
        hostValues: primaryFinalDiagnostics.hostValues.live,
        nativeClosures: primaryFinalDiagnostics.nativeClosures.live,
        callbacks: primaryFinalDiagnostics.callbacks.live,
        pendingOperations: primaryFinalDiagnostics.pendingOperations.live,
        iterators: iterator.diagnostics().live,
      }),
      delayedFinalization: Object.freeze({
        nativeResourcesBeforeSafeEntry: beforeSafeEntry,
        nativeResourcesAfterSafeEntry: afterSafeEntry,
        finalizedLeases: finalizerDiagnostics.leases.finalized,
        retainedResources: finalizerDiagnostics.resources.live,
      }),
      crossRuntime: Object.freeze({ checked: true, errorCode: crossRuntimeCode }),
      shutdownWithLiveOwnership: Object.freeze({
        liveBeforeShutdown,
        liveAfterShutdown: shutdownDiagnostics.resources.live,
        shutdownAccepted,
        expiredWrapperCode,
      }),
    }),
    correctness: Object.freeze({
      accepted: true,
      checkedResourceCalls,
      checkedCopiedValues,
      checkedCallbacks,
      checkedClosures,
      checkedPromises,
      checkedIteratorItems,
      primaryShutdown: true,
    }),
    limitations: Object.freeze([
      "Host heap values are reliable for retained-state comparison only when Node exposes explicit garbage collection.",
      "Process RSS includes Node, generated bindings, and benchmark records in addition to Wasm.",
      "WebAssembly memory grows by pages and does not shrink. The suite requires a stable page count after the first lifecycle round.",
      "Delayed finalization uses a deterministic finalizer fixture because JavaScript garbage collection timing is not a testable clock.",
      "The finalizer fixture uses one private live-handle diagnostic. Every workload operation uses the generated public API.",
    ]),
  });
};
