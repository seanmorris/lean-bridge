/** @file Link the published module graph in isolation without running a Lean heap. */
import assert from "node:assert/strict";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import test from "node:test";
import {pathToFileURL} from "node:url";
import {assembleJavaScriptTaskRuntime} from "../src/release/javascript-wasm-task-packages.mjs";

test("the packed worker runtime imports using only files delivered to downstream consumers", async t => {
	const root = await mkdtemp(join(tmpdir(), "lb-task-imports-"));
	t.after(() => rm(root, {recursive: true, force: true}));
	const stub = Buffer.from('export default function () { throw new Error("unexpected heap creation"); }');
	const {files} = await assembleJavaScriptTaskRuntime(stub, Buffer.alloc(0), "javascript-wasm-threaded-task-v1");
	for(const [name, bytes] of files)
{
		const dest = join(root, name);
		await mkdir(dirname(dest), {recursive: true});
		await writeFile(dest, bytes);
}
	const client = await import(pathToFileURL(join(root, "index.mjs")).href);
	assert.equal(typeof client.loadTaskComponent, "function");
	assert.equal(typeof client.closeTaskRuntime, "function");
});
