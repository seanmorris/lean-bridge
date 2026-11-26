/** @file Qualify the Kotlin fault behavior on two original Maven installations. */
import assert from "node:assert/strict";
import {copyFile, mkdir, mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import test from "node:test";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {inspectJvmTask, installJvmTasks} from "./jvm-tasks-acceptance.mjs";
import {exerciseKotlinFault} from "./kotlin-callback-fault.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";

const env = {...process.env, LEAN_NUM_THREADS: "1"};
const replay = env.LEAN_BRIDGE_KOTLIN_CALLBACK_FAULT_REPLAY;
test("Kotlin fatal callbacks retire independently installed peer packages even after cancellation", {skip: !replay, timeout: 1_800_000}, async () => {
	const root = resolve(replay), out = resolve(env.LEAN_BRIDGE_KOTLIN_CALLBACK_FAULT_OUT ?? "build/kotlin-callback-fault");
	const work = await mkdtemp(join(tmpdir(), "kotlin-callback-fault-"));
	try
	{
		await copyFile(resolve("tests/fixtures/jvm-tasks/verify.py"), join(work, "verify.py"));
		await copyFile(resolve("tests/fixtures/jvm-sync-io/settings.xml"), join(work, "settings.xml"));
		const history = JSON.parse(await readFile(resolve("docs/evidence/jvm-retained-tasks-20261123.json")));
		const packages = {};
		for(const route of ["peer", "ordinary", "reviewed"])
		{
			const pkg = await inspectJvmTask(root, route, work, true);
			assert.deepEqual(pkg.proof, history.installed.packages.find(p => p.route === route));
			packages[route] = pkg;
		}
		for(const route of ["ordinary", "reviewed"])
		{
			const source = packages[route], peer = packages.peer, proj = join(work, route);
			const {classpath} = await installJvmTasks(proj, work, [source, peer]);
			const kotlin = await exerciseKotlinFault({proj, classpath, env});
			await mkdir(out, {recursive: true});
			await saveLakeFile(out, route + ".json", canonicalJson({kotlin, source: source.proof, peer: peer.proof}));
		}
	}
	finally
{ await rm(work, {recursive: true, force: true}); }
});
