/** @file Execute public host-object record fields in separate installed Java and Kotlin applications. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {access, copyFile, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename, delimiter, dirname, join, relative, resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {canonicalJson, sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";
import {installOfflineAuthor} from "./offline-author-cli.mjs";

const json = async p => JSON.parse(await readFile(p)), exec = promisify(execFile);
const fixture = resolve("tests/fixtures/jvm-host-record");
test("installed Maven records keep the original Java and Kotlin application objects", {timeout: 3_600_000}, async t => {
	const root = await mkdtemp(join(tmpdir(), "jvm-host-record-")); t.after(() => rm(root, {recursive: true, force: true}));
	const cli = await installOfflineAuthor(root), env = process.env, java = env.LEAN_BRIDGE_JAVA ?? "java";
	const sdk = env.LEAN_BRIDGE_KOTLIN_HOME, output = resolve(env.LEAN_BRIDGE_JVM_HOST_RECORD_OUTPUT ?? "build/jvm-host-record");
	await mkdir(output, {recursive: true});
	const lean = (await readFile(resolve("tests/fixtures/dotnet-host-record/Workshop.lean"), "utf8")).replaceAll("LeanBridge.Host.Dotnet", "LeanBridge.Host.Jvm");
	const clients = {};
	for(const file of ["Installed.java", "Installed.kt", "WrongMeter.java", "WrongMeter.kt"]) clients[file] = sha256(await readFile(join(fixture, file)));
	let review;
	for(const route of ["ordinary", "reviewed"])
	{
		const stage = join(root, route), src = join(stage, "project"), out = join(stage, "handoff");
		const repo = join(stage, "repo"), moved = join(stage, "installed"), classes = join(stage, "classes");
		await mkdir(stage); await prepareNativeHostFixture(src, "jvm"); await copyFile(resolve("LICENSE"), join(src, "LICENSE"));
		await writeFile(join(src, "Workshop.lean"), lean);
		const file = join(src, "lean-bridge.exports.json"), cfg = await json(file);
		if(route === "ordinary") cfg.exports = ["Gauge.createPair", "Gauge.flip", "Gauge.sumRead", "Gauge.choose", "Gauge.duplicateSample"];
		else
{ delete cfg.exports; await writeFile(join(src, "records.binding-ir.json"), review); }
		await writeFile(file, canonicalJson(cfg));
		const build = dest => run(process.execPath, [cli, "build", "--project", src, "--target", "maven", "--output", dest, "--json", "--progress", "none"], root, env);
		await build(out);
		const api = await json(join(out, "binding-ir.json")), evidence = await json(join(out, "host-export-evidence.json"));
		const pair = api.types.find(x => x.id === "lean:Gauge.Pair"), flip = api.declarations.find(d => d.source.declaration === "Gauge.flip");
		assert.equal(api.schemaVersion, 4); assert.equal(flip.parameters[0].ownership, "borrow"); assert.equal(flip.result.ownership, "lease");
		assert.deepEqual(pair.fields.map(f => f.name), ["lead", "sample", "sequence", "spare"]);
		if(route === "ordinary")
		{
			assert.equal(evidence.reviewedSourceSha256, null);
			pair.fields[1].documentation.summary = "Measurement bytes copied for the application."; review = canonicalJson(api);
		} else
		{
			assert.equal(evidence.reviewedSourceSha256, sha256(review)); assert.deepEqual(api, JSON.parse(review));
			pair.fields.reverse(); await writeFile(join(src, "records.binding-ir.json"), canonicalJson(api));
			const no = join(stage, "refused"); await assert.rejects(build(no), /Reviewed API differs/u); await assert.rejects(access(no), {code: "ENOENT"});
		}
		const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath: join(out, "package-set-receipt.json")});
		assert.equal(receipt.packages.length, 1); const [pkg] = receipt.packages; assert.equal(pkg.name, "org.leanbridge:workshop");
		const artifact = ext => join(out, pkg.artifacts.find(a => a.path.endsWith(ext)).path);
		await cp(env.LEAN_BRIDGE_JVM_IO_M2_SEED, repo, {recursive: true}); await assert.rejects(access(join(repo, "org/leanbridge/workshop")), {code: "ENOENT"});
		await writeFile(join(stage, "pom.xml"), '<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>app</groupId><artifactId>client</artifactId><version>1</version><dependencies><dependency><groupId>org.leanbridge</groupId><artifactId>workshop</artifactId><version>1.0.0</version></dependency></dependencies></project>');
		const mvn = (...args) => run(env.LEAN_BRIDGE_MAVEN ?? "mvn", ["--offline", "--batch-mode", "--quiet", "--no-transfer-progress", "-s", resolve("tests/fixtures/jvm-sync-io/settings.xml"), "-Dmaven.repo.local=" + repo, ...args], stage, env);
		await mvn("org.apache.maven.plugins:maven-install-plugin:3.1.4:install-file", "-Dfile=" + artifact(".jar"), "-DpomFile=" + artifact(".pom"));
		await mvn("org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath", "-Dmdep.outputFile=paths");
		const relativeJars = (await readFile(join(stage, "paths"), "utf8")).trim().split(delimiter).map(p => relative(repo, p));
		assert.ok(relativeJars.every(p => !p.startsWith("..") && p.endsWith(".jar"))); await rename(repo, moved);
		const jars = relativeJars.map(p => join(moved, p)), lib = jars.find(p => p.endsWith("/workshop-1.0.0.jar")); assert.ok(lib);
		for(const a of pkg.artifacts) assert.equal(sha256(await readFile(join(dirname(lib), basename(a.path)))), a.sha256);
		await rm(src, {recursive: true}); await rm(out, {recursive: true}); await mkdir(classes);
		const path = [classes, ...jars].join(delimiter);
		const compileJava = f => run(env.LEAN_BRIDGE_JAVAC ?? "javac", ["--release", "22", "-proc:none", "-Xlint:unchecked", "-Werror", "-cp", path, "-d", classes, join(fixture, f)], stage, env);
		const compileKt = f => run(java, ["-XX:ActiveProcessorCount=1", "-Xmx384m", "-cp", join(sdk, "lib/*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-kotlin-home", sdk, "-jdk-home", env.JAVA_HOME, "-no-stdlib", "-no-reflect", "-Werror", "-jvm-target", "22", "-classpath", path, "-d", classes, join(fixture, f)], stage, env);
		await compileJava("Installed.java"); await compileKt("Installed.kt");
		await assert.rejects(compileJava("WrongMeter.java"), /Pair<Object> cannot be converted to Pair<Meter>/u);
		await assert.rejects(compileKt("WrongMeter.kt"), /argument type mismatch/iu);
		const observations = {};
		for(const [main, expected] of [
			["Installed", "Java: original meters, copied arrays, checked Nat, partial-result cleanup, retained closure and final release"]
			, ["InstalledKt", "Kotlin: original meters, property copies, wide Nat, retained choose and independent disposal"]
		]){
			const app = await mkdtemp(join(stage, "fresh-"));
			const call = await exec(java, ["-XX:ActiveProcessorCount=1", "-Xmx192m", "-Xcheck:jni", "--enable-native-access=ALL-UNNAMED", "-Djava.io.tmpdir=" + app, "-cp", path, main], {cwd: app, env: {PATH: "/no-tools", LANG: "C.UTF-8", LEAN_NUM_THREADS: "1"}, timeout: 180_000});
			assert.equal(call.stderr.trim(), ""); assert.equal(call.stdout.trim(), expected); observations[main] = expected;
		}
		const record = {route, clients, observations, packageSetSha256: result.receiptSha256, reviewedSourceSha256: evidence.reviewedSourceSha256};
		await writeFile(join(output, route + ".package-set.json"), canonicalJson(receipt));
		await writeFile(join(output, route + ".execution.json"), canonicalJson(record)); t.diagnostic(route + ": " + result.receiptSha256);
	}
});
