/** @file Compile two independent ordinary Rust-host Lean components into an isolated native prefix. */
import assert from "node:assert/strict";
import { copyFile, link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { elaboratedComponent } from "../../src/analyze/semantic-model.mjs";
import { compileCHostComponent } from "../../src/build/c-host-component.mjs";
import { buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { openHostProjectSource } from "../../src/build/host-project-source.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { prepareNativeHostFixture } from "./native-host-import-check.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

/**
 * Stage independently compiled components and record the exact shared libraries for replay.
 *
 * @param root - Private build directory.
 * @param install - New destination for compiled components and their verified model.
 * @param env - Pinned local compiler paths.
 */
export const buildRustHostPair = async (root, install, env) => {
	const leanPrefix = env.LEAN_BRIDGE_LEAN_PREFIX, runtimeRoot = join(root, "sdk");
	await buildNativeSharedRuntime({ leanPrefix, outputRoot: runtimeRoot });
	await mkdir(install);
	const libs = {}, packages = [];
	for(const name of ["workshop", "peer"])
	{
		const app = join(root, name + "-build"), project = join(root, name + "-source");
		await mkdir(app); await prepareNativeHostFixture(project, "rust");
		await copyFile("LICENSE", join(project, "LICENSE"));
		if(name === "peer")
		{
			const lake = join(project, "lakefile.toml"), cfg = join(project, "lean-bridge.exports.json");
			const conf = JSON.parse(await readFile(cfg, "utf8")); conf.targets.cargo.name = name;
			await writeFile(cfg, canonicalJson(conf)); await writeFile(lake, (await readFile(lake, "utf8")).replace('"workshop"', '"peer"'));
		}
		const inventory = await inspectLeanProject(project);
		const source = await openHostProjectSource({ project, inventory, component: elaboratedComponent(inventory.project), targets: ["cargo"], leanPrefix });
		try
		{
			const ir = source.projectContract.ir;
			const b = await compileCHostComponent({ ...source, target: "cargo", name, version: "1.0.0", ir, app, runtimeRoot, leanPrefix, environment: env });
			await source.verify();
			for(const [lib, hash] of Object.entries(b.binaries))
			{
				if(libs[lib]) assert.equal(libs[lib], hash);
				else
				{ await copyFile(join(app, lib), join(install, lib)); libs[lib] = hash; }
			}
			const symbols = (await run("nm", ["-D", "--defined-only", b.component], install, env)).split("\n").map(line => line.trim().split(/\s+/u).at(-1)).sort();
			assert.deepEqual(symbols, [b.prefix + "_call", b.prefix + "_clear"]);
			packages.push({name,ir,model: b.model,entries: b.entries,prefix: b.prefix,component: b.component,domain: b.domain,domainId: b.domainId});
		} finally
		{ await source.dispose(); }
		await rm(app, {recursive: true}); await rm(project, {recursive: true});
	}
	assert.equal(packages[0].domain, packages[1].domain);
	assert.notEqual(packages[0].component, packages[1].component);
	for(const lib of ["liblean_bridge_native.so", "libleanshared.so"])
	{
		const path = join(runtimeRoot, "lib", lib);
		await link(path, join(install, lib)).catch(e => { if(e.code !== "EXDEV") throw e; return copyFile(path, join(install, lib)); });
		libs[lib] = sha256(await readFile(path));
	}
	await writeFile(join(install, "pair.json"), canonicalJson({libs,packages}));
	return {libs, packages};
};
