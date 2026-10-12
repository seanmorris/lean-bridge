/**
 * Recheck original JVM exit observations using repository-relative archived files.
 * Recorded producer paths describe the runs; they are not required on CI hosts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertExtractedFinContainerGdbRun, finContainerGdbExtractedWaitScript } from "./fin-container-dispatch-gdb-extracted.mjs";
import { finContainerEntryExpected, readFinContainerEntry } from "./fin-container-entry-dispatch.mjs";
import { assertFinContainerEntryCiReport } from "./fin-container-entry-ci.mjs";

const root = "docs/evidence/jvm-container-entry-exit-20261012";
const digest = "246f5db0604d5ef7eb18cf5f08be0a396a76b8d4dfb0d34b6f109056f2d23d24";
const read = path => readFile(join(root, path));
const verify = async reader => {
	const bytes = await reader("index.json");
	assert.equal(sha256(bytes), digest);
	const index = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.kind, "jvm-container-entry-exit-observation-v1");
	assert.equal(index.files.length, 48);
	for(const file of index.files)
	{
		const original = await reader(file.path);
		assert.equal(original.length, file.bytes, file.path);
		assert.equal(sha256(original), file.sha256, file.path);
	}
	return index;
};

test("the JVM entry exit archive verifies original Java/Kotlin replays and both installed routes", async () => {
	const index = await verify(read);
	const names = (await readdir(root, { recursive: true, withFileTypes: true }))
		.filter(item => item.isFile()).map(item => join(item.parentPath, item.name).slice(root.length + 1));
	assert.deepEqual(names.sort(), ["index.json", ...index.files.map(file => file.path)].sort());
	const json = async path => JSON.parse(await read(path));
	const job = await json("hosted-job.json");
	assert.equal(job.id, 114716526056); assert.equal(job.conclusion, "failure");
	assert.equal(job.head_sha, "d2d819205189ceaaf80d7e2cc80901111c778de2");
	assert.match((await read("hosted-failure.log")).toString(), /No unwaited-for children left/u);
	const start = await json("runtime/start.json"), end = await json("runtime/end.json");
	assert.equal(start.scriptSha256, sha256(finContainerGdbExtractedWaitScript));
	assert.equal(end.passed, true);
	assert.deepEqual(end.results.map(item => [item.profile, item.accepted, item.missingExitRefused, item.rows]), [
		["java", 0, 72, 24], ["kotlin", 0, 72, 24]
	]);
	for(const profile of ["java", "kotlin"])
	{
		const prefix = `runtime/${profile}/`;
		assert.equal((await read(prefix + "gdb/original-observer.py")).toString(), finContainerGdbExtractedWaitScript);
		const config = await json(prefix + "gdb/run-0.json");
		const accepted = await json(prefix + "accepted.json");
		assert.equal(accepted.parent, config.parent); assert.equal(accepted.nonce, config.nonce);
		assert.equal(accepted.stderr, "");
		assert.equal(accepted.stdout, (await read(prefix + "gdb/run-0.stdout")).toString());
		const rows = readFinContainerEntry(accepted.stdout, finContainerEntryExpected);
		const observer = { identity: config.identity
			, configSha256: config.configSha256
			, listings: await json("runtime/listings.json")
			, definerIndices: config.identity.definers.map(name => config.identity.libraries.indexOf(name)) };
		const checked = await assertExtractedFinContainerGdbRun(observer, { ...accepted
			, record: join(root, prefix, "gdb/run-0.record")
			, armed: join(root, prefix, "gdb/run-0.armed.json") }, rows);
		assert.deepEqual(checked.jvmExit, end.results.find(item => item.profile === profile).exit);
		const refused = await json(prefix + "refused.json");
		assert.equal(refused.code, 72);
		const mutant = finContainerGdbExtractedWaitScript.replace("    jvm_exit = jvm_observe_exit()"
			, '    gdb.set_convenience_variable("_exitcode", None)\n    jvm_exit = jvm_observe_exit()');
		assert.equal((await read(prefix + "gdb/fin-container-extracted.gdb.py")).toString(), mutant);
		assert.equal(refused.scriptSha256, sha256(mutant));
		assert.equal(refused.actualScriptSha256, sha256(mutant));
		readFinContainerEntry(refused.stdout, finContainerEntryExpected);
		assert.equal(Object.hasOwn(await json(prefix + "gdb/run-1.armed.json"), "jvmExit"), false);
		assert.match(refused.output, /the inferior did not exit normally/u);
	}
	for(const [name, route] of [["ordinary", "ordinary-source"], ["reviewed", "reviewed-ir"]])
		assertFinContainerEntryCiReport(await json(`installed/${name}.json`), ["java", "kotlin"], route);
	const producer = await json("installed/runner.json"), checker = await json("installed/report-check.json");
	assert.equal(producer.records[0].code, 0); assert.equal(producer.records[0].signal, null);
	assert.equal(sha256(await read("installed/run.tap")), producer.records[0].sha256);
	assert.match((await read("installed/run.tap")).toString(), /# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	// Preserve the local runner's wrong profile argument and its separate corrected checker result.
	assert.equal(producer.records[1].args[1], "java-kotlin"); assert.equal(producer.records[1].code, 1);
	assert.equal(checker.args[1], "java,kotlin"); assert.equal(checker.code, 0); assert.equal(checker.signal, null);
	for(const [offset, name] of ["ordinary", "reviewed"].entries())
		assert.equal(checker.inputs[offset].sha256, sha256(await read(`installed/${name}.json`)));
});

test("the JVM entry exit archive refuses every missing or changed original", async () => {
	const index = await verify(read);
	const originals = new Map(await Promise.all(["index.json", ...index.files.map(file => file.path)]
		.map(async path => [path, await read(path)])));
	for(const [target, bytes] of originals)
	{
		await assert.rejects(verify(async path => {
			if(path === target) throw new Error("missing original");
			return originals.get(path);
		}), /missing original/u);
		await assert.rejects(verify(async path => path === target ? Buffer.concat([bytes, Buffer.from("changed")]) : originals.get(path)));
	}
});
