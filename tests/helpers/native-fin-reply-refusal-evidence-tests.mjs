/**
 * Keep the archived fresh Lean host-reply refusal run (VO #1453) tied to its producer, its one passing
 * selected test and the seven cases that test enforces.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertRefusalArchive, assertRefusalRun, assertRefusalTestSource, refusalArchiveDirectory, refusalArchivePaths, refusalCases, refusalSnapshot, refusalTest, writeRefusalArtifact } from "./native-fin-reply-refusal-evidence.mjs";

const receipt = async () => {
	const bytes = await readFile(`${refusalArchiveDirectory}/receipt.json`);
	assert.equal(sha256(bytes), "2204295eb2191947fe68f1d0519ae79575115e833aefb79f4b0fff6ddbbb39d5");
	return JSON.parse(bytes);
};
const text = name => readFile(`${refusalArchiveDirectory}/${name}`, "utf8");

test("the fresh Lean refusal archive authenticates its run, producer test and current extractor sources", async () => {
	const record = await receipt(), observed = [];
	await assertRefusalArchive(record, path => {
		observed.push(path);
		return readFile(path);
	});
	assert.deepEqual([...new Set(observed)].sort(), [...refusalArchivePaths, "tests/native-fin-callbacks.test.mjs", "src/analyze/NativeExports.lean", "src/analyze/native-metadata.mjs"].sort());
	assert.deepEqual(record.scope.cases, ["reply", "replyTile", "replyOk", "replySubtype", "replyInterval", "replyConfigured", "replies"]);
	assert.deepEqual([record.scope.installed, record.scope.sanitizers, record.scope.hostedCi], [false, false, false]);
});

test("the refusal run records refuse a skipped, failed, renumbered, unplanned or nonzero run and another producer", async () => {
	const files = { queue: await text("queue.json"), tap: await text("run.tap"), end: await text("end.txt") };
	assertRefusalRun(files);
	const queue = change => {
		const copy = JSON.parse(files.queue);
		change(copy);
		return { ...files, queue: JSON.stringify(copy) };
	};
	const refused = {
		"skipped": { ...files, tap: files.tap.replace(/^(ok 1 - .*)$/mu, "$1 # SKIP").replace("# pass 1", "# pass 0").replace("# skipped 0", "# skipped 1") }
		, "failed": { ...files, tap: files.tap.replace("ok 1 -", "not ok 1 -").replace("# pass 1", "# pass 0").replace("# fail 0", "# fail 1") }
		, "renumbered": { ...files, tap: files.tap.replace("ok 1 -", "ok 2 -") }
		, "second plan": { ...files, tap: files.tap.replace("1..1\n", "1..1\n1..1\n") }
		, "other test": { ...files, tap: files.tap.replace(/^ok 1 - .*$/mu, "ok 1 - fresh Lean admits every safe direction and compiles the generated adapter") }
		, "nonzero exit": { ...files, end: files.end.replace("exit=0", "exit=1") }
		, "floor breached": { ...files, end: files.end.replace(/minFree=\d+M/u, "minFree=900M") }
		, "other revision": queue(copy => { copy.revision = "0".repeat(40); })
		, "other selection": queue(copy => { copy.selection = "tests/native-fin-callbacks.test.mjs"; })
		, "gate off": queue(copy => { copy.environment.LEAN_BRIDGE_NATIVE_FIN_CALLBACK_LEAN_TEST = "0"; })
		, "changed test source": queue(copy => { copy.sources["tests/native-fin-callbacks.test.mjs"] = "0".repeat(64); })
		, "changed extractor": queue(copy => { copy.sources["src/analyze/NativeExports.lean"] = "0".repeat(64); })
		, "other Lean": queue(copy => { copy.versions.lean = "Lean (version 4.31.0)"; })
	};
	for(const [label, changed] of Object.entries(refused))
		assert.throws(() => assertRefusalRun(changed), assert.AssertionError, label);
});

test("the producer test must keep every case and the assertions tying each refusal to extraction", async () => {
	const source = await readFile(refusalSnapshot, "utf8");
	assertRefusalTestSource(source);
	for(const [name, line] of Object.entries(refusalCases))
		assert.throws(() => assertRefusalTestSource(source.replace(line, "")), assert.AssertionError, `missing ${name}`);
	for(const [label, from, to] of [
		["declaration check", "\"declaration\":\"FinCallbacks.${name}\"", "\"export\":\"FinCallbacks.${name}\""]
		, ["reason check", "unsupported-native-type", "unsupported-type"]
		, ["model exclusion", "assert.doesNotMatch(error.message, /a host callback result needs a Fin-free failure value/u, name);", ""]
		, ["configured constructor", "constructor: \"FinCallbacks.mkInterval\"", "constructor: \"FinCallbacks.other\""]
		, ["skipped test", `test("${refusalTest}", { skip: !lean,`, `test("${refusalTest}", { skip: true,`]
	])
		assert.throws(() => assertRefusalTestSource(source.replace(from, to)), assert.AssertionError, label);
});

test("the refusal receipt refuses overclaims, unknown paths before reading and changed source bytes", async () => {
	const record = await receipt();
	const mutations = {
		"installed": changed => { changed.scope.installed = true; }
		, "sanitizers": changed => { changed.scope.sanitizers = true; }
		, "hosted": changed => { changed.scope.hostedCi = true; }
		, "case dropped": changed => { changed.scope.cases.pop(); }
		, "revision": changed => { changed.revision = "0".repeat(40); }
		, "artifact digest": changed => { changed.artifacts[0].sha256 = "0".repeat(64); }
		, "artifact provenance": changed => { changed.artifacts[0].originalPath = "build/other.tap"; }
	};
	for(const [label, mutate] of Object.entries(mutations))
	{
		const changed = structuredClone(record);
		mutate(changed);
		await assert.rejects(() => assertRefusalArchive(changed, path => readFile(path)), assert.AssertionError, label);
	}
	for(const path of ["/etc/hostname", `${refusalArchiveDirectory}/../../../package.json`, `${refusalArchiveDirectory}/extra.txt`])
	{
		const changed = structuredClone(record);
		changed.artifacts[0].path = path;
		let reads = 0;
		await assert.rejects(() => assertRefusalArchive(changed, async () => {
			reads++;
			return Buffer.alloc(0);
		}), assert.AssertionError, path);
		assert.equal(reads, 0, `${path} reached the reader`);
	}
	// A changed extractor byte is not the producer's, even with the archive itself intact.
	await assert.rejects(() => assertRefusalArchive(record, async path => {
		const bytes = await readFile(path);
		return path === "src/analyze/NativeExports.lean" ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
	}), assert.AssertionError);
});

test("the refusal archive rejects unrelated current test edits despite its intact executed snapshot", async () => {
	const record = await receipt();
	await assert.rejects(() => assertRefusalArchive(record, async path => {
		const bytes = await readFile(path);
		return path === "tests/native-fin-callbacks.test.mjs" ? Buffer.concat([bytes, Buffer.from("\n// unrelated edit\n")]) : bytes;
	}), { name: "AssertionError", message: /tests\/native-fin-callbacks\.test\.mjs/u });
});

test("the refusal archive writer keeps identical bytes and refuses any differing file or receipt", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-refusal-archive-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const path = join(directory, "nested", "receipt.json");
	await writeRefusalArtifact(path, Buffer.from("one\n"));
	await writeRefusalArtifact(path, Buffer.from("one\n"));
	await assert.rejects(() => writeRefusalArtifact(path, Buffer.from("two\n")), assert.AssertionError);
	assert.equal(await readFile(path, "utf8"), "one\n");
});
