import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const projectRoot = new URL("../../", import.meta.url);
const bindingsUrl = new URL("build/performance-scale/bindings.mjs", projectRoot);

export const scalingGraphCounts = Object.freeze([1, 3, 10, 50]);
export const scalingProfiles = Object.freeze(["lazy", "startup", "final-static", "isolated"]);

const nanoseconds = milliseconds => Math.round(milliseconds * 1_000_000);

const timed = async operation => {
  const started = performance.now();
  const value = await operation();
  return { value, durationNs: nanoseconds(performance.now() - started) };
};

const timedSync = operation => {
  const started = performance.now();
  const value = operation();
  return { value, durationNs: nanoseconds(performance.now() - started) };
};

const summarize = samples => {
  const sorted = [...samples].sort((left, right) => left - right);
  const percentile = probability => sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * probability) - 1)
  ] ?? null;
  return Object.freeze({
    samples: samples.length,
    samplesNs: Object.freeze([...samples]),
    minimumNs: sorted[0] ?? null,
    medianNs: percentile(0.5),
    p95Ns: percentile(0.95),
    maximumNs: sorted.at(-1) ?? null,
    totalNs: samples.reduce((sum, value) => sum + value, 0),
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

const snapshot = (phase, modules = []) => Object.freeze({
  phase,
  process: processMemory(),
  wasmMemoryBytes: modules.reduce(
    (sum, module) => sum + module.HEAPU32.buffer.byteLength,
    0,
  ),
  runtimeInstances: modules.length,
});

const profileMainPath = (profile, count) => {
  if (profile === "lazy" || profile === "isolated") {
    return "build/performance-scale/lazy/main.mjs";
  }
  return `build/performance-scale/${profile}/${count}/main.mjs`;
};

const artifactPaths = (profile, count) => {
  const main = profileMainPath(profile, count);
  const paths = [main, main.replace(/\.mjs$/, ".wasm")];
  if (profile !== "final-static") {
    const directory = main.slice(0, main.lastIndexOf("/") + 1);
    for (let ordinal = 1; ordinal <= count; ordinal += 1) {
      paths.push(`${directory}scale-${String(ordinal).padStart(3, "0")}.so.wasm`);
    }
  }
  return paths;
};

const readArtifacts = async paths => {
  const artifacts = [];
  const started = performance.now();
  for (const path of paths) {
    const bytes = await readFile(new URL(path, projectRoot));
    artifacts.push(Object.freeze({
      path,
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }));
  }
  return Object.freeze({
    durationNs: nanoseconds(performance.now() - started),
    totalBytes: artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0),
    artifacts: Object.freeze(artifacts),
  });
};

const importFactory = async (path, profile, count) => {
  const url = new URL(path, projectRoot);
  url.searchParams.set("profile", profile);
  url.searchParams.set("count", String(count));
  url.searchParams.set("run", `${Date.now()}-${Math.random()}`);
  const imported = await timed(() => import(url));
  return { factory: imported.value.default, durationNs: imported.durationNs };
};

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

const validateCountAndProfile = (count, profile) => {
  if (!scalingGraphCounts.includes(count)) throw new Error(`unsupported graph count ${count}`);
  if (!scalingProfiles.includes(profile)) throw new Error(`unsupported scaling profile ${profile}`);
};

const callAndValidate = (surface, descriptor, input) => {
  const invoked = timedSync(() => surface.ping(input));
  const expected = (input + descriptor.expectedDelta) >>> 0;
  if (invoked.value !== expected) {
    throw new Error(`${descriptor.name}.ping returned ${invoked.value}, expected ${expected}`);
  }
  return invoked.durationNs;
};

const runComposed = async ({ count, profile, factory, bindings, phaseMemory }) => {
  const created = await timed(() => factory());
  const module = created.value;
  phaseMemory.push(snapshot("after-module-factory", [module]));
  const descriptors = bindings.descriptorsForCount(count);
  const prelinked = profile === "lazy" ? undefined : descriptors.map(item => item.id);
  const libraries = bindings.createLibraries(module, count, prelinked ? { prelinked } : undefined);
  const root = descriptors.at(-1);
  const resolution = timedSync(() => libraries.resolve(root.id));
  if (resolution.value.length !== count) throw new Error("scaling graph resolution omitted a library");
  phaseMemory.push(snapshot("after-graph-resolution", [module]));
  const loaded = await timed(() => libraries.load(root.id));
  phaseMemory.push(snapshot("after-load-and-initialize", [module]));

  const firstCallSamples = [];
  for (const descriptor of descriptors) {
    const surface = descriptor.id === root.id
      ? loaded.value
      : await libraries.load(descriptor.id);
    firstCallSamples.push(callAndValidate(surface, descriptor, 1000));
  }
  phaseMemory.push(snapshot("after-first-native-call", [module]));
  const diagnostics = libraries.diagnostics();
  if (
    diagnostics.runtimeInitializations !== 1 ||
    diagnostics.registrations !== count ||
    diagnostics.libraryInitializations !== count ||
    diagnostics.loadedLibraries !== count ||
    diagnostics.rejectedCalls !== 0
  ) {
    throw new Error(`invalid ${profile} scaling diagnostics: ${JSON.stringify(diagnostics)}`);
  }
  const shutdown = libraries.shutdown();
  if (!shutdown) throw new Error(`${profile} scaling runtime did not shut down`);
  phaseMemory.push(snapshot("after-shutdown", [module]));
  return Object.freeze({
    runtimeInstances: 1,
    moduleFactory: summarize([created.durationNs]),
    graphResolution: summarize([resolution.durationNs]),
    libraryLoad: summarize([loaded.durationNs]),
    firstNativeCall: summarize(firstCallSamples),
    loaderEvents: libraries.measurements(),
    diagnostics: Object.freeze([diagnostics]),
    shutdown: Object.freeze([shutdown]),
  });
};

const runIsolated = async ({ count, factory, bindings, phaseMemory }) => {
  const descriptors = bindings.descriptorsForCount(count);
  const runtimes = [];
  const factorySamples = [];
  const graphResolutionSamples = [];
  const loadSamples = [];
  const firstCallSamples = [];
  const loaderEvents = [];
  const diagnostics = [];

  for (const descriptor of descriptors) {
    const created = await timed(() => factory());
    factorySamples.push(created.durationNs);
    const libraries = bindings.createIsolatedLibrary(created.value, descriptor);
    runtimes.push({ module: created.value, libraries, descriptor, surface: null });
  }
  const modules = runtimes.map(runtime => runtime.module);
  phaseMemory.push(snapshot("after-isolated-module-factories", modules));

  for (const runtime of runtimes) {
    const resolution = timedSync(() => runtime.libraries.resolve(runtime.descriptor.id));
    graphResolutionSamples.push(resolution.durationNs);
  }
  phaseMemory.push(snapshot("after-isolated-graph-resolution", modules));

  for (const runtime of runtimes) {
    const loaded = await timed(() => runtime.libraries.load(runtime.descriptor.id));
    runtime.surface = loaded.value;
    loadSamples.push(loaded.durationNs);
    loaderEvents.push(...runtime.libraries.measurements());
  }
  phaseMemory.push(snapshot("after-isolated-load-and-initialize", modules));

  for (const runtime of runtimes) {
    firstCallSamples.push(callAndValidate(runtime.surface, runtime.descriptor, 1000));
  }
  phaseMemory.push(snapshot("after-isolated-first-native-call", modules));

  for (const runtime of runtimes) {
    const value = runtime.libraries.diagnostics();
    diagnostics.push(value);
    if (
      value.runtimeInitializations !== 1 || value.registrations !== 1 ||
      value.libraryInitializations !== 1 || value.loadedLibraries !== 1 ||
      value.rejectedCalls !== 0
    ) {
      throw new Error(`invalid isolated scaling diagnostics: ${JSON.stringify(value)}`);
    }
  }
  const shutdown = runtimes.map(runtime => runtime.libraries.shutdown());
  if (!shutdown.every(Boolean)) throw new Error("an isolated scaling runtime did not shut down");
  phaseMemory.push(snapshot("after-isolated-shutdown", modules));
  return Object.freeze({
    runtimeInstances: count,
    moduleFactory: summarize(factorySamples),
    graphResolution: summarize(graphResolutionSamples),
    libraryLoad: summarize(loadSamples),
    firstNativeCall: summarize(firstCallSamples),
    loaderEvents: Object.freeze(loaderEvents),
    diagnostics: Object.freeze(diagnostics),
    shutdown: Object.freeze(shutdown),
  });
};

export const runScalingProfile = async ({ count, profile }) => {
  validateCountAndProfile(count, profile);
  const phaseMemory = [snapshot("before-artifact-read")];
  const mainPath = profileMainPath(profile, count);
  const artifactRead = await readArtifacts(artifactPaths(profile, count));
  phaseMemory.push(snapshot("after-artifact-read"));
  const imported = await importFactory(mainPath, profile, count);
  phaseMemory.push(snapshot("after-module-import"));
  const bindings = await import(bindingsUrl);
  const composition = profile === "isolated"
    ? await runIsolated({ count, factory: imported.factory, bindings, phaseMemory })
    : await runComposed({ count, profile, factory: imported.factory, bindings, phaseMemory });
  const acceptedCalls = composition.firstNativeCall.samples;
  if (acceptedCalls !== count) throw new Error("the scaling profile did not call every native API");

  return Object.freeze({
    schemaVersion: 1,
    kind: "lean-bridge-library-scaling-profile",
    recordedAt: new Date().toISOString(),
    source: currentRevision(),
    profile,
    graph: Object.freeze({
      libraryCount: count,
      dependencyShape: "linear-chain",
      requestedRoot: `performance/scale-${String(count).padStart(3, "0")}@1.0.0`,
    }),
    environment: Object.freeze({
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      clock: "node:perf_hooks.performance.now",
      timingUnit: "nanoseconds",
      cacheState: "filesystem-warmed-by-artifact-hash-read",
      transport: "local-filesystem",
    }),
    artifacts: artifactRead.artifacts,
    bytes: Object.freeze({
      artifactCount: artifactRead.artifacts.length,
      totalBytes: artifactRead.totalBytes,
    }),
    phases: Object.freeze({
      artifactRead: summarize([artifactRead.durationNs]),
      moduleImport: summarize([imported.durationNs]),
      moduleFactory: composition.moduleFactory,
      graphResolution: composition.graphResolution,
      libraryLoad: composition.libraryLoad,
      firstNativeCall: composition.firstNativeCall,
    }),
    composition: Object.freeze({
      runtimeInstances: composition.runtimeInstances,
      loaderEvents: composition.loaderEvents,
      diagnostics: composition.diagnostics,
      shutdown: composition.shutdown,
    }),
    memory: Object.freeze({ phaseSnapshots: Object.freeze(phaseMemory) }),
    correctness: Object.freeze({
      accepted: true,
      checkedNativeCalls: acceptedCalls,
      expectedRule: "input-plus-one-based-ordinal",
    }),
    limitations: Object.freeze([
      "Local artifact reads stand in for network download and warm the filesystem before instantiation.",
      "Emscripten performs dynamic compilation, linking, and constructor registration in one load operation, so lazy loader events report that combined duration.",
      "Startup and final-static registration occurs inside the module factory duration.",
      "Process memory includes Node and harness allocations in addition to WebAssembly state.",
      "This measurement record does not define a release budget.",
    ]),
  });
};

export const runScalingSuite = async ({ counts = scalingGraphCounts, profiles = scalingProfiles } = {}) => {
  const runs = [];
  for (const count of counts) {
    for (const profile of profiles) runs.push(await runScalingProfile({ count, profile }));
  }
  return Object.freeze({
    schemaVersion: 1,
    kind: "lean-bridge-library-scaling-suite",
    runs: Object.freeze(runs),
  });
};
