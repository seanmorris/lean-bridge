/** @file Replay a parked pull against the four original CPython Timers installs from VO 1223. */
import assert from "node:assert/strict";
import {copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename, join, resolve} from "node:path";
import test from "node:test";
import {canonicalJson, sha256} from "../../src/capsule/node.mjs";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

const original = process.env.LEAN_BRIDGE_PYTHON_PARKED_PULL_ORIGINAL;
const pins = {
	cp311: ["ef536078635c1dceacef39d141461ba4ccc159309bf109d7eebf38d5236d49fc", "af11b474f343e84d15b3644bb7d9417a6b9da558d24d27b3a7badab15a5dedf0"]
	, cp312: ["0fa93a817325327f369573736ad5de79bfb59dd9ef9a96a4c036b0e5606c2cce", "e07418ce3c41fa5bef3055c0a79dd282bff8093ca150e1e161fb6dfdf7d9819b"]
};
const runtimeHash = "a3a2cf70d7b200c731c9f9a128a524a5efd5797da48bf342bf4e9e8ac3267a00";
const irHash = "368dc2780d4d5c35c2ad66c11f89b7ab5996b9c2ec27bd80d0f123b8528c8c23";
test("installed Timers wheels cancel an already parked pull before caller cleanup", {skip: !original, timeout: 900_000}, async t => {
	const env = process.env, python = env.LEAN_BRIDGE_PYTHON ?? "python3";
	const work = await mkdtemp(join(tmpdir(), "parked-python-pull-")); t.after(() => rm(work, {recursive: true, force: true}));
	const tag = await run(python, ["-I", "-c", "import sys;print('cp%d%d'%sys.version_info[:2])"], work, env);
	assert.ok(Object.hasOwn(pins, tag));
	const client = join(work, "cancel_pull.py"), observer = join(work, "observe.py");
	await copyFile(resolve("tests/fixtures/python-lean-tasks/cancel_pull.py"), client);
	const loopClient=join(work,"loop_ownership.py");await copyFile(resolve("tests/fixtures/python-lean-tasks/loop_ownership.py"),loopClient);
	await copyFile(resolve("tests/fixtures/python-task-resources/observe.py"), observer);
	const out = resolve(env.LEAN_BRIDGE_PYTHON_PARKED_PULL_OUTPUT ?? "build/python-parked-pull"); await mkdir(out, {recursive: true});
	for(const [i, route] of ["ordinary", "reviewed"].entries())
	{
		const src = join(resolve(original), "tasks", tag+"-"+tag+"-linux_x86_64", route), dir = join(work, route);
		const raw = await readFile(join(src, "package-set-receipt.json")); assert.equal(sha256(raw), pins[tag][i]);
		const receipt = JSON.parse(raw), api = JSON.parse(await readFile(join(src, "binding-ir.json")));
		assert.equal(hashBindingIr(api), irHash); assert.equal(receipt.profiles[0].bindingIrSha256, irHash);
		const accepted = JSON.parse(await readFile(join(src, "acceptance.json")));
		assert.equal(accepted.cliArchiveSha256, "f009eac42b971cfdc44b0576dbeb5fcf9ba44e4ed86668dc64aa86e62c6574cc");
		assert.equal(accepted.route, route); assert.match(accepted.stdout, /compiled streams: demand/u);
		const feed = join(dir, "archives"), target = join(dir, "target"), moved = join(dir, "relocated");
		await mkdir(feed, {recursive: true}); await writeFile(join(dir, "package-set-receipt.json"), raw);
		await copyFile(join(src, "package-set-receipt.json.sha256"), join(dir, "package-set-receipt.json.sha256"));
		const wheels = [];
		for(const p of receipt.packages)
		{
			assert.equal(p.artifacts.length, 1); const [a] = p.artifacts, name = basename(a.path);
			assert.equal(a.path, "archives/"+name);
			if(p.role === "runtime")
{ assert.equal(p.name, "lean-bridge-host-runtime"); assert.equal(a.sha256, runtimeHash); }
			else
{ assert.equal(p.role, "component"); assert.equal(p.name, "lean-timers"); assert.ok(name.includes(tag)); }
			const file = join(feed, name); await copyFile(join(p.role === "runtime" ? join(resolve(original), "wheels") : src, name), file); wheels.push(file);
		}
		const {result} = await readVerifiedPackageSetReceipt({receiptPath: join(dir, "package-set-receipt.json")});
		assert.equal(result.receiptSha256, pins[tag][i]);
		await run(python, ["-I", "-m", "pip", "--isolated", "--disable-pip-version-check", "install", "--no-index", "--no-cache-dir", "--no-compile", "--only-binary", ":all:", "--target", target, "--find-links", feed, "lean-timers==1.0.0"], work, env);
		const verified = JSON.parse(await run(python, ["-I", "-B", resolve("tests/fixtures/python-task-resources/verify_install.py"), target, ...wheels], work, env));
		assert.deepEqual(Object.keys(verified).sort(), wheels.map(f => basename(f)).sort());
		await rename(target, moved); await rm(feed, {recursive: true});
		const observed = await run(python, ["-S", "-B", "-W", "error", client], work, {PATH: "/unavailable", PYTHONPATH: moved, PYTHONNOUSERSITE: "1", LEAN_NUM_THREADS: "1"});
		assert.equal(observed, "parked cooperative and noncooperative pulls: one cancellation, finalized before aclose, no late item, zero owner and selector delta");
		const report = {tag, route, packageSetSha256: result.receiptSha256
			, bindingIrSha256: irHash
			, archives: receipt.packages.map(p => p.artifacts[0])
			, verified, observed, clientSha256: sha256(await readFile(client))
			, observerSha256: sha256(await readFile(observer))};
		await writeFile(join(out, tag+"-"+route+".json"), canonicalJson(report));
		const loops=JSON.parse(await run(python,["-S","-B","-W","error",loopClient],work,{PATH: "/unavailable",PYTHONPATH: moved,PYTHONNOUSERSITE: "1",LEAN_NUM_THREADS: "1"}));
		assert.deepEqual(loops.foreignLoop,{rejected: ["anext","aclose"],settled: [41],finalizers: 1,owners: 0});
		assert.deepEqual(loops.refusedReader,{registrationAttempts: 1,finalizersBeforeClose: 1,fresh: 73,owners: 0});
		await writeFile(join(out,tag+"-"+route+".loops.json"),canonicalJson({...report,observed: loops,clientSha256: sha256(await readFile(loopClient))}));
		await rm(dir,{recursive: true}); // Never hold two relocated native runtimes at once.
	}
});
