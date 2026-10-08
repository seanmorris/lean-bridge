/**
 * Keep the archived scalar Fin source-entry evidence (VO #1430) tied to its producers, every recorded
 * call and its exact instrumented inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { accountArchivedSourceEntry, assertFeasibilityAttempts, assertSixAbiRun, assertSourceEntryArchive, assertSourceEntryInputs, sourceEntryAbis, sourceEntryArchiveDirectory, sourceEntryArchivePaths, sourceEntryInput, sourceEntryRevision, writeSourceEntryArtifact } from "./scalar-fin-source-entry-evidence.mjs";

const receipt = async () => {
	const bytes = await readFile(`${sourceEntryArchiveDirectory}/receipt.json`);
	assert.equal(sha256(bytes), "99538ad4a0ab76a2278be4ce086432dd712e3a412d3d26da7887f49ef9b8aaed");
	return JSON.parse(bytes);
};
const text = path => readFile(path, "utf8");
const digest = value => ({ sha256: sha256(value), bytes: Buffer.byteLength(value) });

/** Archived texts and the digests the run validators bind them to. */
const context = async () => {
	const record = await receipt(), { sixAbi, feasibility: [first, second] } = record.producers;
	const sources = Object.fromEntries(record.sources.map(item => [item.path, item.sha256]));
	const calls = {}, digests = {};
	for(const abi of sourceEntryAbis)
	{
		calls[abi] = { stderr: await text(sixAbi.calls[abi].stderr), stdout: await text(sixAbi.calls[abi].stdout) };
		const lean = await text(sourceEntryInput(abi, "lean")), consumer = await text(sourceEntryInput(abi, "consumer"));
		digests[abi] = { lean: sha256(lean), consumer: sha256(consumer), stderr: digest(calls[abi].stderr), stdout: digest(calls[abi].stdout), inputs: { lean, consumer } };
	}
	const six = { queue: await text(sixAbi.queue), tap: await text(sixAbi.log), end: await text(sixAbi.end), report: await text(sixAbi.report) };
	const attempts = {
		queue1: await text(first.queue)
		, tap1: await text(first.log)
		, end1: await text(first.end)
		, runner1: await text(first.runner)
		, queue2: await text(second.queue)
		, tap2: await text(second.log)
		, end2: await text(second.end)
		, runner2: await text(second.runner)
		, report2: await text(second.report)
	};
	return { record, sources, calls, digests, six, attempts };
};

// Split a run into per-call marker lists and records, and render it back exactly.
const parse = ({ stderr, stdout }) => {
	const segments = [];
	for(const line of stderr.split("\n").slice(0, -1))
		if(line.startsWith("lean-bridge-call-begin ")) segments.push([]);
		else if(line.startsWith("lean-bridge-source-entry ")) segments.at(-1).push(line);
	return { segments, result: JSON.parse(stdout) };
};
const render = ({ segments, result }) => ({
	stderr: segments.map((markers, id) => [`lean-bridge-call-begin ${id}`, ...markers, `lean-bridge-call-end ${id}`].join("\n")).join("\n") + "\n"
	, stdout: JSON.stringify(result) + "\n"
});

test("the source-entry archive authenticates the six-ABI run, both attempts, every input and every call", async () => {
	const { record, calls } = await context();
	assert.equal(record.revision, sourceEntryRevision); assert.equal(record.planNode, 1430);
	assert.deepEqual([record.scope.hostedCi, record.scope.browsers, record.scope.nativeHosts, record.scope.uninstrumentedArchiveIdentity, record.scope.closure], [false, false, false, "not established", "not claimed"]);
	// Rendering a parsed run reproduces its bytes, so the mutations below change only what they name.
	for(const abi of sourceEntryAbis) assert.deepEqual(render(parse(calls[abi])), calls[abi], abi);
	await assertSourceEntryArchive(record, path => readFile(path));
});

test("per-call re-accounting refuses moved, duplicated, missing or compensated markers and changed labels", async () => {
	const { calls } = await context();
	for(const abi of sourceEntryAbis) accountArchivedSourceEntry(abi, calls[abi].stderr, calls[abi].stdout);
	const run = parse(calls.scalar), records = run.result.calls;
	const success = records.findIndex((record, index) => record[3] === 1 && records[index + 1]?.[3] === 0), rejected = success + 1;
	const lateIndex = records.findIndex(record => record[4] === "pair raw late");
	assert.ok(success >= 0 && lateIndex >= 0);
	const mutate = change => {
		const copy = structuredClone(run); change(copy);
		return render(copy);
	};
	const refused = {
		"marker moved into the next, rejected call": mutate(copy => copy.segments[rejected].push(copy.segments[success].pop()))
		, "duplicate marker": mutate(copy => copy.segments[success].push(copy.segments[success][0]))
		, "missing marker": mutate(copy => copy.segments[success].pop())
		, "marker added to a rejected call": mutate(copy => copy.segments[rejected].push(`lean-bridge-source-entry ${records[rejected][1]}`))
		// One rejected call entered and one successful call did not: every total is unchanged.
		, "compensated pair": mutate(copy => {
			const other = copy.result.calls.findIndex((record, index) => index > rejected && record[3] === 1 && record[1] === records[rejected][1]);
			copy.segments[rejected].push(copy.segments[other].pop());
		})
		, "wrong export in a marker": mutate(copy => { copy.segments[success] = [`lean-bridge-source-entry ${records[success][1] === "mirror" ? "huge" : "mirror"}`]; })
		, "late label removed": mutate(copy => { copy.result.calls[lateIndex][4] = null; })
		, "late case relabelled": mutate(copy => { copy.result.calls[lateIndex][4] = "pair raw early"; })
		, "late case on the public route": mutate(copy => { copy.result.calls[lateIndex][2] = "public"; })
		, "rejection recorded as success with its marker": mutate(copy => {
			copy.result.calls[rejected][3] = 1; copy.result.calls[rejected][4] = null;
			copy.segments[rejected] = [`lean-bridge-source-entry ${records[rejected][1]}`];
		})
		, "report count": mutate(copy => { copy.result.checks++; })
	};
	for(const [label, output] of Object.entries(refused))
		assert.throws(() => accountArchivedSourceEntry("scalar", output.stderr, output.stdout), assert.AssertionError, label);
	const text = calls.scalar.stderr;
	const end = text.indexOf("lean-bridge-call-end 0\n");
	for(const [label, stderr] of [
		["marker after its call", text.replace("lean-bridge-source-entry mirror\nlean-bridge-call-end 0\n", "lean-bridge-call-end 0\nlean-bridge-source-entry mirror\n")]
		, ["panic inside a call", `${text.slice(0, end)}PANIC at OnboardingSmall.mirror\n${text.slice(end)}`]
		, ["foreign line between calls", text.replace("lean-bridge-call-begin 1\n", "warning\nlean-bridge-call-begin 1\n")]
		, ["missing newline", text.slice(0, -1)]
	])
		assert.throws(() => accountArchivedSourceEntry("scalar", stderr, calls.scalar.stdout), assert.AssertionError, label);
	// Each ABI's calls belong to that ABI only.
	for(const [abi, other] of [["scalar", "callable"], ["callable", "copied"], ["record", "nominal"]])
		assert.throws(() => accountArchivedSourceEntry(abi, calls[other].stderr, calls[other].stdout), assert.AssertionError, `${other} as ${abi}`);
});

test("the six-ABI report, queue, TAP and end record refuse changed counts, order, inputs and producer identity", async () => {
	const { six, digests, sources } = await context();
	assertSixAbiRun(six, digests, sources);
	const report = change => {
		const copy = JSON.parse(six.report); change(copy);
		return { ...six, report: JSON.stringify(copy) };
	};
	const queue = change => {
		const copy = JSON.parse(six.queue); change(copy);
		return { ...six, queue: JSON.stringify(copy) };
	};
	const refused = {
		"checks": report(copy => { copy.observations[1].checks++; })
		, "rejections": report(copy => { copy.observations[2].rejections--; })
		, "entered": report(copy => { copy.observations[3].sourceEntry.entered++; })
		, "export accounting": report(copy => { copy.observations[0].sourceEntry.exports.mirror.rejected--; })
		, "ABI order": report(copy => { copy.observations.reverse(); })
		, "private ABI": report(copy => { copy.observations[4].privateAbi = 2; })
		, "lean input": report(copy => { copy.observations[5].sourceEntry.leanSha256 = digests.scalar.lean; })
		, "consumer input": report(copy => { copy.observations[0].sourceEntry.consumerSha256 = digests.callable.consumer; })
		, "retained output": report(copy => { copy.observations[0].sourceEntry.retained["stderr.txt"].sha256 = digests.callable.stderr.sha256; })
		, "instrumentation": report(copy => { copy.instrumentation = "unmodified hosted packages"; })
		, "dropped ABI": report(copy => { copy.observations.pop(); })
		, "queue revision": queue(copy => { copy.revision = "0".repeat(40); })
		, "queue selection": queue(copy => { copy.selection = "tests/scalar-fin-rejection.test.mjs"; })
		, "queue gate": queue(copy => { copy.environment.LEAN_BRIDGE_SCALAR_FIN_SOURCE_ENTRY = "0"; })
		, "queue runtime": queue(copy => { copy.runtimeRoot.mainWasmSha256 = "0".repeat(64); })
		, "queue repair": queue(copy => { copy.environmentRepair.target = "/tmp/lean-runtime"; })
		, "queue source": queue(copy => { copy.producerSources["tests/helpers/scalar-fin-source-entry.mjs"] = "0".repeat(64); })
		, "queue CPU": queue(copy => { copy.cpu = "taskset -c 0"; })
		, "failed TAP": { ...six, tap: six.tap.replace("ok 1 -", "not ok 1 -") }
		, "skipped TAP": { ...six, tap: six.tap.replace("# skipped 0", "# skipped 1") }
		, "nonzero exit": { ...six, end: six.end.replace("exit=0", "exit=1") }
		, "floor breached": { ...six, end: six.end.replace(/minFree=\d+M/u, "minFree=900M") }
	};
	for(const [label, files] of Object.entries(refused))
		assert.throws(() => assertSixAbiRun(files, digests, sources), assert.AssertionError, label);
});

test("both feasibility attempts keep their runners, causes, repair and scalar observation", async () => {
	const { attempts, digests, sources, calls } = await context();
	const scalar = { ...digests.scalar, stderr: digest(calls.scalar.stderr), stdout: digest(calls.scalar.stdout) };
	assertFeasibilityAttempts(attempts, scalar, sources);
	const queue = (key, change) => {
		const copy = JSON.parse(attempts[key]); change(copy);
		return { ...attempts, [key]: JSON.stringify(copy) };
	};
	const refused = {
		"first revision": queue("queue1", copy => { copy.revision = "0".repeat(40); })
		, "second runner digest": queue("queue2", copy => { copy.runner.sha256 = "0".repeat(64); })
		, "second cause": queue("queue2", copy => { copy.previousAttempt.cause = "unknown"; })
		, "second repair": queue("queue2", copy => { delete copy.environmentRepair; })
		, "first claims a repair": queue("queue1", copy => { copy.environmentRepair = copy.runtimeRoot; })
		, "swapped runners": { ...attempts, runner1: attempts.runner2, runner2: attempts.runner1 }
		, "second runner changed beyond its base": { ...attempts, runner2: attempts.runner2.replace("\"scalar\"", "\"callable\"") }
		, "first cause lost": { ...attempts, tap1: attempts.tap1.replace("The shared runtime header closure is unavailable", "failed") }
		, "first passed": { ...attempts, end1: attempts.end1.replace("exit=1", "exit=0") }
		, "second failed": { ...attempts, tap2: attempts.tap2.replace("# fail 0", "# fail 1") }
		, "second scope": { ...attempts, report2: attempts.report2.replace("feasibility: scalar private ABI 2 only, one build", "six ABIs") }
	};
	for(const [label, files] of Object.entries(refused))
		assert.throws(() => assertFeasibilityAttempts(files, scalar, sources), assert.AssertionError, label);
	assert.throws(() => assertFeasibilityAttempts(attempts, { ...scalar, consumer: digests.callable.consumer }, sources), assert.AssertionError);
});

test("archived inputs must mark every export by name and keep each exact late case", async () => {
	const { digests } = await context();
	for(const abi of sourceEntryAbis) assertSourceEntryInputs(abi, digests[abi].inputs.lean, digests[abi].inputs.consumer);
	const { lean, consumer } = digests.callable.inputs;
	for(const [label, changedLean, changedConsumer] of [
		["marker removed", lean.replace("dbgTrace \"lean-bridge-source-entry apply\" fun _ => ", ""), consumer]
		, ["marker renamed", lean.replace("lean-bridge-source-entry pair\"", "lean-bridge-source-entry mirror\""), consumer]
		, ["control removed", lean.replace(/^def traceNat .*\n/mu, ""), consumer]
		, ["late case removed", lean, consumer.replace("rejected(() => raw(\"pair\", [2n, 4n]), \"pair raw late\", failure);", "")]
		, ["case labels removed", lean, consumer.replace("  sourceEntryCase = label;\n", "")]
		, ["control values changed", lean, consumer.replace("184467440737095516171n]", "12n]")]
	])
		assert.throws(() => assertSourceEntryInputs("callable", changedLean, changedConsumer), assert.AssertionError, label);
	assert.throws(() => assertSourceEntryInputs("scalar", lean, consumer), assert.AssertionError, "callable inputs as scalar");
});

test("the receipt refuses overclaimed scope, changed producer identity and dropped or replaced artifacts", async () => {
	const { record } = await context();
	const read = path => readFile(path);
	const mutations = {
		"hosted CI": changed => { changed.scope.hostedCi = true; }
		, "browsers": changed => { changed.scope.browsers = true; }
		, "native hosts": changed => { changed.scope.nativeHosts = true; }
		, "uninstrumented identity": changed => { changed.scope.uninstrumentedArchiveIdentity = "established"; }
		, "closure": changed => { changed.scope.closure = "claimed"; }
		, "hosted comparison": changed => { changed.scope.observedCounts = "identical to hosted CI"; }
		, "revision": changed => { changed.revision = "0".repeat(40); }
		, "runtime identity": changed => { changed.producerEnvironment.runtimeRoot.mainMjsSha256 = "0".repeat(64); }
		, "repair": changed => { changed.producerEnvironment.environmentRepair.target = "/tmp"; }
		, "attempt dropped": changed => { changed.producers.feasibility.pop(); }
		, "attempt outcome": changed => { changed.producers.feasibility[0].outcome = "passed"; }
		, "remaining dropped": changed => { changed.remaining.pop(); }
		, "source path": changed => { changed.sources[0].path = "tests/helpers/other.mjs"; }
		, "artifact provenance": changed => { changed.artifacts[0].originalPath = "build/other.json"; }
		, "artifact digest": changed => { changed.artifacts[0].sha256 = "0".repeat(64); }
		, "artifact dropped": changed => { changed.artifacts = changed.artifacts.filter(item => !item.path.endsWith("attempt-1/end.txt")); }
	};
	for(const [label, mutate] of Object.entries(mutations))
	{
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertSourceEntryArchive(changed, read), assert.AssertionError, label);
	}
	// A changed archived byte fails its digest even with the receipt unchanged.
	await assert.rejects(() => assertSourceEntryArchive(record, async path => {
		const bytes = await readFile(path);
		return path.endsWith("six-abi/calls/nominal.stdout.json") ? Buffer.concat([bytes, Buffer.from(" ")]) : bytes;
	}), assert.AssertionError);
});

test("the archive validator accepts only its exact repository-relative path set and reads nothing before checking it", async () => {
	const { record } = await context();
	const observed = [];
	await assertSourceEntryArchive(record, path => {
		observed.push(path);
		return readFile(path);
	});
	// Only the 52 archived paths are read; the receipt itself is never read through the archive reader.
	assert.equal(sourceEntryArchivePaths.length, 52);
	assert.deepEqual([...new Set(observed)].sort(), [...sourceEntryArchivePaths].sort());
	const first = record.artifacts[0].path;
	const refused = {
		"absolute path": changed => { changed.artifacts[0].path = "/etc/hostname"; }
		, "parent traversal": changed => { changed.artifacts[0].path = `${sourceEntryArchiveDirectory}/../../../package.json`; }
		, "dot segment": changed => { changed.artifacts[0].path = first.replace("/six-abi/", "/./six-abi/"); }
		, "empty segment": changed => { changed.artifacts[0].path = first.replace("/six-abi/", "//six-abi/"); }
		, "backslash": changed => { changed.artifacts[0].path = first.replace("/six-abi/", "/six-abi\\"); }
		, "outside the archive": changed => { changed.artifacts[0].path = "package.json"; }
		, "unknown archive path": changed => { changed.artifacts[0].path = `${sourceEntryArchiveDirectory}/six-abi/unknown.txt`; }
		, "duplicate path": changed => { changed.artifacts[1].path = first; }
		, "extra artifact": changed => { changed.artifacts.push({ ...changed.artifacts[0], path: `${sourceEntryArchiveDirectory}/extra.txt` }); }
		, "missing artifact": changed => { changed.artifacts.pop(); }
		, "path not text": changed => { changed.artifacts[0].path = 7; }
	};
	for(const [label, mutate] of Object.entries(refused))
	{
		const changed = structuredClone(record);
		mutate(changed);
		let reads = 0;
		await assert.rejects(() => assertSourceEntryArchive(changed, async () => {
			reads++;
			return Buffer.alloc(0);
		}), assert.AssertionError, label);
		assert.equal(reads, 0, `${label} reached the reader`);
	}
});

test("the archive writer keeps identical bytes and refuses any differing original or receipt", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-source-entry-archive-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const path = join(directory, "nested", "receipt.json");
	await writeSourceEntryArtifact(path, Buffer.from("one\n"));
	await writeSourceEntryArtifact(path, Buffer.from("one\n"));
	await assert.rejects(() => writeSourceEntryArtifact(path, Buffer.from("two\n")), assert.AssertionError);
	assert.equal(await readFile(path, "utf8"), "one\n");
});
