/**
 * Independently reconcile value-index JVM sources, models, Maven package,
 * probes and complete Java/Kotlin executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	reviewedContractDifference, reviewedSourceSelection
} from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	validatePackageSetReceipt
} from "../../src/release/package-set-receipt.mjs";
import {
	checkedRecordValueIndexFixtureRoot, checkedRecordValueIndexModule
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	assertCheckedRecordValueIndexProvenance
} from "./checked-record-value-index-browser-report.mjs";
import {
	checkedRecordValueIndexJvmCaller, checkedRecordValueIndexJvmCounts
	, checkedRecordValueIndexJvmProfiles, checkedRecordValueIndexJvmRoutes
	, checkedRecordValueIndexJvmSelection, parseCheckedRecordValueIndexJvmResult
} from "./checked-record-value-index-jvm-fixture.mjs";
import {
	inspectCheckedRecordValueIndexJvmPackage
} from "./checked-record-value-index-jvm-package.mjs";
import {
	checkCheckedRecordValueIndexJvmProbe
	, checkCheckedRecordValueIndexKotlinNullProbe
} from "./checked-record-value-index-jvm-probe.mjs";

const original = (commit, path) => execFileSync(
	"git", ["show", `${commit}:${path}`], { maxBuffer: 32 * 1024 ** 2 });
const buildRecords = route => [
	"model.json", "native-jvm.json", "package-set-receipt.json"
	, "author-inputs.json", `${checkedRecordValueIndexModule}.lean`
	, "lean-bridge.exports.json"
	, ...route.endsWith("reviewed-ir") ? ["api.binding-ir.json"] : []
];
const exactKeys = (value, keys) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort());

/**
 * Enumerate package members retained from the original closed JAR.
 *
 * @param receipt - Authenticated embedded package receipt.
 */
export const checkedRecordValueIndexJvmRetainedMembers = receipt => [
	...Object.keys(receipt.files), "META-INF/lean-bridge/package-receipt.json"
].sort();

/**
 * Verify one complete selection using only retained records and original Git.
 *
 * @param read - Selection-relative closed byte reader.
 * @param options - Independent source and host identities.
 * @param options.route - Exact author/API route.
 * @param options.producerCommit - Immutable producer revision.
 * @param options.consumerCommit - Immutable caller revision.
 * @param options.runtime - Independently observed host runtime.
 * @param options.floor - Explicit glibc package floor.
 * @param options.javaVersion - Independently measured Java identity.
 */
export const checkCheckedRecordValueIndexJvmReport = async (read, {
	route, producerCommit, consumerCommit, runtime, floor, javaVersion
}) => {
	assert.ok(checkedRecordValueIndexJvmRoutes.includes(route));
	for(const revision of [producerCommit, consumerCommit])
		assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "glibc", "platform"]);
	assert.equal(runtime.platform, "linux");
	assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u);
	assert.match(floor, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1])
		>= Number(floor.split(".")[1]));
	assert.match(javaVersion, /^(?:openjdk|java) 22[. ]/u);
	const json = async path => {
		const bytes = Buffer.from(await read(path)), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value)
			, `Noncanonical record: ${path}`);
		return value;
	};
	const report = await json("report.json");
	exactKeys(report, [
		"authorInputsUnchanged", "builds", "compilerFreeReplay", "consumerCommit"
		, "consumers"
		, "declaredGlibcFloor", "dispatch", "expectedBindingIrSha256"
		, "independentBuilds", "installation", "installerCommandLogs"
		, "loadCeiling", "offlineInstall", "producerCommit", "receipt"
		, "relocatedInstallation", "reproducible", "resourceChecks", "route"
		, "runtime", "schemaVersion", "sourceFreeDeployment"
		, "sourceRemovedBeforeInstallation", "trustedToolchains"
	]);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.consumerCommit, consumerCommit);
	assert.equal(report.independentBuilds, 2);
	assert.equal(report.declaredGlibcFloor, floor);
	for(const key of [
		"reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation"
		, "offlineInstall", "compilerFreeReplay", "relocatedInstallation"
		, "sourceFreeDeployment"
	]) assert.equal(report[key], true, key);
	assert.deepEqual(report.dispatch, {
		observed: false
		, reason: "No JVM constructor/source entry counters in this installed acceptance"
	});
	assert.equal(report.trustedToolchains
		, "Explicit JDK and Kotlin distributions; their complete contents are not authenticated");
	assert.equal(report.installerCommandLogs
		, "Closed installer retains package/source/output identities, not compiler stdout");
	const runtimeRecord = {
		platform: runtime.platform, arch: runtime.arch
		, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" }
	};
	assert.deepEqual(report.runtime, runtimeRecord);
	assert.deepEqual(await json("runtime.json"), runtimeRecord);
	assert.ok([6, 8, 10, 12].includes(report.loadCeiling));
	assert.equal(report.resourceChecks.length, 5);
	assert.deepEqual(await json("resources.json"), report.resourceChecks);
	for(const check of report.resourceChecks)
	{
		exactKeys(check, ["observations", "waits"]);
		assert.ok(Number.isSafeInteger(check.waits)
			&& check.waits >= 0 && check.waits <= 20);
		assert.equal(check.observations.length, check.waits + 1);
		for(const [index, sample] of check.observations.entries())
		{
			exactKeys(sample, ["availableBytes", "freeBytes", "load"]);
			for(const key of ["availableBytes", "freeBytes"])
				assert.ok(Number.isSafeInteger(sample[key])
					&& sample[key] >= 2 * 1024 ** 3);
			assert.ok(Number.isFinite(sample.load) && sample.load >= 0);
			assert.equal(sample.load < report.loadCeiling, index === check.waits);
		}
	}
	const selection = checkedRecordValueIndexJvmSelection(route);
	const expected = selection.expected, configuration = selection.configuration;
	assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]);
	const fixture = path => original(producerCommit
		, `${checkedRecordValueIndexFixtureRoot}/${path}`);
	const inputs = {
		"lean-bridge.exports.json": Buffer.from(canonicalJson(configuration))
	};
	for(const path of [
		`${checkedRecordValueIndexModule}.lean`, "lakefile.toml", "lean-toolchain"
		, "LICENSE", "package.json"
	]) inputs[path] = fixture(path);
	if(selection.reviewed)
		inputs["api.binding-ir.json"] = Buffer.from(canonicalJson(expected));
	let model, receipt, compiled;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, build = report.builds[attempt];
		model = await json(prefix + "model.json");
		receipt = await json(prefix + "package-set-receipt.json");
		compiled = await json(prefix + "native-jvm.json");
		validatePackageSetReceipt(receipt);
		validateBindingIr(model.bindingIr);
		assertCheckedRecordValueIndexProvenance(model.bindingIr);
		assert.deepEqual(receipt, report.receipt);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(model.profile, "native-library-v1");
		assert.deepEqual(model.exports.map(item => item.name).sort()
			, expected.declarations.map(item => item.source.declaration).sort());
		const source = inputs[`${checkedRecordValueIndexModule}.lean`];
		const identity = model.sourceIdentity;
		assert.deepEqual(await read(
			prefix + `${checkedRecordValueIndexModule}.lean`), source);
		assert.deepEqual(await json(prefix + "lean-bridge.exports.json")
			, configuration);
		assert.equal(identity.modules.length, 1);
		assert.equal(identity.modules[0].module, checkedRecordValueIndexModule);
		assert.deepEqual(identity.modules[0].source, {
			path: `${checkedRecordValueIndexModule}.lean`
			, bytes: source.length, sha256: sha256(source)
		});
		assert.equal(identity.exportConfigurationSource
			, canonicalJson(configuration));
		assert.equal(identity.exportConfigurationSha256
			, sha256(canonicalJson(configuration)));
		assert.equal(identity.extractorSha256, sha256(original(
			producerCommit, "src/analyze/NativeExports.lean")));
		for(const key of ["leanCompilerSha256", "sourceTreeSha256"])
			assert.match(identity[key], /^[a-f0-9]{64}$/u);
		let request = configuration;
		if(selection.reviewed)
		{
			assert.deepEqual(await json(prefix + "api.binding-ir.json"), expected);
			assert.equal(identity.reviewedBindingIr.source, canonicalJson(expected));
			assert.equal(identity.reviewedBindingIr.sourceSha256
				, sha256(canonicalJson(expected)));
			assert.equal(identity.reviewedBindingIr.semanticSha256
				, hashBindingIr(expected));
			request = reviewedSourceSelection(identity.reviewedBindingIr);
		}
		else assert.equal(identity.reviewedBindingIr, undefined);
		for(const key of ["contracts", "exports", "specializations"])
			assert.deepEqual(identity.request[key], request[key]);
		const snapshot = await json(prefix + "author-inputs.json");
		assert.deepEqual(snapshot.map(item => item.path), Object.keys(inputs).sort());
		for(const item of snapshot)
		{
			assert.equal(item.sha256, sha256(inputs[item.path]), item.path);
			assert.equal(item.mode & 0o170000, 0o100000);
		}
		assert.equal(receipt.source.treeSha256, identity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.deepEqual(model.component, {
			id: "checkedrecordvalueindices@1.0.0"
			, name: "checkedrecordvalueindices", version: "1.0.0"
		});
		assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role])
			, [["maven", "component"]]);
		assert.deepEqual(build, {
			bindingIrSha256: model.bindingIrSha256
			, modelSha256: sha256(await read(prefix + "model.json"))
			, compiledSha256: sha256(await read(prefix + "native-jvm.json"))
			, receiptSha256: sha256(await read(
				prefix + "package-set-receipt.json"))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
				pkg.artifacts.map(item => [item.path, item.sha256])
			))
		});
	}
	assert.deepEqual(await json("build-1/native-jvm.json")
		, await json("build-0/native-jvm.json"));
	assert.deepEqual(await json("handoff/package-set-receipt.json"), receipt);
	const receiptBytes = await read("handoff/package-set-receipt.json");
	assert.equal((await read(
		"handoff/package-set-receipt.json.sha256"
	)).toString(), `${sha256(receiptBytes)}  package-set-receipt.json\n`);
	const pkg = receipt.packages[0];
	const installation = inspectCheckedRecordValueIndexJvmPackage(
		await read("handoff/archives/checkedrecordvalueindices-1.0.0.jar")
		, { pkg, model, compiled, floor, route });
	assert.deepEqual(await json("installation.json"), installation);
	assert.deepEqual(report.installation, installation);
	const pom = '<?xml version="1.0" encoding="UTF-8"?>\n'
		+ '<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion>'
		+ '<groupId>org.leanbridge</groupId><artifactId>checkedrecordvalueindices</artifactId><version>1.0.0</version>'
		+ '<description>Compiled Lean API with generated Java conversions and native runtime.</description>'
		+ '<properties><maven.compiler.release>22</maven.compiler.release><project.build.sourceEncoding>UTF-8</project.build.sourceEncoding></properties>'
		+ '<dependencies><dependency><groupId>org.jetbrains.kotlin</groupId><artifactId>kotlin-stdlib</artifactId><version>2.2.0</version></dependency></dependencies></project>\n';
	const pomBytes = await read(
		"handoff/archives/checkedrecordvalueindices-1.0.0.pom");
	assert.equal(pomBytes.toString(), pom);
	const pomArtifact = pkg.artifacts.find(item => item.path.endsWith(".pom"));
	assert.deepEqual({
		bytes: pomArtifact.bytes, sha256: pomArtifact.sha256
	}, { bytes: Buffer.byteLength(pom), sha256: sha256(pom) });
	assert.deepEqual(report.consumers.map(item => item.profile)
		, checkedRecordValueIndexJvmProfiles);
	const records = [
		"report.json", "runtime.json", "resources.json", "configuration.json"
		, "expected.binding-ir.json", "consumer.java", "consumer.kt"
		, "installation.json", "handoff/package-set-receipt.json"
		, "handoff/package-set-receipt.json.sha256"
		, "handoff/archives/checkedrecordvalueindices-1.0.0.jar"
		, "handoff/archives/checkedrecordvalueindices-1.0.0.pom"
		, ...[0, 1].flatMap(index => buildRecords(route)
			.map(path => `build-${index}/${path}`))
		, ...checkedRecordValueIndexJvmRetainedMembers(installation.receipt)
			.map(path => "package/" + path)
	];
	const expectedCounts = checkedRecordValueIndexJvmCounts[
		selection.resultOnly ? "result-only" : "full"
	];
	for(const consumer of report.consumers)
	{
		const { profile } = consumer;
		const extension = profile === "java" ? "java" : "kt";
		const caller = await checkedRecordValueIndexJvmCaller(
			profile, route, path => original(consumerCommit, path));
		assert.deepEqual(await read(`consumer.${extension}`), Buffer.from(caller));
		assert.equal(consumer.context.profile, profile);
		assert.equal(consumer.context.archiveSha256
			, installation.artifact.sha256);
		assert.equal(consumer.javaVersion.code, 0);
		assert.equal(consumer.javaVersion.stderr, "");
		assert.equal(consumer.javaVersion.stdout, javaVersion);
		checkCheckedRecordValueIndexJvmProbe(consumer.apiProbe, profile, route);
		assert.deepEqual(await json(`${profile}/api-probe/record.json`)
			, consumer.apiProbe);
		const probeSource = profile === "java" ? "probe.java" : "probe.kt";
		records.push(`${profile}/api-probe/${probeSource}`
			, `${profile}/api-probe/record.json`
			, ...Object.keys(consumer.apiProbe.outputs).map(path =>
				`${profile}/api-probe/classes/${path}`));
		assert.equal(consumer.nullability.length, profile === "kotlin" ? 2 : 0);
		for(const probe of consumer.nullability)
		{
			checkCheckedRecordValueIndexKotlinNullProbe(
				probe, route, probe.invalid);
			const prefix = `${profile}/nullability-${probe.invalid}`;
			assert.deepEqual(await json(`${prefix}/record.json`), probe);
			records.push(`${prefix}/NullProbe.kt`, `${prefix}/record.json`
				, ...Object.keys(probe.outputs).map(path =>
					`${prefix}/classes/${path}`));
		}
		assert.deepEqual(consumer.observations.map(item => item.stage)
			, ["installed", "relocated", "source-free"]);
		for(const observation of consumer.observations)
		{
			assert.equal(observation.run.code, 0);
			assert.equal(observation.run.stderr, "");
			assert.deepEqual(observation.counts, expectedCounts);
			assert.deepEqual(parseCheckedRecordValueIndexJvmResult(
				observation.run.stdout, route), expectedCounts);
			if(observation.stage === "source-free")
				assert.equal(observation.sourcesRemoved, true);
			assert.deepEqual(await json(
				`${profile}/${observation.stage}.json`), observation);
			records.push(`${profile}/${observation.stage}.json`);
		}
	}
	assert.equal(new Set(records).size, records.length);
	return {
		route, producerCommit, consumerCommit, runtime, floor, javaVersion
		, recordCount: records.length, records: records.sort()
		, archiveSha256: installation.artifact.sha256
		, reportSha256: sha256(await read("report.json"))
		, counts: expectedCounts, profiles: checkedRecordValueIndexJvmProfiles
		, resultOnly: selection.resultOnly, reviewed: selection.reviewed
	};
};
