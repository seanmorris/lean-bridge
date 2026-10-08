/**
 * Keep the archived installed WIT/WASI Fin dispatch-counter run (VO #1425) tied to its producer sources,
 * its nine passing tests, both installed routes and the exact per-step counts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import "./helpers/wit-dispatch-integration-source-history-tests.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import { assertWitDispatchArchive, assertWitDispatchDeltas, assertWitDispatchReport, assertWitDispatchRows, assertWitDispatchRun, assertWitDispatchTestSource, witDispatchArchiveDirectory, witDispatchArchivePaths, witDispatchRows, witDispatchSnapshot, witDispatchSources, witDispatchTests, writeWitDispatchArtifact } from "./helpers/wit-fin-dispatch-evidence.mjs";

const receipt = async () => {
	const bytes = await readFile(`${witDispatchArchiveDirectory}/receipt.json`);
	assert.equal(sha256(bytes), "07cb48bcd702790614854fe0592a550810dbd643088fd2b0ab2b27c5d61ebb0e");
	return JSON.parse(bytes);
};
const text = name => readFile(`${witDispatchArchiveDirectory}/${name}`, "utf8");

test("the WIT dispatch archive authenticates its run, reports and producer sources from its own paths", async () => {
	const record = await receipt(), observed = [];
	await assertWitDispatchArchive(record, path => {
		observed.push(path);
		return readFile(path);
	}, { currentSources: false });
	assert.deepEqual([...new Set(observed)].sort(), [...witDispatchArchivePaths].sort());
	assert.deepEqual([record.scope.otherHosts, record.scope.hostedCi], [false, false]);
});

test("the current WIT producer sources reach their exact dispatch-run digests", async () => {
	const observed = [];
	await assertWitDispatchArchive(await receipt(), path => {
		observed.push(path);
		return readFile(path);
	});
	assert.deepEqual([...new Set(observed)].sort(), [...witDispatchArchivePaths, ...Object.keys(witDispatchSources)].sort());
});

test("the WIT dispatch run records refuse a skipped, failed, renumbered, unplanned or nonzero run and another producer", async () => {
	const files = { queue: await text("queue.json"), tap: await text("run.tap"), end: await text("end.txt") };
	assertWitDispatchRun(files);
	const queue = change => {
		const copy = JSON.parse(files.queue);
		change(copy);
		return { ...files, queue: JSON.stringify(copy) };
	};
	const gated = witDispatchTests.at(-1), counted = "# per-step source and adapter counts in the relocated WIT host process\n";
	const refused = {
		"skipped": { ...files, tap: files.tap.replace(`ok 9 - ${gated}`, `ok 9 - ${gated} # SKIP`).replace("# pass 9", "# pass 8").replace("# skipped 0", "# skipped 1") }
		, "failed": { ...files, tap: files.tap.replace("ok 8 -", "not ok 8 -").replace("# pass 9", "# pass 8").replace("# fail 0", "# fail 1") }
		, "renumbered": { ...files, tap: files.tap.replace("ok 9 -", "ok 10 -") }
		, "dropped": { ...files, tap: files.tap.replace(`ok 9 - ${gated}\n`, "").replace("1..9", "1..8") }
		, "second plan": { ...files, tap: files.tap.replace("1..9\n", "1..9\n1..9\n") }
		, "other test": { ...files, tap: files.tap.replace(`ok 9 - ${gated}`, "ok 9 - WIT/WASI host packages are checked Fin consumers beside the other C-adapter hosts") }
		, "one route uncounted": { ...files, tap: files.tap.replace(counted, "") }
		, "nonzero exit": { ...files, end: files.end.replace("exit=0", "exit=1") }
		, "floor breached": { ...files, end: files.end.replace(/minFree=\d+M/u, "minFree=900M") }
		, "other revision": queue(copy => { copy.revision = "0".repeat(40); })
		, "other selection": queue(copy => { copy.selection = "tests/wit-fin.test.mjs"; })
		, "gate off": queue(copy => { copy.environment.LEAN_BRIDGE_WIT_FIN_TEST = "0"; })
		, "other glibc floor": queue(copy => { copy.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR = "2.38"; })
		, "other Wasmtime C API": queue(copy => { copy.environment.LEAN_BRIDGE_WASMTIME_C_API = "/usr/local"; })
		, "other CPU": queue(copy => { copy.cpu = "taskset -c 2"; })
		, "changed test source": queue(copy => { copy.sources["tests/wit-fin.test.mjs"] = "0".repeat(64); })
		, "changed dispatch helper": queue(copy => { copy.sources["tests/helpers/native-fin-dispatch.mjs"] = "0".repeat(64); })
		, "dropped source": queue(copy => { delete copy.sources["src/build/native-wit-projection.mjs"]; })
		, "other Wasmtime": queue(copy => { copy.versions.wasmtime = "43.0.0 (header)"; })
		, "other wasm-tools": queue(copy => { copy.versions.wasmTools = "wasm-tools 1.246.0"; })
	};
	for(const [label, changed] of Object.entries(refused))
		assert.throws(() => assertWitDispatchRun(changed), assert.AssertionError, label);
});

test("both WIT reports keep their route, isolation flags and the exact per-step counts", async () => {
	const ordinary = await text("wit.json"), reviewed = await text("wit-reviewed.json");
	assertWitDispatchReport(ordinary, "ordinary-source");
	assertWitDispatchReport(reviewed, "reviewed-ir");
	assert.throws(() => assertWitDispatchReport(ordinary, "reviewed-ir"), assert.AssertionError, "route swapped");
	const report = change => {
		const copy = JSON.parse(ordinary);
		change(copy.reports[0], copy);
		return JSON.stringify(copy);
	};
	const refused = {
		"reviewed digest on ordinary": report(item => { item.reviewedSourceSha256 = "0".repeat(64); })
		, "source kept": report(item => { item.sourceRemovedBeforeInstallation = false; })
		, "online install": report(item => { item.wit.offline = false; })
		, "compiler in execution": report(item => { item.wit.compilerFreeExecution = false; })
		, "runtime overrides": report(item => { item.wit.runtimeOverridesDisabled = false; })
		, "single execution": report(item => { item.wit.repeatExecutions = 1; })
		, "fewer checks": report(item => { item.observation.checks = 2026; })
		, "fewer rejections": report(item => { item.observation.rejections = 1012; })
		, "other Wasmtime": report(item => { item.observation.hostVersion = "43.0.0"; })
		, "other profile": report(item => { item.profile = "c"; })
		, "other package": report(item => { item.packages[0].name = "native-fin"; })
		, "archive mismatch": report(item => { item.wit.archiveSha256 = "0".repeat(64); })
		, "adapter library mismatch": report(item => { item.sharedNativeLibraries["libnativefin.so"] = "0".repeat(64); })
		, "extra report": report((item, copy) => { copy.reports.push(item); })
		, "extra archive": report((item, copy) => { copy.archives["archives/extra.zip"] = "0".repeat(64); })
		, "not reproducible": report((item, copy) => { copy.reproducible = false; })
		, "other interposer": report(item => { item.dispatch.interposer = "LD_AUDIT"; })
		, "interposer digest": report(item => { item.dispatch.interposerSha256 = "0".repeat(64); })
		, "PHP interposer digest": report(item => { item.dispatch.interposerSha256 = "a6584dcb1a98f5d517680e475ad039e255d1ff15a1bfdb4e0ab49414651da710"; })
		, "probe digest": report(item => { item.dispatch.probeSha256 = "0".repeat(64); })
		, "PHP adapter columns": report(item => { item.dispatch.columns.splice(3, 3, "lb_b703515a10173a97c2e27e46", "lb_1d7e0c72a4d6e1cde32466e4", "lb_9afacce322a81504ba9eb75b"); })
		, "column order": report(item => { item.dispatch.columns.reverse(); })
		, "route wording": report(item => { item.dispatch.routes = ["Wasmtime"]; })
		, "control wording": report(item => { item.dispatch.positiveControl = "valid calls increment"; })
		, "extra dispatch key": report(item => { item.dispatch.observedAt = "now"; })
		, "dropped step": report(item => { item.dispatch.observed.splice(3, 1); })
		, "reordered steps": report(item => { item.dispatch.observed.reverse(); })
		, "other status": report(item => { item.dispatch.observed[5][1] = "ok:7"; })
		, "PHP status spelling": report(item => { item.dispatch.observed[1][1] = "rejected:1:arg0<10"; })
		, "changed count": report(item => { item.dispatch.observed[11][2][0] = 3; })
	};
	for(const [label, changed] of Object.entries(refused))
		assert.throws(() => assertWitDispatchReport(changed, "ordinary-source"), assert.AssertionError, label);
});

test("the WIT row recount refuses counts from a rejected call, a Fin 0 entry or a missed adapter", () => {
	assertWitDispatchRows(structuredClone(witDispatchRows));
	// The pinned rows share counter arrays; give every row its own so a mutant changes only the rows it names.
	const rows = change => {
		const copy = witDispatchRows.map(([step, status, counts]) => [step, status, [...counts]]);
		change(copy);
		assert.deepEqual(copy[0], ["start", "ok", [0, 0, 0, 0, 0, 0]], "start is unchanged");
		return copy;
	};
	for(const [step, changed] of [
		["invalid-mirror-huge", rows(copy => { for(const row of copy.slice(2)) row[2][0]++; })]
		, ["invalid-impossible-zero", rows(copy => { for(const row of copy.slice(3)) row[2][1]++; })]
		, ["valid-mirror", rows(copy => { for(const row of copy.slice(5)) row[2][3]--; })]
	])
		assert.throws(() => assertWitDispatchDeltas(changed), error => error instanceof assert.AssertionError && error.message.split("\n")[0] === step, step);
});

test("the WIT producer test must keep its refusals, model symbol check, preloaded run and exact rows", async () => {
	const source = await readFile(witDispatchSnapshot("tests/wit-fin.test.mjs"), "utf8");
	const helperTests = await readFile(witDispatchSnapshot("tests/helpers/native-fin-dispatch-tests.mjs"), "utf8");
	assertWitDispatchTestSource(source, helperTests);
	for(const [label, from, to] of [
		["refusal removed", "	await assert.rejects(runCopied(command, [deployment], probeRoot), error => /exited with status 2/.test(error.message)\n		&& error.details.stdout === \"\" && error.details.stderr === missingCounter);\n", ""]
		, ["message changed", "is not resolvable in this WIT host process", "is missing"]
		, ["no preload", "LD_PRELOAD: interposer", "LD_AUDIT: interposer"]
		, ["rows unchecked", "	assert.deepEqual(observed, witFinDispatchExpected);", ""]
		, ["symbols unchecked", "for(const symbol of columns) assert.ok(defined.has(symbol), symbol);", "void columns;"]
		, ["foreign host admitted", "is not loaded from the deployment\\\\n\", stderr); return 3;", "is not loaded from the deployment\\\\n\", stderr);"]
		, ["component unchecked", "		assert.equal(model.component.id, \"nativefin@1.0.0\");", ""]
		, ["helper tests not imported", "import \"./helpers/native-fin-dispatch-tests.mjs\";", ""]
		, ["test renamed", `test("${witDispatchTests.at(-1)}"`, "test(\"reviewed packages\""]
	])
		assert.throws(() => assertWitDispatchTestSource(source.replace(from, to), helperTests), assert.AssertionError, label);
	assert.throws(() => assertWitDispatchTestSource(source, helperTests.replace(`test("${witDispatchTests[0]}"`, "test(\"interposer\"")), assert.AssertionError, "helper test renamed");
});

test("the WIT dispatch receipt refuses overclaims, unknown paths before reading and changed source bytes", async () => {
	const record = await receipt();
	const mutations = {
		"other hosts": changed => { changed.scope.otherHosts = true; }
		, "hosted": changed => { changed.scope.hostedCi = true; }
		, "older evidence": changed => { changed.scope.olderEvidence = "superseded"; }
		, "wider environment": changed => { changed.scope.environment = "any Wasmtime and glibc"; }
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
		await assert.rejects(() => assertWitDispatchArchive(changed, path => readFile(path), { currentSources: false }), assert.AssertionError, label);
	}
	for(const path of ["/etc/hostname", `${witDispatchArchiveDirectory}/../../../package.json`, `${witDispatchArchiveDirectory}/extra.txt`])
	{
		const changed = structuredClone(record);
		changed.artifacts[0].path = path;
		let reads = 0;
		await assert.rejects(() => assertWitDispatchArchive(changed, async () => {
			reads++;
			return Buffer.alloc(0);
		}), assert.AssertionError, path);
		assert.equal(reads, 0, `${path} reached the reader`);
	}
	// A changed host-renderer byte is not the producer's, even with the archive intact.
	await assert.rejects(() => assertWitDispatchArchive(record, async path => {
		const bytes = await readFile(path);
		return path === "src/backends/wit/copied-host.mjs" ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
	}), error => error instanceof assert.AssertionError && error.message.startsWith("src/backends/wit/copied-host.mjs"));
});

test("the WIT dispatch archive writer keeps identical bytes and refuses any differing file or receipt", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-wit-dispatch-archive-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const path = join(directory, "nested", "receipt.json");
	await writeWitDispatchArtifact(path, Buffer.from("one\n"));
	await writeWitDispatchArtifact(path, Buffer.from("one\n"));
	await assert.rejects(() => writeWitDispatchArtifact(path, Buffer.from("two\n")), assert.AssertionError);
	assert.equal(await readFile(path, "utf8"), "one\n");
});
