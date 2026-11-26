/**
 * Independently verify, install offline, relocate and run both projections of original Maven task releases.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { installMavenTasks } from "./jvm-maven-installed.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" }, capture = env.LEAN_BRIDGE_JVM_TASK_CAPTURE, replay = env.LEAN_BRIDGE_JVM_TASK_REPLAY;
const fixture = resolve("tests/fixtures/jvm-tasks"), json = async p => JSON.parse(await readFile(p, "utf8"));
const files = ["Installed.java", "Observe.java", "ExitPending.java", "Installed.kt", "Bad.kt", "Example.java", "Example.kt", "verify.py", "settings.xml"];
const digest = async f => { const h = createHash("sha256"); for await(const b of createReadStream(f)) h.update(b); return h.digest("hex"); };
/**
 * Authenticate an original Maven JAR, its POM, inner inventory and compiler evidence.
 *
 * @param root - Evidence directory containing the original handoffs.
 * @param route - Ordinary source, reviewed source or the independently built peer.
 * @param work - Consumer directory with the independent ZIP/POM verifier.
 * @param retained - Verify a retained-callback profile rather than the scalar task fixtures.
 */
const inspect = async (root, route, work, retained = false) => {
	const dir = join(root, route, "handoff"), { result, receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
	await assertJsonSchema("package-set-receipt", receipt); assert.equal(receipt.packages.length, 1); assert.equal(receipt.profiles.length, 1);
	const p = receipt.packages[0], ir = await json(join(dir, "binding-ir.json")), evidence = await json(join(dir, "host-export-evidence.json"));
	const name = "com.acme:" + (retained ? route === "peer" ? "relay" : "feedback" : route === "peer" ? "alarm" : "timers");
	assert.equal(p.profile, "native-jvm-task-v1"); assert.equal(p.profile, receipt.profiles[0].id);
	assert.equal(p.name, name); assert.equal(p.target, "maven"); assert.equal(p.role, "component"); assert.deepEqual(p.requires, []);
	assert.equal(p.version, "1.0.0"); assert.equal(p.runtimeDelivery, "embedded");
	assert.equal(p.runtimeIdentity, receipt.profiles[0].runtimeIdentity); assert.equal(receipt.profiles[0].bindingIrSha256, hashBindingIr(ir));
	assert.equal(evidence.sourceTreeSha256, receipt.source.treeSha256); assert.equal(Boolean(evidence.reviewedSourceSha256), route === "reviewed");
	const selection = evidence.selection;
	if(retained)
	{
		assert.equal(selection.jvmTaskCallbacks, true); assert.deepEqual(selection.nativeEffects, []);
		assert.equal(selection.asyncIterators.length, 0);
		assert.deepEqual(selection.taskExports, ir.declarations.filter(d => d.resultMode === "promise").map(d => d.source.declaration));
		const contracts = ir.types.filter(x => x.kind === "callback"); assert.ok(contracts.length >= (route === "peer" ? 1 : 19));
		for(const x of contracts)
		{
			assert.deepEqual(x.callable.failure.errors, ["error:JvmCallbackException"]);
			assert.equal(x.source.extensions["lean-bridge.dev/callback-scheduler"], "jvm-virtual-thread");
		}
	}
	else
	{
		assert.deepEqual(selection.nativeEffects, ["filesystem"]);
		assert.equal(selection.taskExports.length, route === "peer" ? 1 : 8);
		assert.equal(selection.asyncIterators.length, route === "peer" ? 0 : 2);
		assert.deepEqual(selection.taskIOErrors ?? [], route === "peer" ? [] : ["Timers.finalIO"]);
	}
	const artifacts = p.artifacts.toSorted((a,b) => a.path.localeCompare(b.path));
	assert.equal(artifacts.length, 2);
	const paths = artifacts.map(a => join(dir, a.path));
	const detail = JSON.parse(await run(env.LEAN_BRIDGE_PYTHON ?? "python3", ["-I", "-B", "verify.py", ...paths], work, env));
	assert.equal(detail.runtimeIdentity, p.runtimeIdentity); assert.equal(detail.bindingIrSha256, hashBindingIr(ir));
	for(const a of artifacts)
	{
		const f = join(dir, "packages/maven/repository/com/acme", name.split(":")[1], p.version, basename(a.path));
		assert.equal(await digest(f), a.sha256); assert.equal((await readFile(f + ".sha256", "utf8")).trim(), a.sha256);
	}
	const proof = { route, name, artifacts, detail
		, receiptSha256: result.receiptSha256
		, sourceTreeSha256: receipt.source.treeSha256
		, reviewedSourceSha256: evidence.reviewedSourceSha256 };
	return { paths, proof };
};
const install = (proj, work, packages, tasks = true) => installMavenTasks(proj, work, packages, env, tasks);
const mixed = env.LEAN_BRIDGE_JVM_MIXED_OUTPUT;
export { inspect as inspectJvmTask, install as installJvmTasks };
test("independently installed synchronous and task Maven profiles share one native owner", { skip: !mixed, timeout: 600_000 }, async t => {
	const work = await mkdtemp(join(tmpdir(), "mixed-jvm-task-")); t.after(() => rm(work, { recursive: true, force: true }));
	const sync = resolve(env.LEAN_BRIDGE_JVM_MIXED_SYNC), root = resolve(env.LEAN_BRIDGE_JVM_MIXED_TASK);
	const original = await json("docs/evidence/jvm-sync-io-20261123.json"), old = original.installed.packages.find(p => p.route === "ordinary");
	const sources = {};
	for(const f of ["Mixed.java", "Observe.java", "verify.py", "settings.xml"])
	{
		const b = await readFile(f === "settings.xml" ? resolve("tests/fixtures/jvm-sync-io/settings.xml") : join(fixture, f));
		sources[f] = sha256(b); await writeFile(join(work, f), b, { flag: "wx" });
	}
	const pkg = await inspect(root, "ordinary", work), dir = join(sync, "ordinary/handoff");
	const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
	assert.equal(result.receiptSha256, old.receiptSha256); assert.equal(receipt.packages[0].profile, "native-jvm-io-v1");
	assert.deepEqual(old.info.owner, pkg.proof.detail.owner); assert.equal(old.info.runtimeIdentity, pkg.proof.detail.runtimeIdentity);
	const a = { name: old.name, artifacts: [old.jar, old.pom] }, p = { proof: a, version: receipt.packages[0].version, paths: a.artifacts.map(x => join(dir, x.path)) };
	const proj = join(work, "client"), classes = join(work, "classes"); await mkdir(classes);
	const { resolved, classpath } = await install(proj, work, [pkg, p]);
	await run(env.LEAN_BRIDGE_JAVAC, ["--release", "22", "-proc:none", "-cp", classpath, "-d", classes, join(work, "Observe.java"), join(work, "Mixed.java")], proj, env);
	const rows = {};
	for(const order of ["sync-first", "task-first"])
	{
		const output = await run(env.LEAN_BRIDGE_JAVA, ["-XX:ActiveProcessorCount=1", "-Djava.io.tmpdir=" + proj, "--enable-native-access=ALL-UNNAMED", "-cp", classes + delimiter + classpath, "Mixed", order], proj, { PATH: "/unavailable", LEAN_NUM_THREADS: "1" });
		assert.match(output, /^one native owner and runtime .*zero identities$/u); rows[order] = output;
	}
	const report = { schemaVersion: 1, sources, resolved, rows
		, taskReceiptSha256: pkg.proof.receiptSha256
		, syncReceiptSha256: old.receiptSha256 };
	if(env.LEAN_BRIDGE_JVM_MIXED_EXPECTED) assert.deepEqual(report, (await json(env.LEAN_BRIDGE_JVM_MIXED_EXPECTED)).mixed);
	await writeFile(resolve(mixed), canonicalJson(report), { flag: "wx" });
});
test("installed task JARs deliver actual Lean workers through Java futures/Flow and Kotlin coroutines/Flow", { skip: !capture && !replay, timeout: 3_600_000 }, async t => {
	assert.ok(!(capture && replay));
	const root = resolve(capture ?? replay), work = await mkdtemp(join(tmpdir(), "installed-jvm-tasks-"));
	t.after(() => rm(work, { recursive: true, force: true }));
	const clients = {};
	for(const f of files)
	{
		const original = replay ? join(root, f) : f === "settings.xml" ? resolve("tests/fixtures/jvm-sync-io/settings.xml") : join(fixture, f);
		const b = await readFile(original); clients[f] = sha256(b); await writeFile(join(work, f), b, { flag: "wx" });
	}
	const packages = new Map();
	for(const r of ["ordinary", "peer", "reviewed"]) packages.set(r, await inspect(root, r, work));
	const parked = Boolean(capture) || env.LEAN_BRIDGE_JVM_PARKED_PULL === "1";
	const pin = replay && parked ? await json(env.LEAN_BRIDGE_JVM_TASK_EXPECTED) : null;
	if(pin)
	{
		assert.equal(sha256(await readFile(join(root, "acceptance.json"))), pin.acceptanceSha256);
		assert.deepEqual(clients, pin.installed.clients);
		assert.deepEqual([...packages.values()].map(p => p.proof), pin.installed.packages);
	}
	const java = env.LEAN_BRIDGE_JAVA ?? "java", javac = env.LEAN_BRIDGE_JAVAC ?? "javac", sdk = env.LEAN_BRIDGE_KOTLIN_HOME;
	const peer = packages.get("peer"), rows = [];
	for(const route of ["ordinary", "reviewed"])
	{
		const component = packages.get(route), proj = join(work, route), classes = join(proj, "classes");
		assert.deepEqual(component.proof.detail.owner, peer.proof.detail.owner);
		const { resolved, classpath } = await install(proj, work, [component, peer]); await mkdir(classes);
		if(pin) assert.deepEqual(resolved, pin.installed.rows.find(r => r.route === route).classpath);
		const javaSources = files.filter(f => f.endsWith(".java")).map(f => join(work, f));
		if(parked) javaSources.push(join(fixture, "Parked.java"));
		await run(javac, ["--release", "22", "-proc:none", "-encoding", "UTF-8", "-cp", classpath, "-d", classes, ...javaSources], proj, env);
		const cp = classes + delimiter + classpath;
		const compiler = ["-XX:ActiveProcessorCount=1", "-Xmx512m", "-cp"
			, join(sdk, "lib/*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler"
			, "-kotlin-home", sdk, "-jdk-home", env.JAVA_HOME, "-no-stdlib"
			, "-no-reflect", "-Werror", "-jvm-target", "22", "-classpath", cp
			, "-d", classes];
		await run(java, [...compiler, join(work, "Installed.kt"), join(work, "Example.kt"), ...parked ? [join(fixture, "ParkedFlow.kt")] : []], proj, env);
		await assert.rejects(run(java, [...compiler, join(work, "Bad.kt")], proj, env), e => {
			assert.match(e.message, /Bad\.kt:5:\d+: error:.*suspend/iu); assert.match(e.message, /Bad\.kt:6:\d+: error:.*mismatch/iu); return true;
		});
		await assert.rejects(access(join(classes, "BadKt.class")), { code: "ENOENT" });
		const isolated = { PATH: "/unavailable", LANG: "C.UTF-8", TMPDIR: proj, LEAN_NUM_THREADS: "1" };
		const launch = ["-XX:ActiveProcessorCount=1", "-Xmx192m", "-Djava.io.tmpdir=" + proj, "--enable-native-access=ALL-UNNAMED", "-cp", cp], observed = {};
		for(const main of ["Example", "ExampleKt"])
		{
			const line = await run(java, [...launch, main], proj, isolated); assert.equal(line, "42\n2"); observed[main] = line;
		}
		for(const main of ["Installed", "InstalledKt"]) for(const order of ["timers-first", "peer-first"])
		{
			const output = (await run(java, [...launch, main, order], proj, isolated, 150_000)).split("\n");
			assert.equal(output.length, 2);
			const [line, counters] = output, stats = JSON.parse(counters), j = main === "Installed";
			assert.match(line, j ? /^Java: .*descriptors at baseline$/u : /^Kotlin: .*zero native identities$/u);
			assert.deepEqual(stats, { runtimeInits: 1, componentInits: 2, attached: 2, live: 0, ...j ? { fdDelta: 0, concurrentTasks: 32, readinessThreads: 1 } : {} });
			observed[main + "/" + order] = { line, stats };
		}
		observed.exit = await run(java, [...launch, "ExitPending"], proj, isolated, 45_000);
		if(parked)
		{
			const results = [];
			for(const [main, file, language, outcome] of [
				["Parked", "Parked.java", "Java", "blocked cancel silent, invalid demand signals once, close before late worker, zero live owners and descriptor delta"]
				, ["ParkedFlowKt", "ParkedFlow.kt", "Kotlin", "collecting job cancelled once, close before late worker, no emissions, zero live owners and descriptor delta"]
			]) for(const order of ["timers-first", "peer-first"])
			{
				const output = await run(java, [...launch, main, order], proj, isolated, 150_000);
				assert.equal(output, language + " " + order + ": " + outcome);
				results.push({language, order, output, consumerSha256: sha256(await readFile(join(fixture, file)))});
			}
			const out = resolve(env.LEAN_BRIDGE_JVM_PARKED_PULL_OUTPUT ?? "build/jvm-parked-pull");
			await mkdir(out, {recursive: true});
			await writeFile(join(out, route + ".json"), canonicalJson({route, results, observerSha256: clients["Observe.java"], component: component.proof, peer: peer.proof}));
		}
		assert.equal(observed.exit, "normal JVM exit with a non-cooperative pending Lean task");
		rows.push({ route, classpath: resolved, observed });
		t.diagnostic(route + ": offline package graph, both compilers, documentation and both load orders executed");
	}
	const report = { schemaVersion: 1, clients, packages: [...packages.values()].map(x => x.proof), rows };
	if(capture)
	{
		for(const f of files) await copyFile(join(work, f), join(root, f), constants.COPYFILE_EXCL);
		await writeFile(join(root, "acceptance.json"), canonicalJson(report), { flag: "wx" });
	}
	else
	{
		const original = await readFile(join(root, "acceptance.json")), pin = await json(env.LEAN_BRIDGE_JVM_TASK_EXPECTED);
		assert.deepEqual(report, JSON.parse(original)); assert.deepEqual(report, pin.installed); assert.equal(sha256(original), pin.acceptanceSha256);
	}
});
