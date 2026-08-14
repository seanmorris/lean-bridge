/**
 * Tests the performance CI report behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { canonicalizeJsonValue } from "../src/binding-ir/canonical.mjs";
import {
	assemblePerformanceCiReport,
	renderPerformanceCiSummary,
} from "../src/performance/ci-report.mjs";
import {
	buildPerformanceEvidenceBundle,
	readVerifiedPerformanceEvidenceBundle,
	validatePerformanceEvidenceBundle,
	validatePerformanceEvidenceIndex,
} from "../src/performance/evidence-bundle.mjs";

const commit = "a".repeat(40);
const digest = value => createHash("sha256").update(value).digest("hex");
const workloadSha256 = digest("workloads");
const artifactContents = Buffer.from("measured fixture artifact", "utf8");
const artifact = Object.freeze({ path: "build/fixture/main.wasm", bytes: artifactContents.length, sha256: digest(artifactContents) });
const source = () => ({ commit, dirty: false });
const timing = () => ({ samples: 3, samplesNs: [10, 20, 30], minimumNs: 10, medianNs: 20, p95Ns: 30, maximumNs: 30, totalNs: 60 });
const processMemory = () => ({ rssBytes: 100, heapUsedBytes: 50, externalBytes: 25, arrayBuffersBytes: 10 });

const spatial = () => ({
	schemaVersion: 1
	, kind: "lean-bridge-performance-suite"
	, runs: ["lazy", "startup", "final-static", "islands"].map((profile, index) => ({
		schemaVersion: 1
		, kind: "lean-bridge-performance-profile"
		, recordedAt: "2026-08-09T00:00:00.000Z"
		, source: source()
		, profile
		, workload: { id: "fixture", manifestSha256: workloadSha256 }
		, environment: { timingUnit: "nanoseconds" }
		, artifacts: [artifact]
		, composition: { runtimeInstances: profile === "islands" ? 3 : 1, moduleFactoryNs: [10], libraryLoadNs: { alpha: 20 }, shutdown: [true] }
		, correctness: { accepted: true, checkedOperations: 5, resultSha256: digest("result") }
		, timing: { constructionNs: 30, operations: {} }
		, memory: { initialWasmBytes: 65_536 * (index + 1), finalWasmBytes: 65_536 * (index + 1), processRssBefore: 100, processRssAfter: 120 }
		, limitations: ["fixture limitation"]
	}))
});

const scaling = () => ({
	schemaVersion: 1
	, kind: "lean-bridge-library-scaling-suite"
	, runs: [1, 3, 10, 50].flatMap(count => ["lazy", "startup", "final-static", "isolated"].map(profile => ({
		schemaVersion: 1
		, kind: "lean-bridge-library-scaling-profile"
		, recordedAt: "2026-08-09T00:00:00.000Z"
		, source: source()
		, profile
		, graph: { libraryCount: count }
		, environment: { timingUnit: "nanoseconds" }
		, artifacts: [artifact]
		, bytes: { artifactCount: 1, totalBytes: artifact.bytes }
		, phases: {
			artifactRead: timing()
			, moduleImport: timing()
			, moduleFactory: timing()
			, graphResolution: timing()
			, libraryLoad: timing()
			, firstNativeCall: timing()
		}
		, composition: { runtimeInstances: profile === "isolated" ? count : 1 }
		, memory: { phaseSnapshots: [{ process: processMemory(), wasmMemoryBytes: 65_536 }] }
		, correctness: { accepted: true }
		, limitations: []
	})))
});

const overhead = () => ({
	schemaVersion: 1
	, kind: "lean-bridge-native-overhead-suite"
	, recordedAt: "2026-08-09T00:00:00.000Z"
	, source: source()
	, environment: { timingUnit: "nanoseconds" }
	, artifacts: [artifact]
	, bindingIrSha256: digest("binding-ir")
	, method: {}
	, firstCallsNs: Object.fromEntries(["Box", "read", "roundTrip", "withCallback", "makeAdder", "closureCall", "sequence", "deferBoxValue"].map(name => [name, 50]))
	, operations: Object.fromEntries([
		"scalarLeanClosure"
		, "retainedBoxRead"
		, "boxConstructReadDispose"
		, "canonicalIdentityCache"
		, "copiedRecordSmall"
		, "copiedRecord1024Items"
		, "copiedRecordPerItem"
		, "callback"
		, "nestedCallback"
		, "iterator256Items"
		, "iteratorPerItem"
		, "callbackException"
		, "promiseLatency"
		, "cancellationShutdown"
	].map(name => [name, timing()]))
	, cancellation: {}
	, correctness: { accepted: true }
	, limitations: ["callback <boundary> | measured"]
});

const lifecycle = () => ({
	schemaVersion: 1
	, kind: "lean-bridge-lifecycle-stability-suite"
	, recordedAt: "2026-08-09T00:00:00.000Z"
	, source: source()
	, environment: {}
	, artifacts: [artifact]
	, bindingIrSha256: digest("binding-ir")
	, method: {}
	, memory: {
		samples: []
		, baseline: {}
		, highWater: { process: processMemory(), wasmMemoryBytes: 65_536 }
		, retained: { process: processMemory(), wasmMemoryBytes: 0 }
		, stableWasmBytesAfterWarmup: 65_536
		, hostHeapReliability: "unavailable-on-fixture"
	}
	, lifecycle: {
		rounds: []
		, highWater: { resources: 2, callbacks: 1 }
		, retained: { resources: 0, callbacks: 0 }
		, delayedFinalization: {}
		, crossRuntime: {}
		, shutdownWithLiveOwnership: {}
	}
	, correctness: { accepted: true }
	, limitations: []
});

const selfConsistency = () => ({
	schemaVersion: 1
	, kind: "lean-bridge-performance-self-consistency"
	, recordedAt: "2026-08-09T00:00:00.000Z"
	, source: source()
	, environment: {}
	, workload: "fixture"
	, profiles: ["lazy", "startup", "final-static", "islands"]
	, accepted: true
	, repetitions: 3
	, semanticSha256: digest("semantic")
	, semanticHashes: [digest("semantic"), digest("semantic"), digest("semantic")]
	, timingVariance: { "lazy.operation": { repetitions: 3, medianNs: 20, standardDeviationNs: 2, coefficientOfVariation: 0.1, spreadRatio: 1.2 } }
	, limitations: []
});

const buildReproducibility = () => {
	const inventory = { entries: [artifact], artifactCount: 1, totalBytes: artifact.bytes, sha256: digest("inventory"), scope: {} };
	return {
		schemaVersion: 1
		, kind: "lean-bridge-performance-build-reproducibility"
		, recordedAt: "2026-08-09T00:00:00.000Z"
		, source: source()
		, accepted: true
		, buildA: inventory
		, buildB: structuredClone(inventory)
		, differences: []
	};
};

const manifest = () => ({
	schemaVersion: 1
	, kind: "lean-bridge-performance-ci-manifest"
	, recordedAt: "2026-08-09T00:00:00.000Z"
	, source: source()
	, workflow: { event: "push", runAttempt: 1 }
	, toolchain: { node: "v22.0.0" }
	, identities: Object.fromEntries([
		["workloads", ["poc/performance/workloads.v1.json", workloadSha256]]
		, ["corpus", ["poc/performance/corpus.v1.json", digest("corpus")]]
		, ["methodology", ["poc/performance/methodology.v1.json", digest("methodology")]]
		, ["graphLock", ["poc/performance/scale/graph.v1.json", digest("graph")]]
		, ["packageLock", ["package-lock.json", digest("package")]]
		, ["flakeLock", ["flake.lock", digest("flake")]]
		, ["bootstrap", ["scripts/bootstrap-toolchains.sh", digest("bootstrap")]]
	].map(([name, [path, sha256]]) => [name, {
		path
		, bytes: 1
		, sha256,
		...(name === "workloads" ? { semanticSha256: workloadSha256 } : {})
	}]))
	, artifacts: [artifact]
	, resource: {}
	, limitations: []
});

const records = () => ({
	spatial: spatial()
	, scaling: scaling()
	, overhead: overhead()
	, lifecycle: lifecycle()
	, selfConsistency: selfConsistency()
	, buildReproducibility: buildReproducibility()
});

const semanticHash = value => digest(canonicalizeJsonValue(value));
const resource = () => ({ disk: { availableBytes: 1000 }, toolchainsBytes: 200, buildBytes: 300, evidenceBytes: 400 });
const jobs = values => [
	["build", [["build-manifest", digest("manifest")]]]
	, ["spatial", [["spatial", semanticHash(values.spatial)]]]
	, ["scaling", [["scaling", semanticHash(values.scaling)]]]
	, ["overhead", [["overhead", semanticHash(values.overhead)]]]
	, ["lifecycle", [["lifecycle", semanticHash(values.lifecycle)]]]
	, ["reproducibility", [["selfConsistency", semanticHash(values.selfConsistency)], ["buildReproducibility", semanticHash(values.buildReproducibility)]]]
].map(([id, results]) => ({
	schemaVersion: 1
	, kind: "lean-bridge-performance-ci-job"
	, id
	, accepted: true
	, durationMs: 1000
	, cacheHit: id === "build" ? false : null
	, resources: { before: resource(), after: resource() }
	, results: results.map(([role, sha256]) => ({ role, path: `${role}.json`, bytes: 1, fileSha256: digest(`${role}-file`), sha256 }))
}));

const acceptedReport = () => {
	const values = records();
	return assemblePerformanceCiReport({
		manifest: manifest()
		, records: values
		, jobs: jobs(values)
		, artifact: { name: "performance-evidence-fixture", retentionDays: 30, url: "https://github.test/run#artifacts" }
	});
};

test("aggregate schema keeps the CI evidence envelope closed", async () => {
  const [schema, bundleSchema, indexSchema] = await Promise.all([
    readFile("schema/performance-ci-report.schema.json", "utf8").then(JSON.parse)
    , readFile("schema/performance-evidence-bundle.schema.json", "utf8").then(JSON.parse)
    , readFile("schema/performance-evidence-index.schema.json", "utf8").then(JSON.parse)
  ]);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.measurements.additionalProperties, false);
  assert.equal(schema.properties.policy.properties.regressionFailureAuthorized.const, false);
  assert.match(schema.$id, /^urn:lean-bridge:/);
  assert.equal(bundleSchema.additionalProperties, false);
  assert.equal(bundleSchema.properties.status.properties.budget.type, "null");
  assert.equal(indexSchema.additionalProperties, false);
  assert.equal(indexSchema.properties.properties.properties.performance.properties.claimKind.const, "compiled-artifact-measurement");
});

test("workflow runs the complete suite on pushes and publishes one job summary", async () => {
  const workflow = await readFile(".github/workflows/performance.yml", "utf8");
  assert.match(workflow, /^\s*push:\s*$/m);
  for(const command of [
    "benchmark-spatial-runtime.mjs"
    , "benchmark-library-scaling.mjs"
    , "benchmark-native-overhead.mjs"
    , "benchmark-lifecycle-stability.mjs"
    , "benchmark-self-consistency.mjs"
    , "check-performance-build-reproducibility.sh"
  ]) assert.match(workflow, new RegExp(command.replaceAll(".", "\\.")));
  assert.match(workflow, /GITHUB_STEP_SUMMARY/);
  assert.match(workflow, /build-performance-evidence-bundle\.mjs/);
  assert.match(workflow, /performance-ci-build-graph-/);
  assert.match(workflow, /performance-evidence-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.doesNotMatch(workflow, /\bccall\b|\bcwrap\b|module\._[A-Za-z]/);
  await access("poc/lean-link-spike/bindings");
  const collector = await readFile("scripts/performance-ci.mjs", "utf8");
  assert.match(collector, /"poc\/lean-link-spike\/bindings"/);
  assert.doesNotMatch(collector, /bindings\/generated/);
});

test("bootstrap pins the Wasm audit tools absent from clean GitHub runners", async () => {
  const bootstrap = await readFile("scripts/bootstrap-toolchains.sh", "utf8");
  const environment = await readFile("scripts/env.sh", "utf8");
  assert.match(bootstrap, /^WASM_TOOLS_VERSION=1\.245\.1$/m);
  assert.match(bootstrap, /^WASM_TOOLS_SHA256=[a-f0-9]{64}$/m);
  assert.match(bootstrap, /^WABT_VERSION=1\.0\.41$/m);
  assert.match(bootstrap, /^WABT_SHA256=[a-f0-9]{64}$/m);
  assert.match(bootstrap, /toolchain list \| cut -d' ' -f1 \| grep -Fxq/);
  assert.match(environment, /\.toolchains\/wasm-tools\/bin/);
  assert.match(environment, /\.toolchains\/wabt\/bin/);
});

test("accepts one complete, artifact-bound record from every performance family", () => {
  const report = structuredClone(acceptedReport());
  assert.equal(report.accepted, true, JSON.stringify(report.validation.issues));
  assert.equal(report.validation.issueCount, 0);
  assert.equal(report.informational, true);
  assert.equal(report.policy.regressionFailureAuthorized, false);
  assert.deepEqual(Object.keys(report.measurements).sort(), ["buildReproducibility", "lifecycle", "overhead", "scaling", "selfConsistency", "spatial"]);
});

test("rejects missing profiles, stale source, dirty source, and artifact drift", () => {
  const values = records();
  values.spatial.runs.pop();
  values.scaling.runs[0].source.commit = "b".repeat(40);
  values.overhead.source.dirty = true;
  values.lifecycle.artifacts[0] = { ...artifact, sha256: digest("drift") };
  const report = assemblePerformanceCiReport({ manifest: manifest(), records: values, jobs: jobs(values) });
  assert.equal(report.accepted, false);
  const codes = new Set(report.validation.issues.map(value => value.code));
  for(const code of ["missing-profile", "stale-source", "dirty-source", "artifact-drift"]) assert.ok(codes.has(code), code);
});

test("records absent evidence explicitly and fails closed", () => {
  const values = records();
  const jobRecords = jobs(values);
  delete values.lifecycle;
  const report = assemblePerformanceCiReport({ manifest: manifest(), records: values, jobs: jobRecords });
  assert.equal(report.measurements.lifecycle, null);
  assert.ok(report.validation.issues.some(value => value.code === "missing-measurement" && value.path === "measurements.lifecycle"));
});

test("renders every evidence group with units, explicit unavailable values, and escaped Markdown", () => {
  const report = acceptedReport();
  report.measurements.lifecycle.record.memory.highWater.process.rssBytes = null;
  const markdown = renderPerformanceCiSummary(report);
  for(const heading of [
    "Startup and composition"
    , "Library scaling"
    , "Native calls and marshalling"
    , "Memory and lifecycle"
    , "Cross-profile parity"
    , "Timing self-consistency"
    , "Clean-build reproducibility"
    , "CI resource footprint"
  ]) assert.match(markdown, new RegExp(heading));
  assert.match(markdown, /20 ns/);
  assert.match(markdown, /unavailable/);
  assert.match(markdown, /callback &lt;boundary&gt; \\| measured/);
  assert.doesNotMatch(markdown, /callback <boundary> \| measured/);
  assert.match(markdown, /Informational\. No approved performance budget is installed\./);
});

const bundleContractPaths = [
	"schema/performance-ci-report.schema.json"
	, "schema/performance-evidence-bundle.schema.json"
	, "schema/performance-evidence-index.schema.json"
	, "schema/performance-corpus.schema.json"
	, "schema/performance-workloads.schema.json"
	, "schema/performance-methodology.schema.json"
	, "schema/performance-result.schema.json"
	, "schema/performance-scaling-result.schema.json"
	, "schema/performance-overhead-result.schema.json"
	, "schema/performance-lifecycle-result.schema.json"
	, "schema/performance-self-consistency-result.schema.json"
	, "schema/performance-build-reproducibility.schema.json"
];

const materialize = async (root, path, contents) => {
	const target = join(root, path);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, contents);
	return { path, bytes: Buffer.byteLength(contents), sha256: digest(contents) };
};

const prepareBundleFixture = async root => {
	for(const path of bundleContractPaths)
	{
		const target = join(root, path);
		await mkdir(dirname(target), { recursive: true });
		await copyFile(path, target);
	}
	const values = {
		workloads: await materialize(root, "poc/performance/workloads.v1.json", "workloads")
		, corpus: await readFile("poc/performance/corpus.v1.json").then(contents => materialize(root, "poc/performance/corpus.v1.json", contents))
		, methodology: await materialize(root, "poc/performance/methodology.v1.json", "methodology")
		, graphLock: await materialize(root, "poc/performance/scale/graph.v1.json", "graph")
		, packageLock: await materialize(root, "package-lock.json", "package")
		, flakeLock: await materialize(root, "flake.lock", "flake")
		, bootstrap: await materialize(root, "scripts/bootstrap-toolchains.sh", "bootstrap")
	};
	values.workloads.semanticSha256 = workloadSha256;
	await materialize(root, artifact.path, artifactContents);
	const report = structuredClone(acceptedReport());
	report.identities = values;
	const reportPath = join(root, "incoming/report.json");
	const summaryPath = join(root, "incoming/summary.md");
	const validationPath = join(root, "incoming/validation.json");
	await mkdir(dirname(reportPath), { recursive: true });
	await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
	await writeFile(summaryPath, renderPerformanceCiSummary(report));
	await writeFile(validationPath, `${JSON.stringify(report.validation, null, 2)}\n`);
	return { report, reportPath, summaryPath, validationPath };
};

test("publishes accepted measurements beside exact artifacts and separate complexity claims", async t => {
  const root = await mkdtemp(join(tmpdir(), "lean-bridge-performance-evidence-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fixture = await prepareBundleFixture(root);
  const first = await buildPerformanceEvidenceBundle({
    projectRoot: root
    , reportPath: fixture.reportPath
    , summaryPath: fixture.summaryPath
    , validationPath: fixture.validationPath
    , outputRoot: join(root, "bundle-a")
    , verifyProjectRevision: false
  });
  const second = await buildPerformanceEvidenceBundle({
    projectRoot: root
    , reportPath: fixture.reportPath
    , summaryPath: fixture.summaryPath
    , validationPath: fixture.validationPath
    , outputRoot: join(root, "bundle-b")
    , verifyProjectRevision: false
  });
  assert.equal(first.identitySha256, second.identitySha256);
  assert.equal(first.manifestSha256, second.manifestSha256);

  const manifest = JSON.parse(await readFile(join(root, "bundle-a/performance-evidence.json"), "utf8"));
  const index = JSON.parse(await readFile(join(root, "bundle-a/metadata/property-index.json"), "utf8"));
  const verified = await readVerifiedPerformanceEvidenceBundle(join(root, "bundle-a"));
  assert.equal(validatePerformanceEvidenceBundle(manifest), true);
  assert.equal(validatePerformanceEvidenceIndex(index), true);
  assert.equal(verified.identitySha256, first.identitySha256);
  assert.equal(manifest.artifacts.length, 1);
  assert.deepEqual(await readFile(join(root, "bundle-a", manifest.artifacts[0].path)), artifactContents);
  assert.deepEqual(new Set(manifest.measurements.map(value => value.family)), new Set([
    "spatial"
    , "scaling"
    , "overhead"
    , "lifecycle"
    , "selfConsistency"
    , "buildReproducibility"
  ]));
  assert.equal(index.properties.performance.claimKind, "compiled-artifact-measurement");
  assert.equal(index.properties.performance.budget, null);
  const lowerBound = index.properties.interfaces.find(value => value.interface === "point-lower-bound");
  assert.equal(lowerBound.complexity.claimKind, "algorithmic-complexity");
  assert.equal(lowerBound.complexity.time.state, "asserted");
  assert.equal(lowerBound.complexity.time.evidence.theorem, null);
  assert.ok(index.properties.interfaces.some(value => value.complexity.time.state === "unknown"));
  await writeFile(join(root, "bundle-a", manifest.artifacts[0].path), "changed after publication");
  await assert.rejects(
    readVerifiedPerformanceEvidenceBundle(join(root, "bundle-a")),
    error => error.code === "bundle-file-drift",
  );
});

test("performance evidence publication fails on changed artifacts and unaccepted reports", async t => {
  const root = await mkdtemp(join(tmpdir(), "lean-bridge-performance-evidence-drift-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fixture = await prepareBundleFixture(root);
  await writeFile(join(root, artifact.path), "changed");
  await assert.rejects(
    buildPerformanceEvidenceBundle({
      projectRoot: root
      , reportPath: fixture.reportPath
      , summaryPath: fixture.summaryPath
      , validationPath: fixture.validationPath
      , outputRoot: join(root, "drift")
      , verifyProjectRevision: false
    }),
    error => error.code === "artifact-drift",
  );

  await writeFile(join(root, artifact.path), artifactContents);
  fixture.report.accepted = false;
  await writeFile(fixture.reportPath, `${JSON.stringify(fixture.report, null, 2)}\n`);
  await writeFile(fixture.summaryPath, renderPerformanceCiSummary(fixture.report));
  await assert.rejects(
    buildPerformanceEvidenceBundle({
      projectRoot: root
      , reportPath: fixture.reportPath
      , summaryPath: fixture.summaryPath
      , validationPath: fixture.validationPath
      , outputRoot: join(root, "rejected")
      , verifyProjectRevision: false
    }),
    error => error.code === "unaccepted-report",
  );
});
