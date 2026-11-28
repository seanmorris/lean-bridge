/**
 * Relocated original Maven packages, including an independently built compatible synchronous peer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { inspectJvmResource } from "./jvm-resource-acceptance.mjs";
import { installJvmTasks } from "./jvm-tasks-acceptance.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" };
const capture = env.LEAN_BRIDGE_JVM_LEASE_TASK_CAPTURE, replay = env.LEAN_BRIDGE_JVM_LEASE_TASK_REPLAY;
const fixture = resolve("tests/fixtures/jvm-lease-tasks"), json = async p => JSON.parse(await readFile(p, "utf8"));
const paths = { "verify.py": resolve("tests/fixtures/jvm-sync-resources/verify.py")
	, "Observe.java": resolve("tests/fixtures/jvm-tasks/Observe.java")
	, "settings.xml": resolve("tests/fixtures/jvm-sync-io/settings.xml") };
const clients = ["Example.java", "Installed.java", "Races.java", "DeliveryAccess.java", "Bad.java", "Bad.kt", "Installed.kt", "Example.kt", ...Object.keys(paths)];
test("installed JVM lease tasks dispose undelivered values and typed errors without revoking caller-owned leases", { skip: !capture && !replay, timeout: 3_600_000 }, async t => {
	assert.ok(!(capture && replay)); const root = resolve(capture ?? replay), sync = resolve(env.LEAN_BRIDGE_JVM_LEASE_TASK_SYNC);
	const work = await mkdtemp(join(tmpdir(), "installed-jvm-lease-tasks-")); t.after(() => rm(work, { recursive: true, force: true }));
	const sources = {}, rows = [], tasks = [], peers = [];
	for(const f of clients)
	{
		const b = await readFile(replay ? join(root, f) : paths[f] ?? join(fixture, f));
		sources[f] = sha256(b); await writeFile(join(work, f), b, { flag: "wx" });
	}
	const old = await json("docs/evidence/jvm-sync-resources-20261123.json");
	const inspectSync = async route => {
		const p = await inspectJvmResource(sync, route, work);
		assert.deepEqual(old.installed.packages.find(x => x.route === route), p.proof);
		peers.push({ route, receiptSha256: p.proof.receiptSha256 }); return p;
	};
	const foreign = await inspectSync("lookalike");
	for(const route of ["ordinary", "reviewed"])
	{
		const task = await inspectJvmResource(root, route, work, true), peer = await inspectSync(route);
		tasks.push(task.proof); const d = task.proof.detail, p = peer.proof.detail;
		assert.deepEqual(d.owner, p.owner); assert.deepEqual(d.ledger, p.ledger); assert.deepEqual(d.nominal, p.nominal);
		assert.notEqual(d.nominal.Ticket.identity, foreign.proof.detail.nominal.Ticket.identity);
		for(const n of [p.ledger.library, p.owner.library, "libleanshared.so", "liblean_bridge_native.so"]) assert.equal(d.libraries[n], p.libraries[n]);
		const proj = join(work, route), classes = join(proj, "classes");
		const { resolved, classpath } = await installJvmTasks(proj, work, [task, peer, foreign]);
		await mkdir(classes);
		const races = (await readFile(join(work, "Races.java"), "utf8")).replace("__TICKET__", "org.leanbridge.resources.h" + d.nominal.Ticket.identity + ".Ticket");
		await writeFile(join(proj, "Races.java"), races, { flag: "wx" });
		const java = env.LEAN_BRIDGE_JAVA, javac = env.LEAN_BRIDGE_JAVAC, sdk = env.LEAN_BRIDGE_KOTLIN_HOME;
		const j = ["-J-XX:ActiveProcessorCount=1", "--release", "22", "-proc:none", "-encoding", "UTF-8", "-cp", classpath, "-d", classes];
		const good = clients.filter(f => f.endsWith(".java") && f !== "Bad.java").map(f => join(f === "Races.java" ? proj : work, f));
		await run(javac, [...j, ...good], proj, env);
		const cp = classes + delimiter + classpath;
		const k = ["-XX:ActiveProcessorCount=1", "-Xmx512m", "-cp", join(sdk, "lib/*")
			, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-kotlin-home", sdk
			, "-jdk-home", env.JAVA_HOME, "-no-stdlib", "-no-reflect", "-Werror"
			, "-jvm-target", "22", "-classpath", cp, "-d", classes];
		await run(java, [...k, join(work, "Installed.kt"), join(work, "Example.kt")], proj, env);
		const bad = [[javac, j, "Bad.java", [3,4], /incompatible types/u]
			, [java, k, "Bad.kt", [5,6], /mismatch/iu]];
		for(const [cmd, args, file, lines, pattern] of bad)
		{
			await assert.rejects(run(cmd, [...args, join(work, file)], proj, env), e => {
				for(const n of lines) assert.ok(e.message.split("\n").some(s => s.includes(file + ":" + n + ":") && pattern.test(s)), e.message);
				return true;
			});
			await assert.rejects(access(join(classes, file === "Bad.kt" ? "BadKt.class" : "Bad.class")), { code: "ENOENT" });
		}
		const observations = {}, isolated = { PATH: "/unavailable", LANG: "C.UTF-8", TMPDIR: proj, LEAN_NUM_THREADS: "1" };
		for(const order of ["depot-first", "desk-first"])
		{
			const jars = classpath.split(delimiter);
			const first = (order === "depot-first" ? task : peer).paths[0], i = jars.findIndex(f => basename(f) === basename(first));
			assert.ok(i >= 0); jars.unshift(...jars.splice(i,1));
			const launch = ["-XX:ActiveProcessorCount=1", "-Xmx192m"
				, "-Djava.io.tmpdir=" + proj, "--enable-native-access=ALL-UNNAMED"
				, "-cp", [classes, ...jars].join(delimiter)];
			for(const app of order === "depot-first" ? ["Installed", "InstalledKt", "Example", "ExampleKt"] : ["Installed", "InstalledKt"])
			{
				const line = await run(java, [...launch, app, order, String(d.ops.pending), String(d.ops.tickets)], proj, isolated, 150_000);
				if(app.startsWith("Example")) assert.equal(line, "42"); else assert.match(line, /zero leaked leases or files$/u);
				observations[order + "/" + app] = line;
			}
		}
		rows.push({ route, resolved, observations, negative: ["wrong kind", "same Lean spelling with foreign identity"] });
		t.diagnostic(route + ": both languages and load orders, native publication races and prompt coroutine cancellation passed");
	}
	const report = { schemaVersion: 1, sources, tasks, peers, rows };
	if(capture)
	{
		for(const f of clients) await copyFile(join(work, f), join(root, f), constants.COPYFILE_EXCL);
		await writeFile(join(root, "acceptance.json"), canonicalJson(report), { flag: "wx" });
	}
	else
	{
		const original = await readFile(join(root, "acceptance.json")); assert.deepEqual(report, JSON.parse(original));
		if(env.LEAN_BRIDGE_JVM_LEASE_TASK_EXPECTED)
		{
			const pin = await json(env.LEAN_BRIDGE_JVM_LEASE_TASK_EXPECTED);
			assert.deepEqual(report, pin.installed); assert.equal(sha256(original), pin.acceptanceSha256);
		}
	}
});
