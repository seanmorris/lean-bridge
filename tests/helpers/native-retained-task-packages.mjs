/**
 * Build two differently named callback packages for one native consumer language.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";

/**
 * Build from ordinary Lean first, then independently re-elaborate against the reviewed API.
 *
 * @param options - Clean producer directory and original release destination.
 */
export const buildNativeCallbackPackages = async options => {
	const { root, release, target } = options;
	assert.ok(["c", "cpp"].includes(target));
	const fixtures = resolve("tests/fixtures"), common = join(fixtures, "python-retained-tasks"), cpp = join(fixtures, "cpp-retained-tasks");
	let prior;
	for(const route of ["ordinary", "reviewed"])
	{
		const dest = join(release, route), src = join(root, "producer-" + route), handoff = join(dest, "handoff");
		await mkdir(dest); await mkdir(src);
		const fixturesForTarget = [[common, ["Retained.lean", "lean-toolchain"]]
			, [cpp, ["CppTasks.lean"]]
			, [join(fixtures, target + "-retained-tasks"), target === "c" ? ["lakefile.toml", "Parking.lean"] : ["lakefile.toml"]]];
		for(const [dir, files] of fixturesForTarget)
			for(const f of files) await copyFile(join(dir, f), join(src, f));
		const config = JSON.parse(await readFile(join(common, "lean-bridge.exports.json")));
		config.modules.push("CppTasks");
		const extra = ["CppTasks.factory", "CppTasks.localFactory"];
		for(const key of ["exports", "taskExports", "taskIOErrors"]) config[key].push(...extra);
		for(const key of ["exports", "taskExports"]) config[key].push("CppTasks.park");
		if(target === "c")
		{
			config.modules.push("Parking");
			for(const key of ["exports", "taskExports"]) config[key].push("Parking.untilCanceled");
		}
		config.targets = { [target]: { name: target + (prior ? "-peer" : "-retained"), version: "1.0.0" } };
		if(prior)
		{ delete config.exports; await writeFile(join(src, "api.binding-ir.json"), canonicalJson(prior)); }
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config));
		await cp(src, join(dest, "source"), { recursive: true, errorOnExist: true });
		await buildCanonicalProject({ projectRoot: src, outputRoot: handoff, targets: [target], environment: { ...process.env, LEAN_NUM_THREADS: "1" } })
			.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
		const api = JSON.parse(await readFile(join(handoff, "binding-ir.json")));
		if(prior) assert.deepEqual(api, prior); else prior = api;
		await rm(src, { recursive: true });
	}
};
