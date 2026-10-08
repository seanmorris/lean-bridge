/**
 * Keep the archived installed native PHP Fin dispatch-counter run (VO #1425) tied to its producer sources,
 * its seven passing tests, both installed routes and the exact per-step counts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import "./helpers/php-dispatch-integration-source-history-tests.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import { assertPhpDispatchArchive, assertPhpDispatchDeltas, assertPhpDispatchReport, assertPhpDispatchRows, assertPhpDispatchRun, assertPhpDispatchTestSource, phpDispatchArchiveDirectory, phpDispatchArchivePaths, phpDispatchRows, phpDispatchSnapshot, phpDispatchSources, phpDispatchTests, writePhpDispatchArtifact } from "./helpers/php-fin-dispatch-evidence.mjs";

const receipt = async () => {
	const bytes = await readFile(`${phpDispatchArchiveDirectory}/receipt.json`);
	assert.equal(sha256(bytes), "be5a5e2ae6397eb4c148957818fc5047a20a279b246e2e50c50f1116fce18b72");
	return JSON.parse(bytes);
};
const text = name => readFile(`${phpDispatchArchiveDirectory}/${name}`, "utf8");

test("the PHP dispatch archive authenticates its run, reports and producer sources from its own paths", async () => {
	const record = await receipt(), observed = [];
	await assertPhpDispatchArchive(record, path => {
		observed.push(path);
		return readFile(path);
	}, { currentSources: false });
	assert.deepEqual([...new Set(observed)].sort(), [...phpDispatchArchivePaths].sort());
	assert.deepEqual([record.scope.otherHosts, record.scope.hostedCi], [false, false]);
});

test("the current producer sources reach their exact dispatch-run digests", async () => {
	const observed = [];
	await assertPhpDispatchArchive(await receipt(), path => {
		observed.push(path);
		return readFile(path);
	});
	assert.deepEqual([...new Set(observed)].sort(), [...phpDispatchArchivePaths, ...Object.keys(phpDispatchSources)].sort());
});

test("the dispatch run records refuse a skipped, failed, renumbered, unplanned or nonzero run and another producer", async () => {
	const files = { queue: await text("queue.json"), tap: await text("run.tap"), end: await text("end.txt") };
	assertPhpDispatchRun(files);
	const queue = change => {
		const copy = JSON.parse(files.queue);
		change(copy);
		return { ...files, queue: JSON.stringify(copy) };
	};
	const gated = phpDispatchTests.at(-1);
	const refused = {
		"skipped": { ...files, tap: files.tap.replace(`ok 7 - ${gated}`, `ok 7 - ${gated} # SKIP`).replace("# pass 7", "# pass 6").replace("# skipped 0", "# skipped 1") }
		, "failed": { ...files, tap: files.tap.replace("ok 6 -", "not ok 6 -").replace("# pass 7", "# pass 6").replace("# fail 0", "# fail 1") }
		, "renumbered": { ...files, tap: files.tap.replace("ok 7 -", "ok 8 -") }
		, "dropped": { ...files, tap: files.tap.replace(`ok 7 - ${gated}\n`, "").replace("1..7", "1..6") }
		, "second plan": { ...files, tap: files.tap.replace("1..7\n", "1..7\n1..7\n") }
		, "other test": { ...files, tap: files.tap.replace(`ok 7 - ${gated}`, "ok 7 - native PHP packages are checked Fin consumers beside the other C-adapter hosts") }
		, "nonzero exit": { ...files, end: files.end.replace("exit=0", "exit=1") }
		, "floor breached": { ...files, end: files.end.replace(/minFree=\d+M/u, "minFree=900M") }
		, "other revision": queue(copy => { copy.revision = "0".repeat(40); })
		, "other selection": queue(copy => { copy.selection = "tests/php-fin.test.mjs"; })
		, "gate off": queue(copy => { copy.environment.LEAN_BRIDGE_PHP_FIN_TEST = "0"; })
		, "other glibc floor": queue(copy => { copy.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR = "2.38"; })
		, "other CPU": queue(copy => { copy.cpu = "taskset -c 2"; })
		, "changed test source": queue(copy => { copy.sources["tests/php-fin.test.mjs"] = "0".repeat(64); })
		, "changed interposer": queue(copy => { copy.sources["tests/helpers/native-fin-count-interposer.mjs"] = "0".repeat(64); })
		, "dropped source": queue(copy => { delete copy.sources["src/build/native-component.mjs"]; })
		, "other PHP": queue(copy => { copy.versions.php = "PHP 8.3.0 (cli)"; })
	};
	for(const [label, changed] of Object.entries(refused))
		assert.throws(() => assertPhpDispatchRun(changed), assert.AssertionError, label);
});

test("both reports keep their route, installation flags and the exact per-step counts", async () => {
	const ordinary = await text("php.json"), reviewed = await text("php-reviewed.json");
	assertPhpDispatchReport(ordinary, "ordinary-source");
	assertPhpDispatchReport(reviewed, "reviewed-ir");
	assert.throws(() => assertPhpDispatchReport(ordinary, "reviewed-ir"), assert.AssertionError, "route swapped");
	const report = change => {
		const copy = JSON.parse(ordinary);
		change(copy.reports[0], copy);
		return JSON.stringify(copy);
	};
	const refused = {
		"reviewed digest on ordinary": report(item => { item.reviewedSourceSha256 = "0".repeat(64); })
		, "not relocated": report(item => { item.relocatedInstallation = false; })
		, "source kept": report(item => { item.sourceRemovedBeforeInstallation = false; })
		, "online install": report(item => { item.offlineInstall = false; })
		, "fewer checks": report(item => { item.checks = 2027; })
		, "other profile": report(item => { item.profile = "php-wasm"; })
		, "other package": report(item => { item.packages[0].name = "lean-bridge-fixtures/other"; })
		, "extra report": report((item, copy) => { copy.reports.push(item); })
		, "extra archive": report((item, copy) => { copy.archives["archives/extra.zip"] = "0".repeat(64); })
		, "not reproducible": report((item, copy) => { copy.reproducible = false; })
		, "other interposer": report(item => { item.dispatch.interposer = "LD_AUDIT"; })
		, "interposer digest": report(item => { item.dispatch.interposerSha256 = "0".repeat(64); })
		, "probe digest": report(item => { item.dispatch.probeSha256 = "0".repeat(64); })
		, "column order": report(item => { item.dispatch.columns.reverse(); })
		, "route wording": report(item => { item.dispatch.routes = ["PHP FFI"]; })
		, "control wording": report(item => { item.dispatch.positiveControl = "valid calls increment"; })
		, "extra dispatch key": report(item => { item.dispatch.observedAt = "now"; })
		, "dropped step": report(item => { item.dispatch.observed.splice(3, 1); })
		, "reordered steps": report(item => { item.dispatch.observed.reverse(); })
		, "other status": report(item => { item.dispatch.observed[5][1] = "ok:7"; })
		, "changed count": report(item => { item.dispatch.observed[11][2][0] = 3; })
	};
	for(const [label, changed] of Object.entries(refused))
		assert.throws(() => assertPhpDispatchReport(changed, "ordinary-source"), assert.AssertionError, label);
});

test("the row recount refuses counts from a rejected call, a Fin 0 entry or a missed adapter", () => {
	assertPhpDispatchRows(structuredClone(phpDispatchRows));
	const rows = change => {
		const copy = structuredClone(phpDispatchRows);
		change(copy);
		return copy;
	};
	for(const [label, changed] of Object.entries({
		"rejected call counted": rows(copy => { for(const row of copy.slice(2)) row[2][0]++; })
		, "Fin 0 entered": rows(copy => { for(const row of copy.slice(3)) row[2][1]++; })
		, "adapter missed": rows(copy => { for(const row of copy.slice(5)) row[2][3]--; })
	}))
		assert.throws(() => assertPhpDispatchDeltas(changed), assert.AssertionError, label);
});

test("the producer test must keep its missing-counter refusal, preloaded run and exact rows", async () => {
	const source = await readFile(phpDispatchSnapshot("tests/php-fin.test.mjs"), "utf8");
	assertPhpDispatchTestSource(source);
	for(const [label, from, to] of [
		["refusal removed", "	await assert.rejects(runCopied(command, args, relocated), error => /exited with status 2/.test(error.message)\n", ""]
		, ["refusal stderr", "&& error.details.stderr === missingCounter);", "&& error.details.stderr !== \"\");"]
		, ["message changed", "is not resolvable in this PHP process", "is missing"]
		, ["no preload", "LD_PRELOAD: interposer", "LD_AUDIT: interposer"]
		, ["rows unchecked", "	assert.deepEqual(observed, phpFinDispatchExpected);", ""]
		, ["symbols unchecked", "assert.ok(defined.has(symbol), symbol);", "void symbol;"]
		, ["test renamed", `test("${phpDispatchTests.at(-1)}"`, "test(\"reviewed packages\""]
	])
		assert.throws(() => assertPhpDispatchTestSource(source.replace(from, to)), assert.AssertionError, label);
});

test("the dispatch receipt refuses overclaims, unknown paths before reading and changed source bytes", async () => {
	const record = await receipt();
	const mutations = {
		"other hosts": changed => { changed.scope.otherHosts = true; }
		, "hosted": changed => { changed.scope.hostedCi = true; }
		, "older evidence": changed => { changed.scope.olderEvidence = "superseded"; }
		, "remaining dropped": changed => { changed.remaining.pop(); }
		, "revision": changed => { changed.revision = "0".repeat(40); }
		, "artifact digest": changed => { changed.artifacts[0].sha256 = "0".repeat(64); }
		, "artifact provenance": changed => { changed.artifacts[0].originalPath = "build/other.json"; }
		, "artifact size": changed => { changed.artifacts[3].bytes++; }
		, "duplicate path": changed => { changed.artifacts.push(changed.artifacts[0]); }
	};
	for(const [label, mutate] of Object.entries(mutations))
	{
		const changed = structuredClone(record);
		mutate(changed);
		await assert.rejects(() => assertPhpDispatchArchive(changed, path => readFile(path), { currentSources: false }), assert.AssertionError, label);
	}
	for(const path of ["/etc/hostname", `${phpDispatchArchiveDirectory}/../../../package.json`, `${phpDispatchArchiveDirectory}/extra.txt`])
	{
		const changed = structuredClone(record);
		changed.artifacts[0].path = path;
		let reads = 0;
		await assert.rejects(() => assertPhpDispatchArchive(changed, async () => {
			reads++;
			return Buffer.alloc(0);
		}), assert.AssertionError, path);
		assert.equal(reads, 0, `${path} reached the reader`);
	}
	// A changed interposer byte is not the producer's, even with the archive intact.
	await assert.rejects(() => assertPhpDispatchArchive(record, async path => {
		const bytes = await readFile(path);
		return path === "tests/helpers/native-fin-count-interposer.mjs" ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
	}), error => error instanceof assert.AssertionError && error.message.startsWith("tests/helpers/native-fin-count-interposer.mjs"));
});

test("the dispatch archive writer keeps identical bytes and refuses any differing file or receipt", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-dispatch-archive-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const path = join(directory, "nested", "receipt.json");
	await writePhpDispatchArtifact(path, Buffer.from("one\n"));
	await writePhpDispatchArtifact(path, Buffer.from("one\n"));
	await assert.rejects(() => writePhpDispatchArtifact(path, Buffer.from("two\n")), assert.AssertionError);
	assert.equal(await readFile(path, "utf8"), "one\n");
});
