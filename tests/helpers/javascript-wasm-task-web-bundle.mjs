/** @file Assemble a deployment from an offline install; attest both module graphs and their unchanged Wasm binaries. */
import assert from "node:assert/strict";
import {copyFile,readFile,readdir} from "node:fs/promises";
import {join,resolve,sep} from "node:path";
import {build} from "vite";
import {sha256} from "../../src/capsule/node.mjs";

export const base="/tasks/nested/";
const runtime="@lean-bridge/runtime";
/**
 * Assemble and audit a browser deployment without resolving dependencies from the author tree.
 *
 * @param consumer - Fresh offline install.
 * @param spec - The installed fixtures and expected package names.
 */
export const bundleTaskWeb = async (consumer, spec) => {
	const fixtures = resolve("tests/fixtures"), web = join(fixtures, "javascript-wasm-task-web");
	for(const file of ["index.html", "page.mjs", "worker.mjs"]) await copyFile(join(web, file), join(consumer, file));
	await copyFile(join(web, spec.family + "-parent.mjs"), join(consumer, "parent.mjs"));
	const calls = join(fixtures, spec.fixture, "calls.mjs");
	if(spec.family === "resource")
	{
		await copyFile(calls, join(consumer, "original-calls.mjs"));
		await copyFile(join(web, "resource-calls.mjs"), join(consumer, "calls.mjs"));
	}
	else await copyFile(calls, join(consumer, "calls.mjs"));

	const installed = join(consumer, "node_modules") + sep, page = new Set(), worker = new Set();
	const audit = seen => {
		const load = id => {
			if(!id.startsWith("\0") && id.includes(sep + "node_modules" + sep))
			{
				assert.ok(id.startsWith(installed), "Dependency outside offline installation: " + id);
				seen.add(id.slice(installed.length));
			}
			return null;
		};
		return { name: "audit-offline-task-dependencies", load };
	};
	await build({ root: consumer, base, configFile: false, envDir: false
		, publicDir: false, logLevel: "error", plugins: [audit(page)]
		, worker: { format: "es", plugins: () => [audit(worker)] }
		, build: { target: "esnext" } });
	const names = [...spec.names, runtime];
	const expectedPage = spec.family !== "callback" ? names : [spec.names[0], runtime];
	for(const [graph, dependencies] of [[page, expectedPage], [worker, names]])
		for(const name of dependencies) assert.ok([...graph].some(id => id.startsWith(name + "/")), "Missing installed " + name);
	const dist = join(consumer, "dist"), assets = join(dist, "assets");
	const files = (await readdir(assets)).filter(file => file.endsWith(".wasm"));
	const expected = await Promise.all(names.map(name => readFile(join(installed, name,
		name === runtime ? "internal/task.wasm" : "internal/component.wasm")).then(sha256)));
	const actual = await Promise.all(files.map(file => readFile(join(assets, file)).then(sha256)));
	assert.deepEqual(actual.sort(), [...new Set(expected)].sort(), "Deployment must ship the unchanged installed binaries");
	return dist;
};

/** Run the complete deployed page and independent module worker. */
export const replayTaskWeb = async () => {
	let last = "loading deployment", timer;
	try
	{
		const deadline = new Promise((_, reject) => {
			timer = setTimeout(() => reject(new Error("Deployment stalled: " + last)), 85000);
		});
		return await Promise.race([globalThis.runInstalledWorker(s => { last = s; }), deadline]);
	}
	finally
	{ clearTimeout(timer); }
};
