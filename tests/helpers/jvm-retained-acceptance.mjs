/**
 * Verify and replay original offline-installed Java/Kotlin retained callback packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { inspectJvmTask, installJvmTasks } from "./jvm-tasks-acceptance.mjs";
import {exerciseKotlinFault} from "./kotlin-callback-fault.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" };
const capture = env.LEAN_BRIDGE_JVM_CALLBACK_CAPTURE, replay = env.LEAN_BRIDGE_JVM_CALLBACK_REPLAY;
const fixture = resolve("tests/fixtures/jvm-retained"), upstream = resolve("tests/fixtures/jvm-tasks");
const paths = { "Observe.java": join(upstream, "Observe.java")
	, "verify.py": join(upstream, "verify.py")
	, "settings.xml": resolve("tests/fixtures/jvm-sync-io/settings.xml") };
const files = ["Installed.java", "Installed.kt", "Bad.kt", "Example.java", "Example.kt", "Formatter.java", "Trap.java", ...Object.keys(paths)];
const json = async p => JSON.parse(await readFile(p, "utf8"));
const mixed = env.LEAN_BRIDGE_JVM_CALLBACK_MIXED;
test("new JVM callbacks reenter the original installed synchronous and scalar task releases", { skip: !mixed, timeout: 600_000 }, async t => {
	const work = await mkdtemp(join(tmpdir(), "mixed-jvm-retained-")); t.after(() => rm(work, { recursive: true, force: true }));
	const sources = {}, rows = {};
	for(const f of ["Mixed.java", "Observe.java", "verify.py", "settings.xml"])
	{
		const b = await readFile(paths[f] ?? join(fixture, f)); sources[f] = sha256(b); await writeFile(join(work, f), b, { flag: "wx" });
	}
	const root = resolve(env.LEAN_BRIDGE_JVM_CALLBACK_ORIGINAL);
	const current = await inspectJvmTask(root, "ordinary", work, true);
	const task = await inspectJvmTask(resolve(env.LEAN_BRIDGE_JVM_MIXED_TASK), "ordinary", work);
	const taskPin = await json("docs/evidence/jvm-tasks-20261123.json");
	assert.deepEqual(task.proof, taskPin.installed.packages.find(p => p.route === "ordinary"));
	const syncPin = await json("docs/evidence/jvm-sync-io-20261123.json"), old = syncPin.installed.packages.find(p => p.route === "ordinary");
	const dir = join(resolve(env.LEAN_BRIDGE_JVM_MIXED_SYNC), "ordinary/handoff");
	const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
	assert.equal(result.receiptSha256, old.receiptSha256); assert.deepEqual(receipt.packages[0].artifacts.toSorted((a,b) => a.path.localeCompare(b.path)), [old.jar, old.pom]);
	assert.equal(receipt.packages[0].profile, "native-jvm-io-v1"); assert.equal(receipt.packages[0].name, old.name);
	assert.deepEqual(old.info.owner, current.proof.detail.owner); assert.deepEqual(task.proof.detail.owner, current.proof.detail.owner);
	const proof = { name: old.name, artifacts: [old.jar, old.pom] }, sync = { proof, version: receipt.packages[0].version, paths: proof.artifacts.map(a => join(dir, a.path)) };
	const proj = join(work, "client"), classes = join(work, "classes"); await mkdir(classes);
	const { classpath, resolved } = await installJvmTasks(proj, work, [current, task, sync]);
	await run(env.LEAN_BRIDGE_JAVAC, ["--release", "22", "-proc:none", "-cp", classpath, "-d", classes, join(work, "Observe.java"), join(work, "Mixed.java")], proj, env);
	for(const order of ["sync-first", "task-first", "callback-first"])
	{
		const args = ["-XX:ActiveProcessorCount=1", "-Xmx192m"
			, "-Djava.io.tmpdir=" + proj, "--enable-native-access=ALL-UNNAMED"
			, "-cp", classes + delimiter + classpath, "Mixed", order];
		const output = await run(env.LEAN_BRIDGE_JAVA, args, proj, { PATH: "/unavailable", LEAN_NUM_THREADS: "1" });
		assert.match(output, /original synchronous and task releases: 1 runtime, 3 components, 0 live identities$/u); rows[order] = output;
	}
	const report = { schemaVersion: 1, sources, resolved, rows, syncReceiptSha256: old.receiptSha256, taskReceiptSha256: task.proof.receiptSha256, callbackReceiptSha256: current.proof.receiptSha256 };
	if(env.LEAN_BRIDGE_JVM_CALLBACK_EXPECTED) assert.deepEqual(report, (await json(env.LEAN_BRIDGE_JVM_CALLBACK_EXPECTED)).mixed);
	await writeFile(resolve(mixed), canonicalJson(report), { flag: "wx" });
});
test("replays real retained Lean callbacks through offline installed Java and Kotlin packages", { skip: !capture && !replay, timeout: 3_600_000 }, async t => {
	assert.ok(!(capture && replay));
	const root = resolve(capture ?? replay), work = await mkdtemp(join(tmpdir(), "installed-jvm-retained-"));
	t.after(() => rm(work, { recursive: true, force: true }));
	const clients = {}, rows = [], packages = new Map();
	for(const f of files)
	{
		const b = await readFile(replay ? join(root, f) : paths[f] ?? join(fixture, f));
		clients[f] = sha256(b); await writeFile(join(work, f), b, { flag: "wx" });
	}
	for(const name of ["ordinary", "peer", "reviewed"]) packages.set(name, await inspectJvmTask(root, name, work, true));
	const java = env.LEAN_BRIDGE_JAVA, javac = env.LEAN_BRIDGE_JAVAC, sdk = env.LEAN_BRIDGE_KOTLIN_HOME;
	for(const route of ["ordinary", "reviewed"])
	{
		const component = packages.get(route), peer = packages.get("peer"), proj = join(work, route), classes = join(proj, "classes");
		assert.deepEqual(component.proof.detail.owner, peer.proof.detail.owner);
		const { classpath, resolved } = await installJvmTasks(proj, work, [component, peer]); await mkdir(classes);
		if(capture)
		{
			const kotlin = await exerciseKotlinFault({proj, classpath, env});
			await writeFile(join(root, route + ".kotlin-fault.json"), canonicalJson({kotlin, source: component.proof, peer: peer.proof}), {flag: "wx"});
		}
		await run(javac, ["--release", "22", "-proc:none", "-encoding", "UTF-8", "-cp", classpath, "-d", classes, ...files.filter(f => f.endsWith(".java")).map(f => join(work, f))], proj, env);
		const cp = classes + delimiter + classpath;
		const cc = ["-XX:ActiveProcessorCount=1", "-Xmx512m", "-cp"
			, join(sdk, "lib/*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler"
			, "-kotlin-home", sdk, "-jdk-home", env.JAVA_HOME
			, "-no-stdlib", "-no-reflect", "-Werror", "-jvm-target", "22"
			, "-classpath", cp, "-d", classes];
		await run(java, [...cc, join(work, "Installed.kt"), join(work, "Example.kt")], proj, env);
		await assert.rejects(run(java, [...cc, join(work, "Bad.kt")], proj, env), e => {
			assert.match(e.message, /Bad\.kt:4:\d+: error:.*suspend/iu); assert.match(e.message, /Bad\.kt:7:\d+: error:.*mismatch/iu); return true;
		});
		await assert.rejects(access(join(classes, "BadKt.class")), { code: "ENOENT" });
		const launch = ["-XX:ActiveProcessorCount=1", "-Xmx192m", "-Djava.io.tmpdir=" + proj, "--enable-native-access=ALL-UNNAMED", "-cp", cp];
		const isolated = { PATH: "/unavailable", LANG: "C.UTF-8", TMPDIR: proj, LEAN_NUM_THREADS: "1" }, observed = {};
		for(const main of ["Example", "ExampleKt"])
			assert.equal(observed[main] = await run(java, [...launch, main], proj, isolated), "42");
		assert.equal(observed.Formatter = await run(java, [...launch, "Formatter"], proj, isolated), "join, get and timed get preserve the same exception without formatting it again");
		assert.equal(observed.Trap = await run(java, [...launch, "Trap"], proj, isolated), "a fatal callback after cancellation retires both components without resettling the cancelled future");
		for(const main of ["Installed", "InstalledKt"]) for(const order of ["feedback-first", "peer-first"])
		{
			const line = await run(java, [...launch, main, order], proj, isolated, 180_000);
			assert.match(line, /^(Java: 19 carrier conversions|Kotlin: suspend callbacks).*2 components, 0 live identities, descriptor delta 0$/u);
			observed[main + "/" + order] = line;
		}
		rows.push({ route, resolved, observed }); t.diagnostic(route + ": both clients, both load orders, sample calls and negative typing passed");
	}
	const report = { schemaVersion: 1, clients, packages: [...packages.values()].map(x => x.proof), rows };
	if(capture)
	{
		for(const f of files) await copyFile(join(work, f), join(root, f), constants.COPYFILE_EXCL);
		await writeFile(join(root, "acceptance.json"), canonicalJson(report), { flag: "wx" });
	}
	else
	{
		const original = await readFile(join(root, "acceptance.json")), pin = await json(env.LEAN_BRIDGE_JVM_CALLBACK_EXPECTED);
		assert.deepEqual(report, JSON.parse(original)); assert.deepEqual(report, pin.installed); assert.equal(sha256(original), pin.acceptanceSha256);
	}
});
