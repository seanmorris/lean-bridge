/**
 * Check original structural Jvm execution records without reopening historical paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validateKotlinCompilation } from "../../src/build/compile-jvm-sources.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { structuralSubtypeReview } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypeJvmConfiguration, structuralSubtypeJvmCounts, parseStructuralSubtypeJvmResult } from "./structural-subtype-jvm-fixture.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
export const structuralSubtypeJvmRecords = Object.freeze([
	"report.json", "expected.binding-ir.json", "configuration.json"
	, "consumer.java", "consumer.kt"
	, ...["java", "kotlin"].flatMap(profile => ["installed", "relocated"].map(position => `${profile}/${position}.json`))
	, ...[0, 1].flatMap(index => ["model.json", "native-jvm.json", "package-set-receipt.json", "StructuralSubtypes.lean"].map(path => `build-${index}/${path}`))
]);

/**
 * Require exact JVM author contracts, authenticated classpaths and relocated observations.
 *
 * @param read - Original route-relative record reader.
 * @param options - Independent frozen producer and route selection.
 * @param options.route - Ordinary or reviewed author configuration.
 * @param options.producerCommit - Actual installed producer revision.
 */
export const checkStructuralSubtypeJvmReport = async (read, { route, producerCommit }) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), `Original canonical record: ${path}`);
		return value;
	};
	const original = path => execFileSync("git", ["show", `${producerCommit}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
	const expected = structuralSubtypeReview(), configuration = structuralSubtypeJvmConfiguration(route), report = await json("report.json");
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.configuration, configuration); assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.independentBuilds, 2);
	for(const key of ["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation"]) assert.equal(report[key], true, key);
	assert.ok(["2.36", "2.38"].includes(report.declaredGlibcFloor));
	assert.deepEqual(report.dispatch, { observed: false, reason: "No JVM entry counters in this installed acceptance" });
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	for(const index of [0, 1])
	{
		const modelBytes = await read(`build-${index}/model.json`), model = await json(`build-${index}/model.json`);
		const receiptBytes = await read(`build-${index}/package-set-receipt.json`), receipt = await json(`build-${index}/package-set-receipt.json`);
		validatePackageSetReceipt(receipt); assert.deepEqual(receipt, report.receipt);
		assert.equal(model.profile, "native-library-v1"); assert.equal(model.pointerBits, 64); assert.equal(model.exports.length, 12);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		for(const declaration of expected.declarations)
		{
			const exported = model.exports.find(item => item.name === declaration.id.slice(5)); assert.ok(exported);
			assert.deepEqual(exported.refinements, declaration.source.extensions["lean-lang.org/refinements"]);
		}
		const source = await read(`build-${index}/StructuralSubtypes.lean`);
		assert.deepEqual(source, original("tests/fixtures/onboarding/structural-subtypes/StructuralSubtypes.lean"));
		assert.equal(model.sourceIdentity.modules.length, 1);
		assert.deepEqual(model.sourceIdentity.modules[0].source, { path: "StructuralSubtypes.lean", bytes: source.length, sha256: sha256(source) });
		assert.equal(model.sourceIdentity.extractorSha256, sha256(original("src/analyze/NativeExports.lean")));
		assert.equal(model.sourceIdentity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(model.sourceIdentity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.deepEqual(model.sourceIdentity.request.metadata.modules.map(item => item.sourceSha256), [sha256(source)]);
		digest(model.sourceIdentity.leanCompilerSha256);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.ok(!model.sourceIdentity.reviewedBindingIr);
		assert.equal(receipt.source.treeSha256, model.sourceIdentity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(pkg => pkg.target), ["maven"]);
		assert.deepEqual(report.builds[index], {
			modelSha256: sha256(modelBytes), receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256])))
		});
	}
	const model = await json("build-0/model.json"), pkg = report.receipt.packages[0];
	const artifact = pkg.artifacts.find(item => item.path.endsWith(".jar")); assert.ok(artifact);
	assert.deepEqual(pkg.artifacts.map(item => item.path).sort(), ["archives/structuralsubtypes-1.0.0.jar", "archives/structuralsubtypes-1.0.0.pom"]);
	assert.deepEqual(report.consumers.map(item => item.profile), ["java", "kotlin"]);
	const compiled = await json("build-0/native-jvm.json");
	assert.deepEqual(await json("build-1/native-jvm.json"), compiled);
	assert.equal(compiled.bindingIrSha256, model.bindingIrSha256);
	assert.equal(compiled.namespace, "org.leanbridge.structuralsubtypes");
	assert.equal(compiled.profile, "native-library-v1"); assert.equal(compiled.schemaVersion, 1);
	assert.match(compiled.compiler, /^javac 22[. ]/u);
	validateKotlinCompilation(compiled.kotlin, compiled.namespace);
	for(const consumer of report.consumers)
	{
		const { profile, installed, observations } = consumer, extension = profile === "java" ? "java" : "kt";
		const source = original("tests/fixtures/structural-subtype-consumers/" + profile + "." + extension).toString();
		const caller = route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
		assert.equal((await read("consumer." + extension)).toString(), caller);
		assert.equal(installed.consumerSha256, sha256(caller));
		assert.equal(installed.checks, structuralSubtypeJvmCounts.checks);
		assert.deepEqual(installed.result, structuralSubtypeJvmCounts);
		for(const key of ["offlineInstall", "compilerFreePath"]) assert.equal(installed[key], true, key);
		assert.match(consumer.javaVersion, /^(?:openjdk|java) 22[. ]/u);
		const environment = installed.jvmEnvironment;
		assert.equal(environment.profile, profile);
		assert.ok(environment.command.startsWith("/") && environment.root.startsWith("/"));
		digest(environment.interpreterSha256);
		assert.equal(environment.archiveSha256, artifact.sha256);
		const receiptBytes = Buffer.from(environment.receiptBytes), receipt = JSON.parse(receiptBytes);
		assert.equal(receiptBytes.toString(), canonicalJson(receipt));
		assert.equal(receipt.kind, "lean-bridge-ordinary-maven-package");
		assert.equal(receipt.ecosystem, "maven"); assert.equal(receipt.schemaVersion, 1);
		assert.equal(receipt.name, "org.leanbridge:structuralsubtypes"); assert.equal(receipt.version, "1.0.0");
		assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
		assert.equal(receipt.namespace, "org.leanbridge.structuralsubtypes");
		assert.deepEqual(receipt.kotlin, { namespace: "org.leanbridge.structuralsubtypes.kotlin", standardLibraryVersion: "2.2.0" });
		assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
		assert.equal(receipt.glibcMinimumVersion, report.declaredGlibcFloor);
		assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
		assert.deepEqual(receipt.component, model.component);
		const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
		assert.deepEqual(receipt.files["META-INF/lean-bridge/component/model.json"], identity(await read("build-0/model.json")));
		assert.deepEqual(receipt.files["META-INF/lean-bridge/native-jvm.json"], identity(await read("build-0/native-jvm.json")));
		assert.equal(receipt.compiledProjectionSha256, sha256(canonicalJson(compiled)));
		for(const [path, entry] of Object.entries(compiled.files))
		{
			if(path.startsWith("classes/")) assert.deepEqual(receipt.files[path.slice(8)], entry);
			if(path.startsWith("src/") || path === "binding-manifest.json") assert.deepEqual(receipt.files["META-INF/lean-bridge/jvm/" + path], entry);
		}
		for(const path of ["org/leanbridge/structuralsubtypes/Api.class"
			, "org/leanbridge/structuralsubtypes/kotlin/Api.class"
			, "META-INF/" + compiled.kotlin.module + ".kotlin_module"])
			assert.ok(receipt.files[path]?.bytes > 0, "Required public JVM API: " + path);
		for(const path of Object.keys(receipt.files))
			assert.ok(!/^META-INF\/(?:services\/|versions\/|INDEX\.LIST$)/u.test(path) && path !== "module-info.class");
		assert.deepEqual(receipt.files["META-INF/MANIFEST.MF"], identity(Buffer.from("Manifest-Version: 1.0\n\n")));
		const payload = { ...receipt.files, "META-INF/lean-bridge/package-receipt.json": identity(receiptBytes) };
		assert.equal(environment.packageFileSetSha256, sha256(canonicalJson(Object.keys(payload).sort())));
		assert.deepEqual(environment.files["component.jar"], { bytes: artifact.bytes, sha256: artifact.sha256 });
		assert.deepEqual(environment.files["consumer." + extension], identity(Buffer.from(caller)));
		const outputs = Object.keys(environment.files).filter(path => !["component.jar", "consumer." + extension].includes(path));
		if(profile === "java")
		{
			assert.ok(outputs.includes("classes/Consumer.class"));
			for(const path of outputs) assert.match(path, /^classes\/Consumer(?:\$[A-Za-z0-9_$]+)?\.class$/u);
		}
		else assert.deepEqual(outputs, ["consumer.jar"]);
		for(const entry of Object.values({ ...payload, ...environment.files }))
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); digest(entry.sha256);
		}
		const closure = { receiptSha256: sha256(receiptBytes)
			, packageFileSetSha256: environment.packageFileSetSha256
			, classpathFilesSha256: sha256(canonicalJson(environment.files))
			, interpreterSha256: environment.interpreterSha256 };
		assert.equal(observations.length, 2);
		for(const [position, name] of ["installed", "relocated"].entries())
		{
			const observation = await json(profile + "/" + name + ".json"); assert.deepEqual(observation, observations[position]);
			assert.equal(observation.relocated, Boolean(position));
			assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, "");
			assert.deepEqual(parseStructuralSubtypeJvmResult(observation.run.stdout), structuralSubtypeJvmCounts);
			assert.deepEqual(observation.counts, structuralSubtypeJvmCounts);
			assert.deepEqual(observation.closure, closure);
		}
	}

	return {
		route, producerCommit
		, ...structuralSubtypeJvmCounts
		, executions: 4, profiles: ["java", "kotlin"], dispatchObserved: false
		, archives: report.builds[0].archives };
};
