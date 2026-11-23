/**
 * Check that the native worker/cursor retains an object after its final host lease closes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { installJvmTasks } from "./jvm-tasks-acceptance.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" };
const output = env.LEAN_BRIDGE_JVM_LEASE_SOLE_OUTPUT;
const json = async f => JSON.parse(await readFile(f, "utf8"));
test("last host lease can close while an installed JVM worker or cursor is its only remaining owner", { skip: !output, timeout: 1_800_000 }, async t => {
	const root = resolve(env.LEAN_BRIDGE_JVM_LEASE_TASK_ORIGINAL), sync = resolve(env.LEAN_BRIDGE_JVM_LEASE_TASK_SYNC);
	const work = await mkdtemp(join(tmpdir(), "jvm-sole-owner-")); t.after(() => rm(work, { recursive: true, force: true }));
	const matrix = await json(join(root, "acceptance.json")), prior = await json("docs/evidence/jvm-sync-resources-20261123.json");
	const files = { "Observe.java": "jvm-tasks", "settings.xml": "jvm-sync-io", "Sole.java": "jvm-lease-tasks", "Sole.kt": "jvm-lease-tasks" };
	const sources = {}, rows = [];
	for(const [f, fixture] of Object.entries(files))
	{
		const b = await readFile(join("tests/fixtures", fixture, f)); sources[f] = sha256(b);
		await writeFile(join(work, f), b, { flag: "wx" });
	}
	for(const route of ["ordinary", "reviewed"])
	{
		const dir = join(work, route), inside = join(dir, "classes");
		const pkgs = [];
		for(const [r, proof] of [[root, matrix.tasks.find(p => p.route === route)], [sync, prior.installed.packages.find(p => p.route === route)]])
		{
			const handoff = join(r, route, "handoff");
			const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
			assert.equal(result.receiptSha256, proof.receiptSha256); assert.deepEqual(receipt.packages[0].artifacts, proof.artifacts);
			pkgs.push({ proof, paths: proof.artifacts.map(a => join(handoff, a.path)) });
		}
		const { classpath } = await installJvmTasks(dir, work, pkgs); await mkdir(inside);
		const java = env.LEAN_BRIDGE_JAVA, sdk = env.LEAN_BRIDGE_KOTLIN_HOME, cp = inside + delimiter + classpath;
		await run(env.LEAN_BRIDGE_JAVAC, ["-J-XX:ActiveProcessorCount=1", "--release", "22", "-proc:none", "-cp", classpath, "-d", inside, join(work, "Observe.java"), join(work, "Sole.java")], dir, env);
		const k = ["-XX:ActiveProcessorCount=1", "-Xmx512m", "-cp", join(sdk, "lib/*")
			, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-kotlin-home", sdk
			, "-jdk-home", env.JAVA_HOME, "-no-stdlib", "-no-reflect", "-Werror"
			, "-jvm-target", "22", "-classpath", cp, "-d", inside];
		await run(java, [...k, join(work, "Sole.kt")], dir, env);
		const observations = {};
		for(const app of ["Sole", "SoleKt"])
		{
			const launch = ["-XX:ActiveProcessorCount=1", "-Xmx192m"
				, "-Djava.io.tmpdir=" + dir, "--enable-native-access=ALL-UNNAMED"
				, "-cp", cp, app];
			observations[app] = await run(java, launch, dir, { PATH: "/unavailable", LANG: "C.UTF-8", TMPDIR: dir, LEAN_NUM_THREADS: "1" }, 150_000);
			assert.match(observations[app], /baseline restored$/u);
		}
		rows.push({ route, receipts: pkgs.map(p => p.proof.receiptSha256), observations });
	}
	const report = { schemaVersion: 1, sources, rows };
	if(env.LEAN_BRIDGE_JVM_LEASE_TASK_EXPECTED) assert.deepEqual(report, (await json(env.LEAN_BRIDGE_JVM_LEASE_TASK_EXPECTED)).soleOwner);
	await writeFile(resolve(output), canonicalJson(report), { flag: "wx" });
});
