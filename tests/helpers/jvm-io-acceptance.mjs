/**
 * Install actual JAR/POM pairs into an offline Maven repository. Consumer code never sees the producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { access, copyFile, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { copiedJvmAssets } from "../../src/backends/jvm/copied-assets.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { assertJsonSchema } from "./json-schema.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" }, capture = env.LEAN_BRIDGE_JVM_IO_CAPTURE, replay = env.LEAN_BRIDGE_JVM_IO_REPLAY;
const json = async p => JSON.parse(await readFile(p, "utf8"));
const hashFile = async p => { const h = createHash("sha256"); for await(const b of createReadStream(p)) h.update(b); return h.digest("hex"); };
const fixture = resolve("tests/fixtures/jvm-sync-io"), clients = ["Installed.java", "Observer.java", "RejectTamper.java", "Installed.kt", "Example.java", "Example.kt", "Bad.kt", "verify_jar.py", "settings.xml"];
const absent = async p => assert.rejects(access(p), { code: "ENOENT" });
const alternateOwner = async (work, proj, pkg, javac) => {
	const { info } = pkg.proof, lib = info.owner.library, overlay = join(proj, "alternate"), resource = join(overlay, "META-INF/lean-bridge/native/linux-x64", lib);
	await mkdir(dirname(resource), { recursive: true });
	await run(env.LEAN_BRIDGE_PYTHON ?? "python3", ["-I", "-B", "verify_jar.py", ...pkg.paths, resource], work, env);
	const library = Object.keys(info.libraries).find(n => n.startsWith("liblbc_jvm_"));
	const libraries = { ...info.libraries, [lib]: await hashFile(resource) }; assert.notEqual(libraries[lib], info.libraries[lib]);
	const auth = { library, libraries, runtimeIdentity: info.runtimeIdentity, componentId: info.componentId, componentReceiptSha256: info.componentIdentity };
	const src = join(proj, "NativeAssets.java"); await writeFile(src, copiedJvmAssets({ namespace: info.namespace }, auth), { flag: "wx" });
	await run(javac, ["--release", "22", "-g:none", "-proc:none", "-d", overlay, src], proj, env);
	return overlay;
};
const inspect = async (origin, work, route) => {
	const dir = join(origin, route, "handoff"), head = "package-set-receipt.json";
	const { result, receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, head) });
	await assertJsonSchema("package-set-receipt", receipt);
	const api = await json(join(dir, "binding-ir.json")), evidence = await json(join(dir, "host-export-evidence.json"));
	const [p] = receipt.packages, [jar, pom] = p.artifacts.toSorted((a, b) => a.path.localeCompare(b.path));
	assert.equal(receipt.packages.length, 1); assert.equal(p.artifacts.length, 2);
	assert.equal(p.profile, "native-jvm-io-v1"); assert.equal(p.target, "maven"); assert.equal(p.runtimeDelivery, "embedded");
	assert.equal(p.name, "com.acme:" + (route === "peer" ? "clock" : "journal") + "-io");
	assert.equal(p.version, "1.2.0-rc.1"); assert.equal(p.role, "component"); assert.deepEqual(p.requires, []);
	assert.equal(hashBindingIr(api), receipt.profiles[0].bindingIrSha256);
	assert.equal(evidence.sourceTreeSha256, receipt.source.treeSha256); assert.equal(Boolean(evidence.reviewedSourceSha256), route === "reviewed");
	assert.deepEqual(evidence.selection.nativeEffects, ["filesystem"]); assert.deepEqual(evidence.selection.taskExports, []);
	const paths = [jar, pom].map(a => join(dir, a.path));
	const info = JSON.parse(await run(env.LEAN_BRIDGE_PYTHON ?? "python3", ["-I", "-B", "verify_jar.py", ...paths], work, env));
	assert.equal(info.runtimeIdentity, p.runtimeIdentity); assert.equal(info.bindingIrSha256, hashBindingIr(api));
	for(const a of [jar, pom])
	{
		const repo = join(dir, "packages/maven/repository/com/acme", p.name.split(":")[1], p.version, basename(a.path));
		assert.equal(await hashFile(repo), a.sha256); assert.equal((await readFile(repo + ".sha256", "utf8")).trim(), a.sha256);
	}
	const proof = { route, name: p.name, receiptSha256: result.receiptSha256
		, sourceTreeSha256: evidence.sourceTreeSha256
		, reviewedSourceSha256: evidence.reviewedSourceSha256
		, jar, pom, info };
	return { paths, proof };
};

test("relocated Maven Java and Kotlin consumers preserve real Lean IO, typed errors and shared ownership of execution", { skip: !capture && !replay, timeout: 3_600_000 }, async t => {
	assert.ok(!(capture && replay));
	const root = resolve(capture ?? replay), work = await mkdtemp(join(tmpdir(), "installed-jvm-io-"));
	t.after(() => rm(work, { recursive: true, force: true }));
	const clientHashes = {};
	for(const f of clients)
	{
		const b = await readFile(join(replay ? root : fixture, f)); clientHashes[f] = sha256(b);
		await writeFile(join(work, f), b, { flag: "wx" });
	}
	const sdk = env.LEAN_BRIDGE_KOTLIN_HOME, mvn = env.LEAN_BRIDGE_MAVEN ?? "mvn";
	const java = env.LEAN_BRIDGE_JAVA ?? "java", javac = env.LEAN_BRIDGE_JAVAC ?? "javac";
	const packages = new Map();
	for(const r of ["ordinary", "reviewed", "peer"]) packages.set(r, await inspect(root, work, r));
	const peer = packages.get("peer"), rows = [];
	for(const route of ["ordinary", "reviewed"])
	{
		const journal = packages.get(route), proj = join(work, route), repo = join(proj, "repo"), dest = join(proj, "installed");
		assert.deepEqual(journal.proof.info.owner, peer.proof.info.owner);
		for(const n of ["libleanshared.so", "liblean_bridge_native.so", peer.proof.info.owner.library]) assert.equal(journal.proof.info.libraries[n], peer.proof.info.libraries[n]);
		await mkdir(proj); await cp(resolve(env.LEAN_BRIDGE_JVM_IO_M2_SEED), repo, { recursive: true, mode: constants.COPYFILE_FICLONE });
		for(const a of ["journal-io", "clock-io"]) await absent(join(repo, "com/acme", a));
		const pairs = [journal, peer], artifact = p => p.proof.name.split(":")[1];
		const deps = pairs.map(p => `<dependency><groupId>com.acme</groupId><artifactId>${artifact(p)}</artifactId><version>1.2.0-rc.1</version></dependency>`).join("");
		await writeFile(join(proj, "pom.xml"), '<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>client</groupId><artifactId>sample</artifactId><version>1.0.0</version><dependencies>' + deps + "</dependencies></project>", { flag: "wx" });
		const flags = ["--offline", "--batch-mode", "--quiet"
			, "--no-transfer-progress"
			, "-s", join(work, "settings.xml"), "-Dmaven.repo.local=" + repo];
		for(const p of pairs) await run(mvn, [...flags, "org.apache.maven.plugins:maven-install-plugin:3.1.4:install-file", "-Dfile=" + p.paths[0], "-DpomFile=" + p.paths[1]], proj, env);
		await run(mvn, [...flags, "org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath", "-Dmdep.outputFile=resolved.txt"], proj, env);
		const resolved = (await readFile(join(proj, "resolved.txt"), "utf8")).trim().split(delimiter).map(s => relative(repo, s));
		assert.ok(resolved.length >= 3 && resolved.every(s => !s.startsWith("..") && s.endsWith(".jar")));
		assert.ok(resolved.includes("org/jetbrains/kotlin/kotlin-stdlib/2.2.0/kotlin-stdlib-2.2.0.jar"));
		await rename(repo, dest);
		const jars = resolved.map(s => join(dest, s)), paths = jars.join(delimiter);
		for(const p of pairs)
		{
			const jar = jars.find(path => basename(path) === basename(p.paths[0]));
			assert.equal(await hashFile(jar), p.proof.jar.sha256);
			assert.equal(await hashFile(join(dirname(jar), basename(p.paths[1]))), p.proof.pom.sha256);
		}
		const classes = join(proj, "classes"); await mkdir(classes);
		await run(javac, ["--release", "22", "-proc:none", "-encoding", "UTF-8", "-cp", paths, "-d", classes, ...clients.filter(f => f.endsWith(".java")).map(f => join(work, f))], proj, env);
		const compiler = ["-XX:ActiveProcessorCount=1", "-Xmx512m"
			, "-cp", join(sdk, "lib/*")
			, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-kotlin-home", sdk
			, "-jdk-home", env.JAVA_HOME, "-no-stdlib", "-no-reflect", "-Werror"
			, "-jvm-target", "22"
			, "-classpath", paths, "-d", classes];
		await run(java, [...compiler, join(work, "Installed.kt"), join(work, "Example.kt")], proj, env);
		await assert.rejects(run(java, [...compiler, join(work, "Bad.kt")], proj, env), e => {
			assert.match(e.message, /Bad\.kt:5:\d+: error:.*null/iu); assert.match(e.message, /Bad\.kt:6:\d+: error:.*mismatch/iu); return true;
		});
		await absent(join(classes, "BadKt.class"));
		const classpath = classes + delimiter + paths, actual = jars.find(path => basename(path) === basename(journal.paths[0]));
		const isolated = { PATH: "/unavailable", LANG: "C.UTF-8", TMPDIR: proj, LEAN_NUM_THREADS: "1" };
		const launch = ["-XX:ActiveProcessorCount=1", "-Xmx192m", "-Djava.io.tmpdir=" + proj, "--enable-native-access=ALL-UNNAMED", "-cp", classpath];
		const observed = {};
		for(const app of ["Example", "ExampleKt"])
		{
			const output = await run(java, [...launch, app, join(proj, app + ".txt")], proj, isolated);
			assert.equal(output, "ready\n37"); observed[app] = output;
		}
		for(const app of ["Installed", "InstalledKt"]) for(const order of ["journal-first", "peer-first"])
		{
			const line = await run(java, [...launch, app, order, join(proj, app + "-" + order + ".txt"), actual], proj, isolated);
			assert.match(line, app === "Installed" ? /^Java: .*zero native identities, retirement$/u : /^Kotlin: .*shared owner$/u);
			observed[app + "/" + order] = line;
		}
		const tamper = await run(java, [...launch, "RejectTamper", actual, journal.proof.info.owner.library, join(proj, "shadow.jar")], proj, isolated);
		assert.equal(tamper, "changed owner rejected after a compatible peer loaded");
		const overlay = await alternateOwner(work, proj, journal, javac);
		const incompatible = await run(java, [...launch, "RejectTamper", actual, journal.proof.info.owner.library, overlay, "alternate"], proj, isolated);
		assert.equal(incompatible, "independently verified but incompatible owner refused");
		rows.push({ route, classpath: resolved, observed, tamper, incompatible });
		t.diagnostic(route + ": offline Maven resolution, Java and Kotlin in both load orders, type rejections and changed library passed");
	}
	const report = { schemaVersion: 1, clients: clientHashes, packages: [...packages.values()].map(p => p.proof), rows };
	if(capture)
	{
		for(const f of clients) await copyFile(join(work, f), join(root, f), constants.COPYFILE_EXCL);
		await writeFile(join(root, "acceptance.json"), canonicalJson(report), { flag: "wx" });
	}
	else
	{
		const original = await readFile(join(root, "acceptance.json")); assert.deepEqual(report, JSON.parse(original));
		if(env.LEAN_BRIDGE_JVM_IO_EXPECTED)
		{
			const pin = await json(env.LEAN_BRIDGE_JVM_IO_EXPECTED);
			assert.equal(sha256(original), pin.acceptanceSha256); assert.deepEqual(report, pin.installed);
		}
	}
});
