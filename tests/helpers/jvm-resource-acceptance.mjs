/**
 * Verify original Maven bytes and exercise nominal resources across two installed JVM packages.
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
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { installJvmTasks } from "./jvm-tasks-acceptance.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { verifyLeaseModel } from "./native-lease-project.mjs";
import { assertJsonSchema } from "./json-schema.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" }, capture = env.LEAN_BRIDGE_JVM_RESOURCE_CAPTURE, replay = env.LEAN_BRIDGE_JVM_RESOURCE_REPLAY;
const json = async f => JSON.parse(await readFile(f, "utf8"));
const digest = async f => { const h = createHash("sha256"); for await(const b of createReadStream(f)) h.update(b); return h.digest("hex"); };
const fixture = resolve("tests/fixtures/jvm-sync-resources");
const paths = { "Observe.java": resolve("tests/fixtures/jvm-tasks/Observe.java")
	, "settings.xml": resolve("tests/fixtures/jvm-sync-io/settings.xml") };
const clients = ["Installed.java", "Installed.kt", "Bad.java", "Bad.kt", "Example.java", "Example.kt", "RejectLedger.java", "verify.py", ...Object.keys(paths)];
/**
 * Verify an original resource release, including its compiler evidence and native dependency graph.
 *
 * @param root - Directory of original handoffs.
 * @param route - Ordinary, reviewed, compatible peer or lookalike producer.
 * @param work - Directory containing the independent archive verifier.
 * @param tasks - Verify the task-capable Depot profile instead of a synchronous package.
 */
export const inspectJvmResource = async (root, route, work, tasks = false) => {
	const dir = join(root, route, "handoff");
	const { result, receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
	await assertJsonSchema("package-set-receipt", receipt);
	const [p] = receipt.packages, artifacts = p.artifacts;
	const ir = await json(join(dir, "binding-ir.json")), evidence = await json(join(dir, "host-export-evidence.json"));
	const name = "com.acme:" + (tasks ? "depot" : route === "peer" ? "counter" : route === "lookalike" ? "other-desk" : "desk");
	assert.equal(receipt.packages.length, 1); assert.equal(p.name, name); assert.equal(p.profile, tasks ? "native-jvm-task-v1" : "native-jvm-io-v1");
	assert.deepEqual(artifacts.map(a => a.path), ["jar", "pom"].map(e => "archives/" + name.split(":")[1] + "-1.0.0." + e));
	assert.deepEqual(evidence.selection.leanResources, ["Shared.Badge", "Shared.Ticket"]);
	assert.deepEqual(evidence.selection.nativeEffects, ["filesystem"]); assert.equal(evidence.selection.synchronousIO === true, !tasks);
	if(tasks)
	{
		const s = evidence.selection;
		assert.deepEqual(s.taskExports, ["Depot.checked", "Depot.pending", "Exchange.revisit"]);
		assert.deepEqual(s.asyncIterators, [{ open: "Depot.tickets", next: "Depot.next", close: "Depot.close" }]);
		assert.deepEqual(s.taskIOErrors, ["Exchange.revisit"]);
		const cb = ir.types.find(t => t.kind === "callback"); assert.deepEqual(cb.callable.failure.errors, ["error:JvmCallbackException"]);
	}
	assert.equal(evidence.sourceTreeSha256, receipt.source.treeSha256); assert.equal(Boolean(evidence.reviewedSourceSha256), route === "reviewed");
	if(route !== "peer") verifyLeaseModel(ir, evidence, tasks);
	const paths = artifacts.map(a => join(dir, a.path));
	const detail = JSON.parse(await run(env.LEAN_BRIDGE_PYTHON ?? "python3", ["-I", "-B", "verify.py", ...paths, dir, ...tasks ? ["--task"] : []], work, env));
	assert.equal(detail.runtime, p.runtimeIdentity); assert.equal(detail.ir, hashBindingIr(ir));
	for(const a of artifacts)
	{
		const rep = join(dir, "packages/maven/repository/com/acme", name.split(":")[1], p.version, basename(a.path));
		assert.equal(await digest(rep), a.sha256); assert.equal((await readFile(rep + ".sha256", "utf8")).trim(), a.sha256);
	}
	const proof = { name, route, artifacts, detail
		, receiptSha256: result.receiptSha256
		, sourceTreeSha256: receipt.source.treeSha256
		, reviewedSourceSha256: evidence.reviewedSourceSha256 };
	return { paths, proof };
};
test("replay cross-package resource ownership through real offline-installed Java and Kotlin APIs", { skip: !capture && !replay, timeout: 3_600_000 }, async t => {
	assert.ok(!(capture && replay)); const root = resolve(capture ?? replay), work = await mkdtemp(join(tmpdir(), "installed-jvm-resource-"));
	t.after(() => rm(work, { recursive: true, force: true }));
	const sources = {}, packages = new Map(), rows = [];
	for(const f of clients)
	{
		const b = await readFile(replay ? join(root, f) : paths[f] ?? join(fixture, f));
		sources[f] = sha256(b); await writeFile(join(work, f), b, { flag: "wx" });
	}
	for(const r of ["ordinary", "peer", "lookalike", "reviewed"]) packages.set(r, await inspectJvmResource(root, r, work));
	const peer = packages.get("peer"), foreign = packages.get("lookalike");
	const java = env.LEAN_BRIDGE_JAVA, javac = env.LEAN_BRIDGE_JAVAC, sdk = env.LEAN_BRIDGE_KOTLIN_HOME;
	for(const route of ["ordinary", "reviewed"])
	{
		const proj = join(work, route), classes = join(proj, "classes"), component = packages.get(route), d = component.proof.detail;
		assert.deepEqual(d.nominal, peer.proof.detail.nominal);
		for(const type of Object.keys(d.nominal)) assert.notEqual(d.nominal[type].identity, foreign.proof.detail.nominal[type].identity);
		for(const x of [peer, foreign])
		{
			const o = x.proof.detail;
			assert.deepEqual(d.ledger, o.ledger); assert.deepEqual(d.owner, o.owner); assert.equal(d.runtime, o.runtime);
			for(const lib of [d.ledger.library, d.owner.library, "libleanshared.so", "liblean_bridge_native.so"]) assert.equal(d.libraries[lib], o.libraries[lib]);
		}
		const { resolved, classpath } = await installJvmTasks(proj, work, [component, peer, foreign], false);
		await mkdir(classes);
		const j = ["-J-XX:ActiveProcessorCount=1", "--release", "22", "-proc:none", "-encoding", "UTF-8", "-cp", classpath, "-d", classes];
		await run(javac, [...j, ...clients.filter(f => f.endsWith(".java") && f !== "Bad.java").map(f => join(work, f))], proj, env);
		const k = ["-XX:ActiveProcessorCount=1", "-Xmx512m", "-cp", join(sdk, "lib/*")
			, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-kotlin-home", sdk
			, "-jdk-home", env.JAVA_HOME, "-no-stdlib", "-no-reflect", "-Werror"
			, "-jvm-target", "22", "-classpath", classes + delimiter + classpath
			, "-d", classes];
		await run(java, [...k, join(work, "Installed.kt"), join(work, "Example.kt")], proj, env);
		const bad = [[javac, j, "Bad.java", [3,4], /incompatible types/u]
			, [java, k, "Bad.kt", [5,6], /mismatch/iu]];
		for(const [cmd, args, file, lines, pattern] of bad)
		{
			await assert.rejects(run(cmd, [...args, join(work, file)], proj, env), e => {
				for(const n of lines) assert.ok(e.message.split("\n").some(l => l.includes(file + ":" + n + ":") && pattern.test(l)), e.message);
				return true;
			});
			await assert.rejects(access(join(classes, file === "Bad.kt" ? "BadKt.class" : "Bad.class")), { code: "ENOENT" });
		}
		const isolated = { PATH: "/unavailable", LANG: "C.UTF-8", TMPDIR: proj, LEAN_NUM_THREADS: "1" }, observations = {};
		for(const order of ["desk-first", "peer-first"])
		{
			const jars = classpath.split(delimiter);
			if(order === "peer-first")
			{
				const i = jars.findIndex(f => basename(f) === basename(peer.paths[0])); assert.ok(i > 0); jars.unshift(...jars.splice(i,1));
			}
			const launch = ["-XX:ActiveProcessorCount=1", "-Xmx192m"
				, "-Djava.io.tmpdir=" + proj, "--enable-native-access=ALL-UNNAMED"
				, "-cp", [classes, ...jars].join(delimiter)];
			for(const app of ["Installed", "InstalledKt", "Example", "ExampleKt"])
			{
				const out = await run(java, [...launch, app, order, String(d.issue), d.ledger.id, d.nominal.Ticket.identity], proj, isolated);
				if(app.startsWith("Example")) assert.equal(out, "42");
				else assert.match(out, /zero leaked leases or files$/u);
				observations[order + "/" + app] = out;
			}
			if(order === "peer-first")
			{
				const original = jars.find(f => basename(f) === basename(component.paths[0]));
				const message = await run(java, [...launch, "RejectLedger", original, d.ledger.library, join(proj, "shadow.jar")], proj, isolated);
				assert.equal(message, "changed ledger rejected after a compatible peer loaded"); observations.tamper = message;
			}
		}
		rows.push({ route, resolved, observations, rejected: ["wrong kind", "same name with different Lean source"] });
		t.diagnostic(route + ": both JVM languages, both load orders, wrong kinds refused, retained/abandoned/retired cleanup checked");
	}
	const report = { schemaVersion: 1, sources, packages: [...packages.values()].map(p => p.proof), rows };
	if(capture)
	{
		for(const f of clients) await copyFile(join(work, f), join(root, f), constants.COPYFILE_EXCL);
		await writeFile(join(root, "acceptance.json"), canonicalJson(report), { flag: "wx" });
	}
	else
	{
		const original = await readFile(join(root, "acceptance.json")); assert.deepEqual(report, JSON.parse(original));
		if(env.LEAN_BRIDGE_JVM_RESOURCE_EXPECTED)
		{
			const pin = await json(env.LEAN_BRIDGE_JVM_RESOURCE_EXPECTED);
			assert.equal(sha256(original), pin.acceptanceSha256); assert.deepEqual(report, pin.installed);
		}
	}
});
