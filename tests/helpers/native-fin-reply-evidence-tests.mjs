/**
 * Keep the archived host reply evidence (VO #1453) tied to its producers, callers, sources and scope.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertFinReplyArchive, assertFinReplyCaller, assertFinReplyFailure, assertFinReplyFresh, assertFinReplyInstalledExecution, assertFinReplyInstalledReport, assertFinReplySignatures, assertFinReplyWrapper, finReplyArchiveDirectory, finReplyFailures, finReplyInstalledRevision, finReplySignatures, finReplyWrapperRevision, writeFinReplyArtifact } from "./native-fin-reply-evidence.mjs";

const receiptPath = `${finReplyArchiveDirectory}/receipt.json`;
const receipt = async () => {
	const bytes = await readFile(receiptPath);
	assert.equal(sha256(bytes), "ba6506d36753dd8c5ed6aea487609c0cacafb9c6a3b82898443fd8d70a7e1830");
	return JSON.parse(bytes);
};
const text = path => readFile(path, "utf8");
const selection = async () => {
	const record = await receipt(), { installed, wrapper, freshLean } = record.producers;
	const snapshot = (sources, path) => text(sources.find(item => item.path === path).snapshot);
	return {
		record
		, installed: JSON.parse(await text(installed.report))
		, installedLog: await text(installed.log)
		, installedQueue: await text(installed.queue)
		, callers: { c: await text(installed.callers.c), cpp: await text(installed.callers.cpp) }
		, cSource: await snapshot(installed.sources, "tests/fixtures/fin-reply-consumers/c.c")
		, lean: await snapshot(installed.sources, "tests/fixtures/onboarding/native-fin-replies/FinReplies.lean")
		, wrapperLean: await snapshot(wrapper.sources, "tests/fixtures/onboarding/native-fin-replies/FinReplies.lean")
		, wrapper: JSON.parse(await text(wrapper.report))
		, wrapperLog: await text(wrapper.log)
		, wrapperQueue: await text(wrapper.queue)
		, bypass: await snapshot(wrapper.sources, "tests/fixtures/fin-reply-consumers/bypass.c")
		, fresh: await text(freshLean.log)
		, failures: await Promise.all(record.failedAttempts.map(async attempt => ({ queue: await text(attempt.queue), tap: await text(attempt.log), failure: await text(attempt.failure) })))
	};
};
const replaceOnce = (value, from, to) => {
	assert.equal(value.split(from).length, 2, from);
	return value.replace(from, to);
};

test("host reply archive authenticates the installed, fresh Lean and wrapper producers and three failed attempts", async () => {
	const record = await receipt();
	assert.equal(record.producers.installed.revision, finReplyInstalledRevision);
	assert.equal(record.producers.freshLean.revision, finReplyInstalledRevision);
	assert.equal(record.producers.wrapper.revision, finReplyWrapperRevision);
	assert.deepEqual(record.scope.dispatch.installed, "not measured");
	assert.equal(record.scope.hostedCi, false); assert.equal(record.scope.otherNativeHosts, false); assert.equal(record.scope.reviewedContracts, false);
	assert.equal(record.failedAttempts.length, 3);
	await assertFinReplyArchive(record, path => readFile(path));
});

test("host reply receipts refuse overclaimed scope, swapped producers and dropped or replaced artifacts", async () => {
	const record = await receipt(), read = path => readFile(path);
	const mutations = {
		"installed dispatch measured": changed => { changed.scope.dispatch.installed = "measured"; }
		, "wrapper dispatch counter": changed => { changed.scope.dispatch.wrapper = "C and C++ source entry counted"; }
		, "wrapper sanitizers cover Lean": changed => { changed.scope.sanitizers.wrapper = "ASan and UBSan on every library"; }
		, "hosted CI": changed => { changed.scope.hostedCi = true; }
		, "other native hosts": changed => { changed.scope.otherNativeHosts = true; }
		, "reviewed contracts": changed => { changed.scope.reviewedContracts = true; }
		, "installed C count": changed => { changed.scope.installedChecks = { c: 82, cpp: 74 }; }
		, "glibc floor": changed => { changed.producerEnvironment.glibcFloor = "2.28"; }
		, "remaining dropped": changed => { changed.remaining.pop(); }
		, "failed attempt dropped": changed => { changed.failedAttempts.pop(); }
		, "failed attempt rewritten": changed => { changed.failedAttempts[2].cause = "unrelated"; }
		, "wrapper revision": changed => { changed.producers.wrapper.revision = finReplyInstalledRevision; }
		, "installed revision": changed => { changed.producers.installed.revision = finReplyWrapperRevision; }
		, "fresh Lean tests": changed => { changed.producers.freshLean.tests = changed.producers.freshLean.tests.slice(1); }
		, "fresh Lean queue claimed": changed => { changed.producers.freshLean.queue = changed.producers.installed.queue; }
		, "installed source dropped": changed => { changed.producers.installed.sources.pop(); }
		, "wrapper source taken from 5459b7f": changed => {
			const lean = changed.producers.wrapper.sources.find(item => item.path.endsWith("FinReplies.lean"));
			Object.assign(lean, changed.producers.installed.sources.find(item => item.path === lean.path));
		}
		, "artifact dropped": changed => { changed.artifacts = changed.artifacts.filter(item => !item.path.endsWith("failed/0dffe44.tap")); }
		, "artifact digest": changed => { changed.artifacts[0].sha256 = "0".repeat(64); }
		, "artifact provenance": changed => { changed.artifacts[0].originalPath = "build/other.json"; }
	};
	for(const [label, mutate] of Object.entries(mutations))
	{
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertFinReplyArchive(changed, read), assert.AssertionError, label);
	}
	// A changed archived byte fails its digest even when the receipt is unchanged.
	await assert.rejects(() => assertFinReplyArchive(record, async path => {
		const bytes = await readFile(path);
		return path.endsWith("installed.json") ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
	}), assert.AssertionError);
});

test("installed host reply validation refuses altered counts, fork flags, profiles, roots and source-free claims", async () => {
	const { installed, callers } = await selection();
	assertFinReplyInstalledReport(installed, callers);
	const mutations = {
		"C checks": changed => { changed.reports[0].checks = 82; }
		, "C++ checks": changed => { changed.reports[1].checks = 73; }
		, "result checks": changed => { changed.reports[0].result.checks = 80; }
		, "fork status zero": changed => { changed.reports[0].result.forkStatus = 0; }
		, "fork status other": changed => { changed.reports[1].result.forkStatus = 6; }
		, "fork reached host": changed => { changed.reports[0].result.forkHostCalls = 1; }
		, "missing profile": changed => { changed.reports.pop(); }
		, "swapped profiles": changed => { changed.reports.reverse(); }
		, "not reproducible": changed => { changed.reproducible = false; }
		, "second root differs": changed => { changed.archives["archives/finreplies-1.0.0-c.tar.gz"] = "0".repeat(64); }
		, "source kept": changed => { changed.reports[0].sourceRemovedBeforeInstallation = false; }
		, "online install": changed => { changed.reports[1].offlineInstall = false; }
		, "compiler path": changed => { changed.reports[0].compilerFreePath = false; }
		, "reviewed path": changed => { changed.reports[0].path = "reviewed-source"; }
		, "instrumented": changed => { changed.reports[1].instrumentation = "ASan"; }
		, "scope": changed => { changed.scope = "installed acceptance for every native host"; }
		, "binding IR": changed => { changed.reports[0].bindingIrSha256 = "0".repeat(64); }
		, "package version": changed => { changed.reports[1].packages[0].version = "1.0.1"; }
		, "extra package": changed => { changed.reports[0].packages.push(changed.reports[1].packages[0]); }
		, "C consumer": changed => { changed.reports[0].consumerSha256 = changed.reports[1].consumerSha256; }
	};
	for(const [label, mutate] of Object.entries(mutations))
	{
		const changed = structuredClone(installed); mutate(changed);
		assert.throws(() => assertFinReplyInstalledReport(changed, callers), assert.AssertionError, label);
	}
	// A changed caller byte no longer matches the digest of the consumer the run compiled.
	assert.throws(() => assertFinReplyInstalledReport(installed, { ...callers, cpp: `${callers.cpp} ` }), assert.AssertionError);
	assert.throws(() => assertFinReplyInstalledReport(installed, { ...callers, c: callers.c.replace("81", "82") }), assert.AssertionError);
});

test("the expanded C caller is the generated macro block over the archived consumer and agrees with the wrapper's names", async () => {
	const { callers, cSource, wrapper } = await selection();
	assertFinReplyCaller(callers.c, cSource, wrapper.names);
	const maybe = /^#define HOST_maybe (\w+)$/mu.exec(callers.c)[1];
	for(const [label, caller, source, names] of [
		["consumer byte", callers.c, `${cSource} `, wrapper.names]
		, ["macro renamed", replaceOnce(callers.c, "#define HOST_wide ", "#define HOST_wider "), cSource, wrapper.names]
		, ["macro dropped", callers.c.replace(/^#define HOST_listed .*\n/mu, ""), cSource, wrapper.names]
		, ["module-qualified tile", replaceOnce(callers.c, "finreplies_option_lean_fin_replies_tile_value", "finreplies_option_lean_sample_tile_value"), cSource, wrapper.names]
		, ["alias type split", replaceOnce(callers.c, `#define HOST_aliased ${maybe}`, "#define HOST_aliased finreplies_callback00000000000000000000"), cSource, wrapper.names]
		, ["wrapper names differ", callers.c, cSource, { ...wrapper.names, HOST_MAYBE: "finreplies_callback00000000000000000000" }]
		, ["wrapper second differs", callers.c, cSource, { ...wrapper.names, HOST_TWICE_SECOND: wrapper.names.HOST_MAYBE }]
	])
		assert.throws(() => assertFinReplyCaller(caller, source, names), assert.AssertionError, label);
});

test("each producer's fixture keeps its exact signatures, bounds and nominal reply shapes", async () => {
	const { lean, wrapperLean } = await selection();
	assertFinReplySignatures(lean, finReplySignatures.installed);
	assertFinReplySignatures(wrapperLean, finReplySignatures.wrapper);
	// The wrapper's fixture is the earlier one, so the later exports would be invented there.
	assert.throws(() => assertFinReplySignatures(wrapperLean, finReplySignatures.installed), assert.AssertionError);
	assert.throws(() => assertFinReplySignatures(lean, finReplySignatures.wrapper), assert.AssertionError);
	for(const [label, from, to] of [
		["maybe bound", "def maybe (host : Nat → Option (Fin 5))", "def maybe (host : Nat → Option (Fin 6))"]
		, ["wide bound", "Fin 184467440737095516170", "Fin 184467440737095516171"]
		, ["failure branch", "Except (Fin 7) Nat", "Except Nat (Fin 7)"]
		, ["Tile field", "  digit : Fin 5\n  count : Nat", "  digit : Fin 6\n  count : Nat"]
		, ["Slot field", "  digit : Option (Fin 5)", "  digit : Option (Fin 4)"]
		, ["Trailing case", "| digit (value : Fin 10)", "| digit (value : Fin 11)"]
		, ["alias target", "abbrev MaybeDigit := Option (Fin 5)", "abbrev MaybeDigit := Option (Fin 3)"]
		, ["second callback", "(second : Nat → Nat)", "(second : Nat → Option (Fin 5))"]
		, ["plain export", "def plain (n : Nat) : Nat :=", "def plain (n : Fin 3) : Nat :="]
	])
		assert.throws(() => assertFinReplySignatures(replaceOnce(lean, from, to), finReplySignatures.installed), assert.AssertionError, label);
	assert.throws(() => assertFinReplySignatures(`${lean}\ndef extra (host : Nat → Option (Fin 2)) : Nat := 0\n`, finReplySignatures.installed), assert.AssertionError);
	assert.throws(() => assertFinReplySignatures(`${lean}\nstructure Extra where\n  digit : Fin 2\n`, finReplySignatures.installed), assert.AssertionError);
});

test("installed, fresh Lean and failed-attempt logs and queues refuse mismatched revisions, missing roots and changed results", async () => {
	const { installedLog, installedQueue, fresh, failures } = await selection();
	assertFinReplyInstalledExecution(installedLog, installedQueue);
	const queue = JSON.parse(installedQueue);
	const queued = mutate => {
		const changed = structuredClone(queue); mutate(changed);
		return JSON.stringify(changed, null, 2);
	};
	for(const [label, tap, changedQueue] of [
		["second root missing", installedLog.replace("# build 1: c, cpp\n", ""), installedQueue]
		, ["C++ missing", installedLog.replace("# installing and checking cpp\n", ""), installedQueue]
		, ["pass count", replaceOnce(installedLog, "# pass 1", "# pass 0"), installedQueue]
		, ["skipped", replaceOnce(installedLog, "# skipped 0", "# skipped 1"), installedQueue]
		, ["failed", replaceOnce(installedLog, "ok 1 -", "not ok 1 -"), installedQueue]
		, ["queue revision", installedLog, queued(changed => { changed.revision = finReplyWrapperRevision; })]
		, ["queue profiles", installedLog, queued(changed => { changed.environment.LEAN_BRIDGE_FIN_REPLY_PROFILES = "c"; })]
		, ["queue glibc floor", installedLog, queued(changed => { changed.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR = "2.38"; })]
		, ["queue CPU", installedLog, queued(changed => { changed.cpu = "taskset -c 0"; })]
		, ["queue report", installedLog, queued(changed => { changed.report = "/app/build/vo1453-fin-replies-installed-c02c760.json"; })]
		, ["queue Lean", installedLog, queued(changed => { changed.versions.lean = "Lean (version 4.31.0)"; })]
		, ["queue free space", installedLog, queued(changed => { changed.freeSpace = "1024M"; })]
	])
		assert.throws(() => assertFinReplyInstalledExecution(tap, changedQueue), assert.AssertionError, label);
	assertFinReplyFresh(fresh);
	for(const changed of [fresh.replace(/^ok 3 - .*\n/mu, "")
		, replaceOnce(fresh, "# pass 3", "# pass 2")
		, replaceOnce(fresh, "# skipped 0", "# skipped 1")
		, fresh.replace("compiles each typed reconstruction\n", "compiles each typed reconstruction # SKIP\n")])
		assert.throws(() => assertFinReplyFresh(changed), assert.AssertionError);
	for(const [index, failure] of finReplyFailures.entries())
	{
		const files = failures[index];
		assertFinReplyFailure(failure, files);
		const other = failures[(index + 1) % failures.length];
		for(const [label, changed] of [
			["revision swapped", { ...files, queue: other.queue }]
			, ["passed instead", { ...files, tap: files.tap.replace("not ok 1 -", "ok 1 -") }]
			, ["cause replaced", { ...files, failure: other.failure }]
			, ["profile", { ...files, tap: files.tap.replace(`# installing and checking ${failure.profile}\n`, "") }]
		])
			assert.throws(() => assertFinReplyFailure(failure, changed), assert.AssertionError, `${failure.attempt}/${label}`);
	}
});

test("wrapper validation refuses installed-acceptance scope, widened instrumentation, other bounds and other producers", async () => {
	const { wrapper, wrapperLog, wrapperQueue, bypass } = await selection();
	assertFinReplyWrapper(wrapper, wrapperLog, wrapperQueue, bypass);
	const mutations = {
		"installed scope": changed => { changed.scope = "source-free installed C/C++ acceptance"; }
		, "Lean instrumented": changed => { changed.instrumented.push("component"); }
		, "runtime dropped": changed => { changed.uninstrumented.pop(); }
		, "sanitizer flag": changed => { changed.compiler.wrapper = changed.compiler.wrapper.filter(flag => flag !== "-fsanitize=address,undefined"); }
		, "recover": changed => { changed.compiler.consumer = changed.compiler.consumer.filter(flag => flag !== "-fno-sanitize-recover=undefined"); }
		, "leaks": changed => { changed.compiler.environment.ASAN_OPTIONS = "halt_on_error=0"; }
		, "checked count": changed => { changed.runs.checked.stdout[1] = "fin-reply-ok checked 26"; }
		, "stripped fork": changed => { changed.runs.stripped.stdout[0] = "fork-status 0 1"; }
		, "stripped equals checked": changed => { changed.runs.stripped.librarySha256 = changed.runs.checked.librarySha256; }
		, "other bound": changed => { changed.removed[0] = changed.removed[0].replace("0x5u", "0x6u"); }
		, "more removed": changed => { changed.removed.push("/* extra */"); }
		, "names": changed => { changed.names.HOST_TWICE_FIRST = changed.names.HOST_TWICE_SECOND; }
		, "harness": changed => { changed.harnessSha256 = "0".repeat(64); }
		, "compiler": changed => { changed.compiler.version = "cc 13"; }
	};
	for(const [label, mutate] of Object.entries(mutations))
	{
		const changed = structuredClone(wrapper); mutate(changed);
		assert.throws(() => assertFinReplyWrapper(changed, wrapperLog, wrapperQueue, bypass), assert.AssertionError, label);
	}
	const queue = JSON.parse(wrapperQueue);
	for(const [label, tap, changedQueue, source] of [
		["bypass byte", wrapperLog, wrapperQueue, `${bypass} `]
		, ["log result", replaceOnce(wrapperLog, "# fail 0", "# fail 1"), wrapperQueue, bypass]
		, ["queue revision", wrapperLog, JSON.stringify({ ...queue, revision: finReplyInstalledRevision }), bypass]
		, ["queue gate", wrapperLog, JSON.stringify({ ...queue, environment: { ...queue.environment, LEAN_BRIDGE_NATIVE_FIN_REPLY_TEST: "0" } }), bypass]
		, ["queue selection", wrapperLog, JSON.stringify({ ...queue, selection: "tests/native-fin-callbacks.test.mjs" }), bypass]
	])
		assert.throws(() => assertFinReplyWrapper(wrapper, tap, changedQueue, source), assert.AssertionError, label);
});

test("the archive writer keeps identical bytes and refuses any differing original or receipt", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-reply-archive-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const path = join(directory, "nested", "receipt.json");
	await writeFinReplyArtifact(path, Buffer.from("one\n"));
	await writeFinReplyArtifact(path, Buffer.from("one\n"));
	await assert.rejects(() => writeFinReplyArtifact(path, Buffer.from("two\n")), assert.AssertionError);
	assert.equal(await readFile(path, "utf8"), "one\n");
});
