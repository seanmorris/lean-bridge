/**
 * Authenticate the archived scalar Fin source-entry probe (VO #1430): the six-ABI run, both scalar
 * feasibility attempts, the exact instrumented inputs and selected producer sources. Every call is
 * re-accounted here from its archived output; this module does not import the live probe helper, so a
 * later edit to that helper cannot change how this archive is judged. Validators take archived bytes
 * only and never open recorded producer paths or Git objects.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";

export const sourceEntryArchiveDirectory = "docs/evidence/scalar-fin-source-entry-20261008";
export const sourceEntryRevision = "3f2de27757b1c5f570ae8c505f9f16e5fa240e0e";
export const sourceEntryAbis = Object.freeze(["scalar", "callable", "copied", "record", "compound", "nominal"]);
const archived = name => `${sourceEntryArchiveDirectory}/${name}`;
const six = "build/vo1430-source-entry-3f2de27";

/** Original producer outputs and runners, relative to the producing checkout, with their posted digests. */
export const sourceEntryOriginals = Object.freeze({
	"six-abi/queue.json": { original: `${six}/queue.json`, sha256: "c2f916195e3a95945439998f8d6412884564f874a40dbe941b5239984a0fe4b4" }
	, "six-abi/run.tap": { original: `${six}/run.tap`, sha256: "7ef8d52e484daf90e2e03eab2ab86bc620d0f938d44ff90ed559724d7860592c" }
	, "six-abi/report.json": { original: `${six}/report.json`, sha256: "eb684595cb2c6c02135f5f2e1f981a2c6d9b1d2d49d346756457cf00d0c710a1" }
	, "six-abi/end.txt": { original: `${six}/end.txt`, sha256: "b366ed467671514a4c8261474b24d373e1ccc2e69fc32d53e054a273eca65f05" }
	, "six-abi/calls/scalar.stderr.txt": { original: `${six}/calls/scalar.stderr.txt`, sha256: "6efbeaf9ff3ac9b9bc07f75087e7a761a85ac07d633b5462f7517d151f1c2bdf" }
	, "six-abi/calls/scalar.stdout.json": { original: `${six}/calls/scalar.stdout.json`, sha256: "b4bbcd51e6a3fe2edbc03e3a9ba016e1028bb08bdc00428e5f05fdd57f51e298" }
	, "six-abi/calls/callable.stderr.txt": { original: `${six}/calls/callable.stderr.txt`, sha256: "477d66f035393c2bb96091633cb3946fdb1603512179ed562087b06eed636c4e" }
	, "six-abi/calls/callable.stdout.json": { original: `${six}/calls/callable.stdout.json`, sha256: "374e580149d291ce54ed11070f33bd1f521d88260fdcba99ec41b0ba3f11860a" }
	, "six-abi/calls/copied.stderr.txt": { original: `${six}/calls/copied.stderr.txt`, sha256: "044d33d77ac659d59686829a1b3277ffb0cb0edd27f7991c40456db00ebc75e0" }
	, "six-abi/calls/copied.stdout.json": { original: `${six}/calls/copied.stdout.json`, sha256: "53a291e5d00084d189678c0822ec2a9946646c9e985fead7daad41d372cdf08d" }
	, "six-abi/calls/record.stderr.txt": { original: `${six}/calls/record.stderr.txt`, sha256: "1a4843f03fdee62ff06530bea1f752714d1c0398f5c8c89eaf432fe3488ed5d1" }
	, "six-abi/calls/record.stdout.json": { original: `${six}/calls/record.stdout.json`, sha256: "450c86dd44d5a0912ab1aa22bf8e9bac683a6915e0e763c7008527b8a4d91a6f" }
	, "six-abi/calls/compound.stderr.txt": { original: `${six}/calls/compound.stderr.txt`, sha256: "aac73306975df570fdd7323df0c101a18f6bff00353ee005261da142fd917683" }
	, "six-abi/calls/compound.stdout.json": { original: `${six}/calls/compound.stdout.json`, sha256: "b9984bab9c1c4fc9ccf853b48ea0b49d8bb3f98563a0ce524898d8fc72670404" }
	, "six-abi/calls/nominal.stderr.txt": { original: `${six}/calls/nominal.stderr.txt`, sha256: "29809dc6f680000de5c0d8612920e7c3184f299cc05a5a0d72d821b1edc775c4" }
	, "six-abi/calls/nominal.stdout.json": { original: `${six}/calls/nominal.stdout.json`, sha256: "100e894e411df71f8db2d851b0ac6d6baf08e1da44bcc83cc4d96df71fcd7b23" }
	, "feasibility/attempt-1/queue.json": { original: "build/vo1430-feasibility-3f2de27.queue", sha256: "dcc80d1a9e1edaac5ae215e2a9a657635b92f253c0f6730e673167f9de5ecd0d" }
	, "feasibility/attempt-1/run.tap": { original: "build/vo1430-feasibility-3f2de27.tap", sha256: "7e3ef0788070b84d81b8d12b786bac5170bc7d8a43380fc16944ce60ec840d50" }
	, "feasibility/attempt-1/end.txt": { original: "build/vo1430-feasibility-3f2de27.end", sha256: "0a8ffb20433e65412fe22779f6552ac5f3d8baf8bb57220c360eb731e1b31544" }
	, "feasibility/attempt-1/runner.mjs.txt": { original: "build/vo1430-feasibility-runner-3f2de27.mjs", sha256: "86dc7d7807871c6f4e5b962b3e82f6915250b44e2a20f99572361c243e6e3e1f" }
	, "feasibility/attempt-2/queue.json": { original: "build/vo1430-feasibility-3f2de27-r2.queue", sha256: "08ed785da6e780b76b9bf075ca3364a3d9d86b4a30b2388a2fe0af80aad9775c" }
	, "feasibility/attempt-2/run.tap": { original: "build/vo1430-feasibility-3f2de27-r2.tap", sha256: "07687895a4ff77ad1ce4325e21b7829c3fb32bfecd6a2eeade1d8d3481ac9a28" }
	, "feasibility/attempt-2/report.json": { original: "build/vo1430-feasibility-3f2de27-r2.json", sha256: "b9f79889aed52839e96f6858ff68f0c386ea82c761dafa48debcb13918d8404f" }
	, "feasibility/attempt-2/end.txt": { original: "build/vo1430-feasibility-3f2de27-r2.end", sha256: "fcd6025cb63f547c4fd95301891eb3b85ed064b1354fedf497a63bbc76afed85" }
	, "feasibility/attempt-2/runner.mjs.txt": { original: "build/vo1430-feasibility-runner-3f2de27-r2.mjs", sha256: "ce2d3cf06c47eb477054b3bd9b7189532d82e92a79949881c4279e0519bd145d" }
	, "feasibility/attempt-2/calls/scalar.stderr.txt": { original: "build/vo1430-feasibility-3f2de27-r2-calls/scalar.stderr.txt", sha256: "6efbeaf9ff3ac9b9bc07f75087e7a761a85ac07d633b5462f7517d151f1c2bdf" }
	, "feasibility/attempt-2/calls/scalar.stdout.json": { original: "build/vo1430-feasibility-3f2de27-r2-calls/scalar.stdout.json", sha256: "b4bbcd51e6a3fe2edbc03e3a9ba016e1028bb08bdc00428e5f05fdd57f51e298" }
});

/** Selected producer sources at 3f2de27, archived as text; not a dependency closure. */
export const sourceEntrySourcePaths = Object.freeze([
	"tests/helpers/scalar-fin-source-entry.mjs"
	, "tests/helpers/scalar-fin-source-entry-tests.mjs"
	, "tests/helpers/scalar-fin-rejection-packages.mjs"
	, "tests/helpers/refinement-engine.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/scalar-fin-rejection.test.mjs"
	, "tests/fixtures/documentation/lean-author/OnboardingSmall.lean"
	, "tests/fixtures/documentation/lean-author/lakefile.toml"
	, "tests/fixtures/documentation/lean-author/lean-toolchain"
	, "tests/fixtures/documentation/lean-author/package.json"
	, "src/build/canonical-build.mjs"
	, "src/build/component-side-linker.mjs"
	, "src/release/component-npm-package.mjs"
]);

/**
 * Where an archived text copy lives.
 *
 * @param path - Repository-relative source path at 3f2de27.
 */
export const sourceEntrySnapshot = path => archived(`sources/3f2de27/${path}.txt`);

/**
 * Where an exact instrumented input lives.
 *
 * @param abi - Private ABI name.
 * @param kind - "lean" or "consumer".
 */
export const sourceEntryInput = (abi, kind) => archived(`inputs/${abi}.${kind === "lean" ? "lean" : "consumer.mjs"}.txt`);

const extra = { scalar: null, callable: "apply", copied: "count", record: "tag", compound: "orZero", nominal: "labelled" };
const common = { huge: [10, 10], mirror: [2018, 2012], mix: [502, 504], never: [0, 8], one: [4, 8], pair: [2, 4], tenth: [2, 0], traceNat: [10, 0] };

/**
 * The exact observed accounting of one ABI: export entries and rejections, call totals and consumer counts.
 *
 * @param abi - Private ABI name.
 */
export const sourceEntryExpected = abi => {
	const counts = { ...common, ...(extra[abi] ? { [extra[abi]]: [2, 2] } : {}) };
	const exports = Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)).map(([name, [entered, rejected]]) => [name, { entered, rejected }]));
	const entered = Object.values(exports).reduce((sum, item) => sum + item.entered, 0), rejected = Object.values(exports).reduce((sum, item) => sum + item.rejected, 0);
	return { privateAbi: sourceEntryAbis.indexOf(abi) + 2, exports, entered, rejected, calls: entered + rejected, checks: { scalar: 1545, callable: 1547 }[abi] ?? 1546, rejections: rejected };
};

/** Each late case: the label the consumer gives it, its export, route and observed number of calls. */
export const sourceEntryLateCases = Object.freeze({
	"pair raw late": { name: "pair", route: "raw", calls: 1, line: "rejected(() => raw(\"pair\", [2n, 4n]), \"pair raw late\", failure);" }
	, "pair public late": { name: "pair", route: "public", calls: 1, line: "rejected(() => api.pair(2n, 4n), \"pair public late\");" }
	, "mix raw late Fin": { name: "mix", route: "raw", calls: 1, line: "rejected(() => raw(\"mix\", [\"ab\", 10n]), \"mix raw late Fin\", failure);" }
	, "mix public late Fin": { name: "mix", route: "public", calls: 1, line: "rejected(() => api.mix(\"ab\", 10n), \"mix public late Fin\");" }
	, "mix cycle late Fin": { name: "mix", route: "raw", calls: 500, line: "rejected(() => raw(\"mix\", [\"x\".repeat(4096), 10n]), \"mix cycle late Fin\", failure);" }
});

const marker = "lean-bridge-source-entry", begin = "lean-bridge-call-begin", end = "lean-bridge-call-end";

/**
 * Re-account one ABI's archived run: assign every stderr line to one call, require exactly the export's
 * marker in each successful call and none in each rejected call, then compare with the observed counts.
 *
 * @param abi - Private ABI name.
 * @param stderr - Archived consumer stderr.
 * @param stdout - Archived consumer stdout.
 */
export const accountArchivedSourceEntry = (abi, stderr, stdout) => {
	const expected = sourceEntryExpected(abi), names = Object.keys(expected.exports);
	assert.ok(stdout.endsWith("\n") && !stdout.slice(0, -1).includes("\n"), "stdout is one report line");
	const result = JSON.parse(stdout);
	assert.deepEqual(Object.keys(result), ["abi", "checks", "rejections", "calls"]);
	assert.equal(result.abi, abi); assert.equal(result.checks, expected.checks); assert.equal(result.rejections, expected.rejections);
	const lines = stderr.split("\n");
	assert.equal(lines.pop(), "", "stderr ends with a newline");
	const segments = [];
	let open = null;
	for(const line of lines)
	{
		const parts = line.split(" ");
		assert.equal(parts.length, 2, `unexpected stderr line: ${line}`);
		const [kind, value] = parts;
		if(kind === begin)
		{
			assert.equal(open, null, `nested call: ${line}`); assert.equal(value, String(segments.length), `out-of-order call: ${line}`);
			open = [];
		}
		else if(kind === end)
		{
			assert.ok(open && value === String(segments.length), `unmatched end: ${line}`);
			segments.push(open); open = null;
		}
		else if(kind === marker)
		{
			assert.ok(open, `source entry outside any call: ${line}`); assert.ok(names.includes(value), `unknown export: ${line}`);
			open.push(value);
		}
		else assert.fail(`unexpected stderr line: ${line}`);
	}
	assert.equal(open, null, "unclosed call");
	assert.equal(segments.length, result.calls.length, "one bracket per recorded call");
	const exports = Object.fromEntries(names.map(name => [name, { entered: 0, rejected: 0 }])), late = {};
	let recovered = false;
	for(const [index, record] of result.calls.entries())
	{
		assert.equal(record.length, 5, `call ${index}`);
		const [id, name, route, outcome, label] = record;
		assert.equal(id, index); assert.ok(names.includes(name), name);
		assert.ok(route === "public" || route === "raw", route); assert.ok(outcome === 0 || outcome === 1, `call ${id} outcome`);
		assert.ok(label === null || typeof label === "string" && outcome === 0, `call ${id} case`);
		assert.deepEqual(segments[index], outcome ? [name] : [], `${route} ${name} call ${id} ${outcome ? "succeeded" : "was rejected"}`);
		exports[name][outcome ? "entered" : "rejected"]++;
		if(Object.hasOwn(sourceEntryLateCases, label))
		{
			const lateCase = sourceEntryLateCases[label];
			assert.deepEqual([name, route], [lateCase.name, lateCase.route], label);
			late[label] = (late[label] ?? 0) + 1;
		}
		recovered ||= name === "mirror" && outcome === 1 && result.calls[index - 1]?.[1] === "mirror" && result.calls[index - 1][3] === 0;
	}
	assert.deepEqual(exports, expected.exports, `${abi} per-export accounting`);
	assert.deepEqual(late, Object.fromEntries(Object.entries(sourceEntryLateCases).map(([label, item]) => [label, item.calls])), `${abi} late cases`);
	assert.ok(recovered, `${abi} mirror recovers after a rejection`);
	return { calls: result.calls.length, entered: expected.entered, rejected: expected.rejected, exports };
};

/**
 * The archived instrumented inputs mark every export and the control by name and keep each exact late case.
 *
 * @param abi - Private ABI name.
 * @param lean - Archived instrumented Lean source.
 * @param consumer - Archived instrumented consumer.
 */
export const assertSourceEntryInputs = (abi, lean, consumer) => {
	for(const name of Object.keys(sourceEntryExpected(abi).exports))
		assert.match(lean, new RegExp(`^def ${name} .* := dbgTrace "${marker} ${name}" fun _ => `, "mu"), `${abi}/${name}`);
	assert.equal([...lean.matchAll(/dbgTrace "/gu)].length, Object.keys(sourceEntryExpected(abi).exports).length);
	for(const { line } of Object.values(sourceEntryLateCases)) assert.equal(consumer.split(line).length, 2, `${abi}: ${line}`);
	assert.match(consumer, /^ {2}sourceEntryCase = label;$/mu);
	assert.match(consumer, /^for \(const value of \[10n, 11n, 2n \*\* 70n, 184467440737095516170n, 184467440737095516171n\]\) \{$/mu);
	assert.match(consumer, /checks, rejections, calls: sourceEntryCalls \}\)\);\n$/u);
};

export const sourceEntryInstrumentation = "probe build: dbgTrace markers in the fixture source and call brackets in the consumer; not the unmodified packages of the rejection suite";
const runtime = { path: "/app/build/lean-link-spike/lazy", mainMjsSha256: "8b791a4711e58876e29b5e0a7c3fcbab500b02d7550fe6f7c3321020a736be02", mainWasmSha256: "d8a9f3861d518d8311340b0e02c6a9aa73ba191b09a7ab4d6ac937d5e3e82d0b" };
const versions = { node: "v22.23.3", lean: "Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release)" };
const repair = { symlink: "/app/build/worktrees/scalar-fin-source-entry-vo1430/build/lean-runtime", target: "/app/build/lean-runtime" };
const selection = "tests/scalar-fin-rejection.test.mjs --test-name-pattern=\"^installed scalar Fin rejections never enter the Lean source on any private ABI$\"";
const sixTest = "installed scalar Fin rejections never enter the Lean source on any private ABI";
const feasibilityTest = "VO 1430 feasibility: scalar private ABI 2 source-entry probe, one build";

/**
 * Validate one sourceEntry block of a report against its archived calls and inputs.
 *
 * @param observation - Report observation.
 * @param abi - Expected ABI.
 * @param digests - SHA-256 digests and byte counts of the archived calls and inputs.
 * @param retainedPrefix - The producer path prefix recorded for the retained outputs.
 */
const assertObservation = (observation, abi, digests, retainedPrefix) => {
	const expected = sourceEntryExpected(abi);
	assert.deepEqual(Object.keys(observation), ["abi", "archiveSha256", "checks", "privateAbi", "rejections", "runtimeArchiveSha256", "sourceEntry"]);
	assert.equal(observation.abi, abi); assert.equal(observation.privateAbi, expected.privateAbi);
	assert.equal(observation.checks, expected.checks); assert.equal(observation.rejections, expected.rejections);
	assert.match(observation.archiveSha256, /^[0-9a-f]{64}$/u); assert.match(observation.runtimeArchiveSha256, /^[0-9a-f]{64}$/u);
	const entry = observation.sourceEntry;
	assert.deepEqual(Object.keys(entry), ["calls", "consumerSha256", "entered", "exports", "instrumentation", "leanSha256", "rejected", "retained"]);
	assert.equal(entry.instrumentation, sourceEntryInstrumentation);
	assert.deepEqual([entry.calls, entry.entered, entry.rejected], [expected.calls, expected.entered, expected.rejected]);
	assert.equal(entry.rejected, observation.rejections);
	assert.deepEqual(entry.exports, expected.exports);
	assert.equal(entry.leanSha256, digests.lean); assert.equal(entry.consumerSha256, digests.consumer);
	assert.deepEqual(entry.retained, {
		"stderr.txt": { bytes: digests.stderr.bytes, path: `${retainedPrefix}/${abi}.stderr.txt`, sha256: digests.stderr.sha256 }
		, "stdout.json": { bytes: digests.stdout.bytes, path: `${retainedPrefix}/${abi}.stdout.json`, sha256: digests.stdout.sha256 }
	});
};

const counts = (tap, expected) => {
	for(const [key, count] of Object.entries({ cancelled: 0, skipped: 0, todo: 0, ...expected }))
		assert.deepEqual([...tap.matchAll(new RegExp(`^# ${key} (.+)$`, "gmu"))].map(match => match[1]), [String(count)], key);
};
const results = (tap, verdict) => [...tap.matchAll(new RegExp(`^${verdict} \\d+ - (.+)$`, "gmu"))].map(match => match[1]);
const ended = (text, exit) => {
	const match = /^end=\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ exit=(\d+) minFree=(\d+)M\n$/u.exec(text);
	assert.ok(match, text); assert.equal(Number(match[1]), exit); assert.ok(Number(match[2]) >= 1024, "the free-space floor held");
};
const producerSources = sources => Object.fromEntries(["tests/helpers/scalar-fin-source-entry.mjs", "tests/helpers/scalar-fin-rejection-packages.mjs", "tests/helpers/refinement-engine.mjs", "tests/scalar-fin-rejection.test.mjs"].map(path => [path, sources[path]]));

/**
 * Validate the six-ABI run's queue, TAP, end record and report against its archived calls and inputs.
 *
 * @param files - Archived texts: queue, tap, end, report.
 * @param digests - Per-ABI digests of the archived calls and inputs.
 * @param sources - SHA-256 digest of each archived selected source.
 */
export const assertSixAbiRun = (files, digests, sources) => {
	const queue = JSON.parse(files.queue);
	assert.equal(queue.node, 1430); assert.equal(queue.revision, sourceEntryRevision); assert.equal(queue.selection, selection);
	assert.equal(queue.cpu, "taskset -c 3"); assert.equal(queue.concurrency, 1);
	assert.deepEqual(queue.environment, {
		NO_COLOR: "1"
		, FORCE_COLOR: "(unset)"
		, LEAN_BRIDGE_LAKE_WASM_TEST: "1"
		, LEAN_BRIDGE_SCALAR_FIN_SOURCE_ENTRY: "1"
		, LEAN_BRIDGE_LAKE_RUNTIME_ROOT: runtime.path
		, LEAN_BRIDGE_SCALAR_FIN_SOURCE_ENTRY_REPORT: "/app/build/vo1430-source-entry-3f2de27/report.json"
		, LEAN_BRIDGE_LAKE_ENGINE: "(unset: in-process engine)"
	});
	assert.deepEqual(queue.environmentRepair, repair); assert.deepEqual(queue.runtimeRoot, runtime); assert.deepEqual(queue.versions, versions);
	assert.deepEqual(queue.producerSources, producerSources(sources));
	assert.deepEqual(results(files.tap, "ok"), [sixTest]); assert.deepEqual(results(files.tap, "not ok"), []);
	counts(files.tap, { tests: 1, pass: 1, fail: 0 });
	ended(files.end, 0);
	const report = JSON.parse(files.report);
	assert.deepEqual(Object.keys(report), ["instrumentation", "observations", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.instrumentation, sourceEntryInstrumentation);
	assert.deepEqual(report.observations.map(item => item.abi), sourceEntryAbis);
	for(const [index, abi] of sourceEntryAbis.entries()) assertObservation(report.observations[index], abi, digests[abi], "/app/build/vo1430-source-entry-3f2de27/calls");
	assert.equal(new Set(report.observations.map(item => item.runtimeArchiveSha256)).size, 1);
};

/**
 * Validate both feasibility attempts: the first stopped before the consumer at the absent runtime header
 * closure; the second, after the recorded symlink repair, produced the scalar observation.
 *
 * @param files - Archived texts of both attempts.
 * @param digests - The scalar digests of attempt 2's calls and the scalar inputs.
 * @param sources - SHA-256 digest of each archived selected source.
 */
export const assertFeasibilityAttempts = (files, digests, sources) => {
	const first = JSON.parse(files.queue1), second = JSON.parse(files.queue2);
	for(const [queue, runner] of [[first, files.runner1], [second, files.runner2]])
	{
		assert.equal(queue.node, 1430); assert.equal(queue.revision, sourceEntryRevision);
		assert.equal(queue.runner.sha256, sha256(runner)); assert.equal(queue.cpu, "taskset -c 3"); assert.equal(queue.concurrency, 1);
		assert.deepEqual(queue.environment, { NO_COLOR: "1", FORCE_COLOR: "(unset)", LEAN_BRIDGE_LAKE_RUNTIME_ROOT: runtime.path, LEAN_BRIDGE_LAKE_ENGINE: "(unset: in-process engine)" });
		assert.deepEqual(queue.runtimeRoot, runtime); assert.deepEqual(queue.versions, versions);
		assert.deepEqual(queue.producerSources, producerSources(sources));
		assert.match(runner, /checkScalarFinRejection\(t, \{ fixture, build, runtimeRoot \}, "scalar", scalarFinSourceEntryProbe\(`\$\{base\}-calls`\)\)/u);
	}
	assert.equal(first.environmentRepair, undefined);
	assert.deepEqual([second.attempt, second.previousAttempt], [2, { queue: "/app/build/vo1430-feasibility-3f2de27.queue", cause: "absent worktree runtime header closure before consumer execution" }]);
	assert.deepEqual({ symlink: second.environmentRepair?.symlink, target: second.environmentRepair?.target }, repair);
	// The second runner differs from the first only in its output base.
	assert.equal(files.runner2, files.runner1.replace("const base = \"/app/build/vo1430-feasibility-3f2de27\";", "const base = \"/app/build/vo1430-feasibility-3f2de27-r2\";"));
	assert.notEqual(files.runner2, files.runner1);
	assert.deepEqual(results(files.tap1, "not ok"), [feasibilityTest]); assert.deepEqual(results(files.tap1, "ok"), []);
	counts(files.tap1, { tests: 1, pass: 0, fail: 1 });
	assert.ok(files.tap1.includes("The shared runtime header closure is unavailable") && files.tap1.includes("/build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser/cmake/include/lean/lean.h"));
	ended(files.end1, 1);
	assert.deepEqual(results(files.tap2, "ok"), [feasibilityTest]); assert.deepEqual(results(files.tap2, "not ok"), []);
	counts(files.tap2, { tests: 1, pass: 1, fail: 0 });
	ended(files.end2, 0);
	const report = JSON.parse(files.report2);
	assert.deepEqual(Object.keys(report), ["instrumentation", "observation", "schemaVersion", "scope"]);
	assert.equal(report.scope, "feasibility: scalar private ABI 2 only, one build"); assert.equal(report.instrumentation, sourceEntryInstrumentation);
	assertObservation(report.observation, "scalar", digests, "/app/build/vo1430-feasibility-3f2de27-r2-calls");
};

/**
 * The receipt's fixed statement of scope; artifacts and sources come from the archived bytes.
 *
 * @param artifacts - Every archived file with its original path, digest and size.
 * @param sources - Selected producer sources with their digests and snapshots.
 */
export const sourceEntryReceipt = (artifacts, sources) => ({
	schemaVersion: 1
	, planNode: 1430
	, execution: "local"
	, revision: sourceEntryRevision
	, scope: {
		packages: "installed npm packages in Node, instrumented with source-entry markers"
		, privateAbis: sourceEntryAbis.map((abi, index) => ({ abi, privateAbi: index + 2 }))
		, instrumentation: sourceEntryInstrumentation
		, observedCounts: "absolute per-ABI counts observed in these instrumented runs; each instrumented consumer adds ten traceNat control checks"
		, uninstrumentedArchiveIdentity: "not established"
		, hostedCi: false
		, browsers: false
		, nativeHosts: false
		, closure: "not claimed"
	}
	, producerEnvironment: { cpu: 3, concurrency: 1, versions, runtimeRoot: runtime, environmentRepair: repair, freeSpaceFloor: "1024M" }
	, sourceIdentityScope: "Selected producer sources at 3f2de27, archived as text, not a complete dependency closure; the exact instrumented Lean and consumer inputs are archived separately."
	, producers: {
		sixAbi: {
			selection
			, test: sixTest
			, queue: archived("six-abi/queue.json")
			, log: archived("six-abi/run.tap")
			, report: archived("six-abi/report.json")
			, end: archived("six-abi/end.txt")
			, calls: Object.fromEntries(sourceEntryAbis.map(abi => [abi, { stderr: archived(`six-abi/calls/${abi}.stderr.txt`), stdout: archived(`six-abi/calls/${abi}.stdout.json`) }])) }
		, feasibility: [
			{
				attempt: 1
				, outcome: "failed before the consumer: absent worktree runtime header closure"
				, queue: archived("feasibility/attempt-1/queue.json")
				, log: archived("feasibility/attempt-1/run.tap")
				, end: archived("feasibility/attempt-1/end.txt")
				, runner: archived("feasibility/attempt-1/runner.mjs.txt")
			}
			, {
				attempt: 2
				, outcome: "passed after the recorded runtime header symlink; scalar only"
				, queue: archived("feasibility/attempt-2/queue.json")
				, log: archived("feasibility/attempt-2/run.tap")
				, report: archived("feasibility/attempt-2/report.json")
				, end: archived("feasibility/attempt-2/end.txt")
				, runner: archived("feasibility/attempt-2/runner.mjs.txt")
				, calls: { stderr: archived("feasibility/attempt-2/calls/scalar.stderr.txt"), stdout: archived("feasibility/attempt-2/calls/scalar.stdout.json") }
				, identicalToSixAbiScalar: true
			}
		]
	}
	, inputs: Object.fromEntries(sourceEntryAbis.map(abi => [abi, { lean: sourceEntryInput(abi, "lean"), consumer: sourceEntryInput(abi, "consumer") }]))
	, sources
	, artifacts
	, remaining: [
		"Main integration of the probe source, CI wiring and source history."
		, "Browser and native-host source entry are not measured by this archive."
		, "These instrumented packages do not establish identity with uninstrumented or hosted archives."
		, "Any #1430 closure decision is separate."
	]
});

/**
 * Write archived bytes once; an existing file, receipt included, must already hold exactly these bytes.
 *
 * @param path - Archive path.
 * @param bytes - Exact bytes.
 */
export const writeSourceEntryArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), `${path} already holds different bytes`);
	}
};

/** Every path the archive holds besides its receipt: originals, source snapshots and inputs. */
export const sourceEntryArchivePaths = Object.freeze([
	...Object.keys(sourceEntryOriginals).map(archived)
	, ...sourceEntrySourcePaths.map(sourceEntrySnapshot)
	, ...sourceEntryAbis.flatMap(abi => [sourceEntryInput(abi, "lean"), sourceEntryInput(abi, "consumer")])
]);

/**
 * Accept only the exact archive path set, each a repository-relative path inside the archive directory.
 * This runs before any read, so a receipt cannot direct the reader anywhere else.
 *
 * @param artifacts - The receipt's artifact references.
 */
export const assertSourceEntryArtifactPaths = artifacts => {
	assert.ok(Array.isArray(artifacts), "artifacts");
	const paths = artifacts.map(artifact => artifact?.path);
	for(const path of paths)
	{
		assert.equal(typeof path, "string", "artifact path");
		assert.ok(path.startsWith(`${sourceEntryArchiveDirectory}/`) && !path.includes("\\") && !path.includes("\0"), `outside the archive: ${path}`);
		assert.ok(path.split("/").every(segment => segment !== "" && segment !== "." && segment !== ".."), `not a plain relative path: ${path}`);
	}
	assert.equal(new Set(paths).size, paths.length, "duplicate artifact path");
	assert.deepEqual([...paths].sort(), [...sourceEntryArchivePaths].sort(), "the exact archive path set");
};

/**
 * Authenticate the whole archive from its receipt and re-account every archived call.
 *
 * @param receipt - Parsed receipt.
 * @param read - Read archived bytes for a repository-relative path.
 */
export const assertSourceEntryArchive = async (receipt, read) => {
	assertSourceEntryArtifactPaths(receipt.artifacts);
	const artifacts = new Map(receipt.artifacts.map(artifact => [artifact.path, artifact]));
	for(const artifact of receipt.artifacts)
	{
		const bytes = await read(artifact.path);
		assert.equal(bytes.length, artifact.bytes, artifact.path); assert.equal(sha256(bytes), artifact.sha256, artifact.path);
	}
	assert.deepEqual(receipt, sourceEntryReceipt(receipt.artifacts, receipt.sources));
	const expected = new Set();
	for(const [name, file] of Object.entries(sourceEntryOriginals))
	{
		const artifact = artifacts.get(archived(name));
		assert.ok(artifact, name); assert.equal(artifact.originalPath, file.original); assert.equal(artifact.sha256, file.sha256, name);
		expected.add(artifact.path);
	}
	assert.deepEqual(receipt.sources.map(item => item.path), sourceEntrySourcePaths);
	const sources = {};
	for(const item of receipt.sources)
	{
		const artifact = artifacts.get(item.snapshot);
		assert.equal(item.snapshot, sourceEntrySnapshot(item.path)); assert.ok(artifact, item.snapshot);
		assert.equal(artifact.originalPath, `git:${sourceEntryRevision}:${item.path}`); assert.equal(artifact.sha256, item.sha256);
		sources[item.path] = item.sha256; expected.add(item.snapshot);
	}
	const text = async path => (await read(path)).toString();
	const digest = async path => ({ sha256: artifacts.get(path).sha256, bytes: artifacts.get(path).bytes });
	const digests = {};
	for(const abi of sourceEntryAbis)
	{
		for(const kind of ["lean", "consumer"])
		{
			const artifact = artifacts.get(sourceEntryInput(abi, kind));
			assert.ok(artifact); assert.match(artifact.originalPath, /^generated at 3f2de27: scalarFinRejectionInputs\(/u);
			expected.add(artifact.path);
		}
		assertSourceEntryInputs(abi, await text(sourceEntryInput(abi, "lean")), await text(sourceEntryInput(abi, "consumer")));
		const calls = receipt.producers.sixAbi.calls[abi];
		accountArchivedSourceEntry(abi, await text(calls.stderr), await text(calls.stdout));
		digests[abi] = { lean: artifacts.get(sourceEntryInput(abi, "lean")).sha256, consumer: artifacts.get(sourceEntryInput(abi, "consumer")).sha256, stderr: await digest(calls.stderr), stdout: await digest(calls.stdout) };
	}
	assert.deepEqual([...artifacts.keys()].sort(), [...expected].sort());
	const sixAbi = receipt.producers.sixAbi;
	assertSixAbiRun({ queue: await text(sixAbi.queue), tap: await text(sixAbi.log), end: await text(sixAbi.end), report: await text(sixAbi.report) }, digests, sources);
	const [first, second] = receipt.producers.feasibility;
	accountArchivedSourceEntry("scalar", await text(second.calls.stderr), await text(second.calls.stdout));
	assert.ok((await read(second.calls.stderr)).equals(await read(sixAbi.calls.scalar.stderr)) && (await read(second.calls.stdout)).equals(await read(sixAbi.calls.scalar.stdout)));
	assertFeasibilityAttempts({
		queue1: await text(first.queue)
		, tap1: await text(first.log)
		, end1: await text(first.end)
		, runner1: await text(first.runner)
		, queue2: await text(second.queue)
		, tap2: await text(second.log)
		, end2: await text(second.end)
		, runner2: await text(second.runner)
		, report2: await text(second.report)
	}, { ...digests.scalar, stderr: await digest(second.calls.stderr), stdout: await digest(second.calls.stdout) }, sources);
};
