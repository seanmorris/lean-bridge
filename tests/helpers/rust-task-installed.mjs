/**
 * Build ordinary and reviewed Cargo releases or replay both from their original archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { runInstalledRustTasks } from "./rust-task-install.mjs";

const env = process.env, replay = env.LEAN_BRIDGE_RUST_TASK_REPLAY;
test("offline installed Cargo releases deliver real Lean tasks, streams and nominal leases", {
	skip: env.LEAN_BRIDGE_RUST_TASK_TEST !== "1" && !replay, timeout: 3_600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "rust-tasks-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const kept = resolve(replay ?? env.LEAN_BRIDGE_RUST_TASK_EVIDENCE ?? join(root, "releases"));
	const fixture = resolve("tests/fixtures");
	let api;
	if(!replay)
	{
		await mkdir(kept, { recursive: true });
		await mkdir(join(kept, "client"));
		for(const f of ["consumer.rs", "pulse_checks.rs"]) await copyFile(join(fixture, "rust-task-lab", f), join(kept, "client", f));
		for(const route of ["ordinary", "reviewed"])
		{
			const dest = join(kept, route), src = join(root, route), handoff = join(dest, "handoff");
			await mkdir(dest); await mkdir(src);
			for(const [base, paths] of [["rust-task-lab", ["Lab.lean", "lakefile.toml", "lean-bridge.exports.json"]]
				, ["resource-tasks", ["Shared.lean", "Depot.lean", "lean-toolchain"]]
				, ["exact-task-integers", ["Wide.lean"]], ["c-lean-tasks", ["Pulse.lean"]]])
				for(const path of paths) await copyFile(join(fixture, base, path), join(src, path));
			if(api)
			{
				const config = JSON.parse(await readFile(join(src, "lean-bridge.exports.json")));
				delete config.exports; config.targets.cargo.name = "task-lab-peer";
				await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config));
				await writeFile(join(src, "lab.binding-ir.json"), canonicalJson(api));
			}
			await cp(src, join(dest, "source"), { recursive: true, errorOnExist: true });
			await buildCanonicalProject({ projectRoot: src, outputRoot: handoff, targets: ["cargo"], environment: { ...env, LEAN_NUM_THREADS: "1" } })
				.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
			const fresh = JSON.parse(await readFile(join(handoff, "binding-ir.json")));
			if(api) assert.deepEqual(fresh, api); else api = fresh;
			await rm(src, { recursive: true });
		}
	}
	const result = await runInstalledRustTasks({ root, kept, environment: env });
	if(replay) assert.deepEqual(result, JSON.parse(await readFile(join(kept, "acceptance.json"))));
	else await writeFile(join(kept, "acceptance.json"), canonicalJson(result), { flag: "wx" });
	t.diagnostic(result.output);
});
