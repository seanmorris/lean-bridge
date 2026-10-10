/**
 * Real Lean/JVM source controls, separately executing the full Java and Kotlin consumers.
 * Synthetic JAR receipts here do not establish canonical installed-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { finContainerEdgeCompilerModel } from "./helpers/fin-container-edge-compiled-fixture.mjs";
import { finContainerEdgeConsumer } from "./helpers/fin-container-edges.mjs";
import { finContainerEdgeEntries } from "./helpers/fin-container-edge-dispatch.mjs";
import { repeatFinContainerEdges } from "./helpers/fin-container-edge-install.mjs";
import { finContainerEdgeGdbScript } from "./helpers/fin-container-edge-gdb.mjs";
import { finContainerEdgeJvmChecks, finContainerEdgeJvmExpected, finContainerEdgeJvmProbe, readFinContainerEdgeJvm } from "./helpers/fin-container-edge-jvm.mjs";
import { assertFinContainerEdgeJvmGdbRun, finContainerEdgeJvmGdbScript, prepareFinContainerEdgeJvmGdb } from "./helpers/fin-container-edge-jvm-gdb.mjs";
import { finContainerEdgeJvmFixture } from "./helpers/fin-container-edge-jvm-fixture.mjs";
import { installFinContainerEdgeJvm, verifyFinContainerEdgeJvmEnvironment } from "./helpers/fin-container-edge-jvm-closure.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const transcript = (rows, profile) => rows.map(([step, method, status, counts]) => `edge-${profile} ${step} ${method} ${status} ${counts.join(" ")}\n`).join("") + `fin-container-ok:${finContainerEdgeJvmChecks[profile]}\n`;

test("JVM transcripts retain both caller identities, null carriers and every rejection/recovery pair", () => {
	assert.equal(finContainerEdgeJvmExpected.length, 12046);
	assert.deepEqual(finContainerEdgeJvmExpected.at(-1)[3], [1003, 1003, 1001, 1001, 1001, 1003, 1003, 1003]);
	const totals = [[1001, 1003, 1, 1], [1001, 1003, 1, 1], [1001, 1003, 0, 1], [1003, 1003, 0, 3], [1003, 1004, 0, 0], [1003, 1010, 0, 0]];
	for(const [index, method] of finContainerEdgeEntries.entries())
	{
		const rows = finContainerEdgeJvmExpected.filter(row => row[1] === method);
		assert.deepEqual(["ok", "fin", "null", "value"].map(status => rows.filter(row => row[2] === status).length), totals[index], method);
	}
	for(const profile of ["java", "kotlin"])
	{
		assert.deepEqual(readFinContainerEdgeJvm(transcript(finContainerEdgeJvmExpected, profile), profile), finContainerEdgeJvmExpected);
		assert.throws(() => readFinContainerEdgeJvm(transcript(finContainerEdgeJvmExpected, profile), profile === "java" ? "kotlin" : "java"));
		for(const mutate of [
			rows => { rows[1][3][0]++; }
			, rows => { rows[0][3][6]--; }
			, rows => { rows[1][2] = "ok"; }
			, rows => { rows[0][1] = "flatten"; }
			, rows => { [rows[0], rows[1]] = [rows[1], rows[0]]; }
			, rows => { rows.splice(19, 1); }
			, rows => { rows.push(rows.at(-1)); }
		]) {
			const rows = structuredClone(finContainerEdgeJvmExpected); mutate(rows);
			assert.throws(() => readFinContainerEdgeJvm(transcript(rows, profile), profile));
		}
	}
	assert.throws(() => { finContainerEdgeJvmExpected[0][3][0]++; });
});

test("JVM instrumentation changes only call forwarding and startup, retaining original assertions", async () => {
	const model = finContainerEdgeCompilerModel();
	for(const profile of ["java", "kotlin"])
	{
		const original = await finContainerEdgeConsumer(profile);
		const { consumer, counter, api } = await finContainerEdgeJvmProbe(model, model.component, profile, "/consumer/component.jar");
		let restored = consumer.replaceAll("EdgeApi.", "Api.");
		restored = profile === "java" ? restored.replace("\n        EdgeCounter.initial(args);", "") : restored.replace("fun main(args: Array<String>) {\n    EdgeCounter.initial(args)", "fun main() {");
		assert.equal(restored, original);
		assert.equal((api.match(/return EdgeCounter.call\(/gu) ?? []).length, 6);
		assert.ok(counter.includes('Path.of("/consumer/component.jar")'));
		assert.ok(counter.includes('throw error;'));
		assert.doesNotMatch(api + counter, /setProperty|Unsafe|setAccessible|libraryLookup/u);
	}
	const script = finContainerEdgeJvmGdbScript({ nativeDirectory: "/original/native", extractionRoot: "/run/tmp", libraries: { "libedge.so": "a".repeat(64) } });
	for(const control of ['os.O_EXCL | os.O_NOFOLLOW', 'state["failure"] is not None', 'definitions(name) != [address]', 'gdb.solib_name(found[0])'])
	{ assert.ok(finContainerEdgeGdbScript.includes(control)); assert.ok(script.includes(control)); }
	assert.ok(script.includes("os.O_RDONLY | os.O_NOFOLLOW"));
	assert.ok(script.includes("jvm_finished()"));
	await assert.rejects(finContainerEdgeJvmProbe(model, model.component, "python", "/a"), assert.AssertionError);
	await assert.rejects(finContainerEdgeJvmProbe(model, model.component, "java", "relative"), assert.AssertionError);
});

test("real Java and Kotlin edge calls use unchanged JAR extraction with measured native entries", { skip: process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST !== "1" }, async t => {
	const fixture = await finContainerEdgeJvmFixture(t);
	const { root, environment, model, nativeDirectory, libraries, handoff, packages } = fixture;
	for(const profile of ["java", "kotlin"])
	{
		const consumer = join(root, `${profile}-consumer`);
		const installation = await installCopiedConsumer({ profile, consumer
			, handoff, packages, environment
			, fixture: { source: () => finContainerEdgeConsumer(profile), success: "fin-container-ok", expectedChecks: finContainerEdgeJvmChecks[profile], installJvm: installFinContainerEdgeJvm } });
		const relocated = await repeatFinContainerEdges({ profile, consumer
			, handoff, packages, command: installation.command
			, jvmEnvironment: installation.jvmEnvironment });
		assert.equal(relocated.exactPackageFiles, true);
		const jvmEnvironment = { ...installation.jvmEnvironment, root: join(consumer, `${profile}-relocated`) };
		const jar = join(jvmEnvironment.root, "component.jar");
		const source = await finContainerEdgeJvmProbe(model, model.component, profile, jar);
		const probe = join(root, `${profile}-probe`); await mkdir(probe);
		await saveLakeFile(probe, "EdgeCounter.java", source.counter);
		await saveLakeFile(probe, "EdgeApi.java", source.api);
		await saveLakeFile(probe, profile === "java" ? "consumer.java" : "consumer.kt", source.consumer);
		await runCopied(environment.LEAN_BRIDGE_JAVAC, ["--release", "22", "-Werror", "-proc:none", "-cp", jar, "-d", "classes", "EdgeCounter.java", "EdgeApi.java", ...profile === "java" ? ["consumer.java"] : []], probe);
		if(profile === "kotlin")
			await runCopied(environment.LEAN_BRIDGE_KOTLINC, ["-Werror", "-jvm-target", "22", "-cp", jar + ":classes", "consumer.kt", "-include-runtime", "-d", "consumer.jar"], probe, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", JAVA_HOME: dirname(dirname(installation.command)) });
		const probeFiles = {};
		for(const path of await nativeArtifactPaths(probe)) probeFiles[path] = sha256(await readFile(join(probe, path)));
		const observer = await prepareFinContainerEdgeJvmGdb({ model
			, component: model.component, nativeDirectory, libraries
			, probeRoot: join(probe, "gdb"), cwd: probe
			, env: { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1" }
			, argv: ({ record, nonce, configSha256, definerIndices, extractionRoot }) => [installation.command
				, "--enable-native-access=ALL-UNNAMED"
				, `-Djava.io.tmpdir=${extractionRoot}`, "-cp"
				, `${jar}:classes${profile === "kotlin" ? ":consumer.jar" : ""}`
				, profile === "java" ? "Consumer" : "ConsumerKt"
				, record, nonce, configSha256, definerIndices.join(",")] });
		const absent = await observer.run({ gdb: false });
		assert.equal(absent.code, 2); assert.equal(absent.stdout, ""); assert.equal(absent.stderr, "edge record is not attached with empty counters\n");
		const run = await observer.run(); assert.equal(run.code, 0, run.output + run.stderr);
		const rows = readFinContainerEdgeJvm(run.stdout, profile);
		const manifest = await assertFinContainerEdgeJvmGdbRun(observer, run, rows, libraries);
		const again = await observer.run(); assert.equal(again.code, 0, again.output + again.stderr);
		assert.equal(again.stdout, run.stdout);
		const repeated = await assertFinContainerEdgeJvmGdbRun(observer, again, readFinContainerEdgeJvm(again.stdout, profile), libraries);
		assert.notEqual(manifest.pid, repeated.pid); assert.notEqual(run.nonce, again.nonce);
		assert.notEqual(run.extractionRoot, again.extractionRoot);
		const site = '            state["entries"][self.column] += 1';
		for(const replacement of [
			'            if self.column != 6:\n                state["entries"][self.column] += 1'
			, '            if self.column != 0:\n                state["entries"][self.column] += 1'
			, site + '\n            state["entries"][0] += 1'
		]) {
			const result = await observer.run({ mutateScript: script => script.replace(site, replacement) });
			assert.equal(result.code, 5, result.output + result.stderr);
			assert.equal(result.stderr, "wrong JVM edge dispatch count\n");
		}
		for(const [before, after] of [
			['"entries": [0] * WIDTH', '"entries": [1] * WIDTH']
			, ['config["nonce"].encode()', 'b"0" * 32']
			, ['config["configSha256"].encode()', 'b"0" * 64']
		]) {
			const refusal = await observer.run({ mutateScript: script => script.replace(before, after) });
			assert.equal(refusal.code, 2, refusal.output + refusal.stderr); assert.equal(refusal.stdout, "");
		}
		for(const inject of [{ arm: true }, { write: 1 }])
		{
			const refusal = await observer.run({ inject }); assert.equal(refusal.code, 71, refusal.output);
		}
		for(const body of [
			'    jvm_policy["libraries"][libraries[0]] = "0" * 64'
			, '    jvm_policy["extractionRoot"] += "-foreign"'
		]) {
			const refusal = await observer.run({ mutateScript: script => script.replace("def jvm_discover(filename):", "def jvm_discover(filename):\n" + body) });
			assert.equal(refusal.code, 71, refusal.output); assert.notEqual(refusal.stderr, "");
		}
		const bytes = await readFile(run.armed);
		for(const mutate of [
			value => { value.jvmExtraction.parent += "foreign"; }
			, value => { value.jvmExtraction.libraries[Object.keys(libraries)[0]].sha256 = "0".repeat(64); }
			, value => { value.jvmExtraction.afterExit[Object.keys(libraries)[0]].linksAfterExit = 1; }
			, value => { delete value.jvmExtraction.afterExit[Object.keys(libraries)[0]]; }
		]) {
			const changed = structuredClone(manifest); mutate(changed);
			await writeFile(run.armed, canonicalJson(changed));
			await assert.rejects(assertFinContainerEdgeJvmGdbRun(observer, run, rows, libraries), assert.AssertionError);
		}
		await writeFile(run.armed, bytes);
		for(const [path, digest] of Object.entries(probeFiles)) assert.equal(sha256(await readFile(join(probe, path))), digest);
		await verifyFinContainerEdgeJvmEnvironment(jvmEnvironment);
		t.diagnostic(JSON.stringify({ profile, scope: "real Lean/JVM source fixture with synthetic JAR receipt, not canonical installed acceptance", checks: finContainerEdgeJvmChecks[profile], calls: rows.length, finalCounts: rows.at(-1)[3], stdoutSha256: sha256(run.stdout), coldProcesses: 2, normalExtractionCheckedBeforeAndAfterExit: true }));
	}
});
