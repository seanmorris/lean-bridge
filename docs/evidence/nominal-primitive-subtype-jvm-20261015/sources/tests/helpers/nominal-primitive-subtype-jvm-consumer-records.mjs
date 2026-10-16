/**
 * Reconcile retained nineteen-base JVM callers, compiler probes and all three execution stages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeJvmCounts, parseNominalPrimitiveSubtypeJvmResult } from "./nominal-primitive-subtype-jvm-fixture.mjs";
import { nominalPrimitiveSubtypeJvmDeploymentFiles } from "./nominal-primitive-subtype-jvm-package.mjs";
import { checkNominalPrimitiveSubtypeJvmProbe, checkNominalPrimitiveSubtypeKotlinNullProbe } from "./nominal-primitive-subtype-jvm-probe.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { nominalSubtypeJvmOriginal } from "./nominal-subtype-jvm-generators.mjs";

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), expected.toSorted());
const processResult = (run, code) => {
	keys(run, ["code", "stdout", "stderr"]); assert.equal(run.code, code);
	assert.equal(typeof run.stdout, "string"); assert.equal(typeof run.stderr, "string");
};

/**
 * Rebuild the exact caller the producer compiled from the frozen fixture at its revision.
 *
 * @param revision - Full producer commit.
 * @param profile - Java or Kotlin public API.
 * @param route - Ordinary or reviewed author route.
 * @param mode - Full or result-only API.
 */
export const nominalPrimitiveSubtypeJvmCallerAt = (revision, profile, route, mode) => {
	let source = nominalSubtypeJvmOriginal(revision, `tests/fixtures/nominal-primitive-subtype-consumers/${profile}.${profile === "java" ? "java" : "kt"}`).toString();
	for(const section of ["FULL_ONLY", "RESULT_ONLY"])
	{
		const pattern = new RegExp(`^[ \\t]*// BEGIN ${section}\\n([\\s\\S]*?)^[ \\t]*// END ${section}\\n`, "gmu");
		assert.ok([...source.matchAll(pattern)].length > 0);
		const keep = mode === "full" ? section === "FULL_ONLY" : section === "RESULT_ONLY";
		source = source.replaceAll(pattern, (_, body) => keep ? body : "");
	}
	assert.doesNotMatch(source, /BEGIN (?:FULL|RESULT)_ONLY|END (?:FULL|RESULT)_ONLY/u);
	return route === "ordinary" ? source : source.replaceAll(/arg([01])\./gu, "value$1.");
};
const compilerOutputs = async (read, prefix, record) => {
	for(const [path, entry] of Object.entries(record.outputs))
	{
		assert.ok(posix.normalize(path) === path && !path.startsWith("../") && !path.startsWith("/"));
		assert.deepEqual(identity(await read(prefix + "/classes/" + path)), entry, path);
	}
};

/**
 * Require complete Java/Kotlin results and unchanged source-free bytecode identities.
 *
 * @param options - Independently selected original records and tools.
 * @param options.report - Complete installed producer report.
 * @param options.read - Selection-relative byte reader.
 * @param options.json - Canonical JSON reader.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.mode - Full or result-only API.
 * @param options.producerCommit - Full immutable source revision.
 * @param options.installation - Independently reconciled Maven receipt.
 * @param options.javaVersion - Independently pinned original Java version output.
 */
export const checkNominalPrimitiveSubtypeJvmConsumers = async ({ report, read, json, route, mode, producerCommit, installation, javaVersion }) => {
	assert.deepEqual(report.consumers.map(consumer => consumer.profile), ["java", "kotlin"]);
	const records = [];
	let executions = 0, checks = 0, rejections = 0, hostRejections = 0, snapshotControls = 0;
	for(const consumer of report.consumers)
	{
		keys(consumer, ["profile", "context", "javaVersion", "observations", "apiProbe", "nullability"]);
		const { profile, context } = consumer, extension = profile === "java" ? "java" : "kt";
		const caller = nominalPrimitiveSubtypeJvmCallerAt(producerCommit, profile, route, mode);
		assert.equal((await read("consumer." + extension)).toString(), caller);
		keys(context, ["root", "profile", "command", "interpreterSha256", "archiveSha256", "receiptBytes", "packageFileSetSha256", "files"]);
		assert.equal(context.profile, profile);
		assert.ok(posix.isAbsolute(context.root) && posix.isAbsolute(context.command));
		assert.equal(posix.basename(context.root), profile); assert.equal(posix.basename(context.command), "java");
		assert.match(context.interpreterSha256, /^[a-f0-9]{64}$/u);
		assert.equal(context.archiveSha256, installation.artifact.sha256);
		assert.equal(context.receiptBytes, installation.receiptBytes);
		assert.equal(context.packageFileSetSha256, installation.packageFileSetSha256);
		assert.deepEqual(context.files["component.jar"], { bytes: installation.artifact.bytes, sha256: installation.artifact.sha256 });
		assert.deepEqual(context.files["consumer." + extension], identity(caller));
		const deployed = nominalPrimitiveSubtypeJvmDeploymentFiles(context);
		processResult(consumer.javaVersion, 0); assert.equal(consumer.javaVersion.stderr, "");
		assert.equal(consumer.javaVersion.stdout, javaVersion);
		const closure = { receiptSha256: sha256(context.receiptBytes)
			, packageFileSetSha256: context.packageFileSetSha256
			, classpathFilesSha256: sha256(canonicalJson(context.files))
			, interpreterSha256: context.interpreterSha256 };
		const sourceFree = { files: deployed, classpathFilesSha256: sha256(canonicalJson(deployed)), interpreterSha256: context.interpreterSha256 };
		assert.equal(consumer.observations.length, 3);
		for(const [index, stage] of ["installed", "relocated", "source-free"].entries())
		{
			const path = profile + "/" + stage + ".json", observation = await json(path); records.push(path);
			assert.deepEqual(observation, consumer.observations[index]);
			keys(observation, ["stage", "cwd", "run", "counts", "closure", ...index === 2 ? ["sourcesRemoved"] : []]);
			assert.equal(observation.stage, stage);
			assert.equal(observation.cwd, context.root + (index === 0 ? "" : index === 1 ? "-relocated" : "-source-free"));
			assert.deepEqual(observation.closure, index === 2 ? sourceFree : closure);
			if(index === 2) assert.equal(observation.sourcesRemoved, true);
			processResult(observation.run, 0); assert.equal(observation.run.stderr, "");
			assert.deepEqual(observation.counts, nominalPrimitiveSubtypeJvmCounts[profile][mode]);
			parseNominalPrimitiveSubtypeJvmResult(observation.run.stdout, profile, mode);
			executions++;
			checks += observation.counts.checks; rejections += observation.counts.rejections;
			hostRejections += observation.counts.hostRejections; snapshotControls += observation.counts.snapshotControls;
		}
		const probe = await json(profile + "/api-probe/record.json"); assert.deepEqual(probe, consumer.apiProbe);
		keys(probe, ["profile", "mode", "command", "args", "cwd", "environment", "source", "sourceSha256", "archiveSha256", "run", "outputs"]);
		checkNominalPrimitiveSubtypeJvmProbe(probe, profile, mode); processResult(probe.run, mode === "full" ? 0 : 1);
		assert.equal(probe.archiveSha256, installation.artifact.sha256);
		if(mode === "full") assert.deepEqual(Object.keys(probe.outputs).sort(), profile === "java" ? ["Probe.class"] : ["META-INF/main.kotlin_module", "ProbeKt.class"]);
		assert.equal(probe.cwd, posix.join(posix.dirname(context.root), "probes", profile));
		const probeName = "probe." + extension;
		assert.equal((await read(profile + "/api-probe/" + probeName)).toString(), probe.source);
		if(profile === "java")
		{
			assert.equal(probe.command, posix.join(posix.dirname(context.command), "javac"));
			assert.deepEqual(probe.environment, copiedCleanEnvironment);
			assert.deepEqual(probe.args, ["--release", "22", "-Werror", "-proc:none", "-XDrawDiagnostics", "-cp", "component.jar", "-d", "classes", "probe.java"]);
		}
		else
		{
			assert.ok(posix.isAbsolute(probe.command)); assert.equal(posix.basename(probe.command), "kotlinc");
			assert.deepEqual(probe.environment, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", JAVA_HOME: posix.dirname(posix.dirname(context.command)) });
			assert.deepEqual(probe.args, ["-Werror", "-jvm-target", "22", "-Xrender-internal-diagnostic-names", "-cp", "component.jar", "probe.kt", "-d", "classes"]);
		}
		await compilerOutputs(read, profile + "/api-probe", probe);
		records.push(profile + "/api-probe/record.json", profile + "/api-probe/" + probeName
			, ...Object.keys(probe.outputs).map(path => profile + "/api-probe/classes/" + path));
		assert.equal(consumer.nullability.length, profile === "kotlin" ? 2 : 0);
		for(const [index, invalid] of (profile === "kotlin" ? [false, true] : []).entries())
		{
			const prefix = profile + `/nullability-${invalid}`, nullProbe = await json(prefix + "/record.json");
			assert.deepEqual(nullProbe, consumer.nullability[index]);
			keys(nullProbe, ["mode", "invalid", "command", "args", "cwd", "environment", "source", "sourceSha256", "archiveSha256", "run", "outputs"]);
			checkNominalPrimitiveSubtypeKotlinNullProbe(nullProbe, mode, invalid); processResult(nullProbe.run, invalid ? 1 : 0);
			assert.equal(nullProbe.archiveSha256, installation.artifact.sha256);
			assert.equal(nullProbe.command, probe.command); assert.deepEqual(nullProbe.environment, probe.environment);
			assert.equal(nullProbe.cwd, posix.join(posix.dirname(context.root), "probes", `nullability-${invalid}`));
			assert.deepEqual(nullProbe.args, ["-Werror", "-jvm-target", "22", "-Xrender-internal-diagnostic-names", "-cp", "component.jar", "NullProbe.kt", "-d", "classes"]);
			assert.equal((await read(prefix + "/NullProbe.kt")).toString(), nullProbe.source);
			if(!invalid) assert.deepEqual(Object.keys(nullProbe.outputs).sort(), ["META-INF/main.kotlin_module", "NullProbeKt.class"]);
			await compilerOutputs(read, prefix, nullProbe);
			records.push(prefix + "/record.json", prefix + "/NullProbe.kt"
				, ...Object.keys(nullProbe.outputs).map(path => prefix + "/classes/" + path));
		}
	}
	return { records, executions, checks, rejections, hostRejections, snapshotControls };
};
