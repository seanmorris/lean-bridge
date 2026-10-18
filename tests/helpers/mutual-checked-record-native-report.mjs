/**
 * Reconcile one complete installed C/C++ mutual checked-record run.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { pathToFileURL } from "node:url";
import {
	reviewedContractDifference, reviewedSourceSelection
} from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";
import {
	nominalPrimitiveSubtypeNativeGenerators as historicalGenerators
	, nominalPrimitiveSubtypeNativeOriginal as original
} from "./nominal-primitive-subtype-native-generators.mjs";
import {
	readOwnedPerlCallbackVariantTar as readRepositoryTar
} from "./owned-perl-callback-result-variant-archives.mjs";

export const mutualCheckedRecordNativeRoutes = Object.freeze([
	"ordinary", "reviewed"
]);
export const mutualCheckedRecordNativeProfiles = Object.freeze(["c", "cpp"]);
export const mutualCheckedRecordNativeChecks = Object.freeze({ c: 71, cpp: 23 });

const mutualCheckedRecordFixtureRoot
	= "tests/fixtures/onboarding/mutual-checked-records";
const mutualCheckedRecordModule = "MutualCheckedRecords";

const component = Object.freeze({
	id: "mutualcheckedrecords@1.0.0"
	, name: "mutualcheckedrecords"
	, version: "1.0.0"
});
const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label);
const canonical = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label);
	return value;
};
const digest = value => {
	assert.match(value, /^[a-f0-9]{64}$/u);
	return value;
};
const expectedResult = profile => ({
	code: 0, stderr: ""
	, stdout: `mutual-checked-record-ok:${mutualCheckedRecordNativeChecks[profile]}\n`
});
const fixturePath = path => `${mutualCheckedRecordFixtureRoot}/${path}`;
const historicalFixtures = new Map();

/**
 * Load the exact fixture specification and its relative module closure from the
 * producer revision. The verifier must not reinterpret old output through a
 * newer checkout's configuration, reviewed IR or refinements.
 *
 * @param producerCommit - Exact producing Git commit.
 */
export const mutualCheckedRecordNativeFixture = producerCommit => {
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	if(!historicalFixtures.has(producerCommit)) historicalFixtures.set(
		producerCommit, (async () => {
			const entry = "tests/helpers/mutual-checked-record-fixture.mjs";
			const closure = new Map();
			const visit = path => {
				assert.ok(/^(?:src|tests)\//u.test(path)
					&& posix.normalize(path) === path, path);
				if(closure.has(path)) return;
				const bytes = original(producerCommit, path), source = bytes.toString();
				closure.set(path, bytes);
				for(const specifier of moduleSpecifiers(source, path))
				{
					const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
					visit(posix.extname(joined) === "" ? `${joined}.mjs` : joined);
				}
			};
			visit(entry);
			const directory = await mkdtemp(join(
				tmpdir(), "lean-bridge-mutual-checked-record-fixture-"));
			try
			{
				for(const [path, bytes] of closure)
					await saveLakeFile(directory, path, bytes);
				const fixture = await import(pathToFileURL(join(directory, entry)).href);
				assert.equal(fixture.mutualCheckedRecordFixtureRoot
					, mutualCheckedRecordFixtureRoot);
				assert.equal(fixture.mutualCheckedRecordModule, mutualCheckedRecordModule);
				for(const name of [
					"mutualCheckedRecordConfiguration", "mutualCheckedRecordReview"
				]) assert.equal(typeof fixture[name], "function", name);
				assert.ok(fixture.mutualCheckedRecordRefinements
					&& typeof fixture.mutualCheckedRecordRefinements === "object");
				return fixture;
			}
			finally
			{ await rm(directory, { recursive: true }); }
		})());
	return historicalFixtures.get(producerCommit);
};

/**
 * Exact checked-in caller text passed to one installed package.
 *
 * @param profile - C or C++ consumer profile.
 * @param producerCommit - Exact producing Git commit.
 */
export const mutualCheckedRecordNativeConsumer = (profile, producerCommit) => {
	assert.ok(mutualCheckedRecordNativeProfiles.includes(profile));
	const source = original(producerCommit
		, `tests/fixtures/mutual-checked-record-consumers/${profile}.${profile}`);
	return Buffer.concat([
		Buffer.from('#define MUTUAL_CHECKED_PARAMETER "arg0"\n'), source
	]);
};

/**
 * Name the complete original record set for one route.
 *
 * @param route - Ordinary source or reviewed Binding IR.
 * @param receipt - Independently authenticated package-set receipt.
 */
export const mutualCheckedRecordNativeRecords = (route, receipt) => {
	assert.ok(mutualCheckedRecordNativeRoutes.includes(route));
	validatePackageSetReceipt(receipt);
	const build = [
		`${mutualCheckedRecordModule}.lean`, "author-inputs.json"
		, "lean-bridge.exports.json", "model.json", "package-set-receipt.json"
		, ...route === "reviewed" ? ["api.binding-ir.json"] : []
	];
	return [
		"report.json"
		, "runtime.json"
		, "configuration.json"
		, "expected.binding-ir.json"
		, ...[0, 1].flatMap(attempt => build.map(path => `build-${attempt}/${path}`))
		, ...mutualCheckedRecordNativeProfiles.flatMap(profile => [
			`consumers/${profile}.${profile}`, `${profile}/report.json`
		])
		, ...[
			"package-set-receipt.json", "package-set-receipt.json.sha256"
			, ...receipt.packages.flatMap(pkg => pkg.artifacts.map(item => item.path))
		].map(path => `handoff/${path}`)
	];
};

/**
 * Refuse missing, duplicate and additional retained records before reconciliation.
 *
 * @param actual - Relative file inventory observed by the caller.
 * @param route - Ordinary source or reviewed Binding IR.
 * @param receipt - Independently authenticated package-set receipt.
 */
export const assertMutualCheckedRecordNativeRecordPaths = (
	actual, route, receipt
) => assert.deepEqual([...actual].sort()
	, [...mutualCheckedRecordNativeRecords(route, receipt), "controls.json"].sort());

const expectedInputs = (route, producerCommit, fixture) => {
	const configuration = fixture.mutualCheckedRecordConfiguration(route);
	const values = {
		"lean-bridge.exports.json": Buffer.from(canonicalJson(configuration))
	};
	for(const path of [
		`${mutualCheckedRecordModule}.lean`, "lakefile.toml", "lean-toolchain"
		, "LICENSE", "package.json"
	]) values[path] = original(producerCommit, fixturePath(path));
	if(route === "reviewed")
		values["api.binding-ir.json"] = Buffer.from(canonicalJson(
			fixture.mutualCheckedRecordReview()));
	return values;
};

const checkModels = async ({ read, json, report, route, producerCommit }) => {
	const fixture = await mutualCheckedRecordNativeFixture(producerCommit);
	const expected = fixture.mutualCheckedRecordReview();
	const configuration = fixture.mutualCheckedRecordConfiguration(route);
	assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	const inputs = expectedInputs(route, producerCommit, fixture);
	const sourceInputs = Object.entries(inputs).sort(([left], [right]) =>
		left.localeCompare(right)).map(([path, bytes]) => ({
		path, bytes: bytes.length, sha256: sha256(bytes)
		}));
	const treeSha256 = sha256(sourceInputs.map(item =>
		`${item.sha256}  ${item.path}\n`).join(""));
	const license = sourceInputs.find(item => item.path === "LICENSE");
	const notices = {
		schemaVersion: 2, kind: "lean-bridge-source-notices"
		, packages: [{
			name: component.name
			, source: {
				kind: "root", sourceTreeSha256: treeSha256, inputs: sourceInputs
			}
			, configurationSource: canonicalJson(configuration)
			, notices: [{
				...license, payload: `source-notices/${license.sha256}.txt`
			}]
		}]
	};
	assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]
		, "Independent author roots must reproduce exact identities");
	let model, receipt;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, build = report.builds[attempt];
		const modelBytes = await read(prefix + "model.json");
		const receiptBytes = await read(prefix + "package-set-receipt.json");
		model = await json(prefix + "model.json");
		receipt = await json(prefix + "package-set-receipt.json");
		validateBindingIr(model.bindingIr);
		validatePackageSetReceipt(receipt);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(model.profile, "native-library-v1");
		assert.equal(model.pointerBits, 64);
		assert.equal(model.byteOrder, "little");
		assert.equal(model.schemaVersion, route === "reviewed" ? 5 : 4);
		assert.deepEqual(model.component, component);
		assert.deepEqual(model.exports.map(item => item.name).sort()
			, expected.declarations.map(item => item.id.slice(5)).sort());
		for(const item of model.exports)
		{
			assert.deepEqual(item.refinements
				, fixture.mutualCheckedRecordRefinements[item.name], item.name);
			assert.doesNotMatch(JSON.stringify(item.refinements.result)
				, /"constructor":"[A-Za-z]+CheckedRecords\./u
				, `${item.name} result selects no constructor`);
		}
		const source = inputs[`${mutualCheckedRecordModule}.lean`];
		const identity = model.sourceIdentity;
		assert.deepEqual(await read(prefix + `${mutualCheckedRecordModule}.lean`), source);
		assert.deepEqual(await json(prefix + "lean-bridge.exports.json"), configuration);
		assert.equal(identity.modules.length, 1);
		assert.deepEqual(identity.modules[0].source, {
			path: `${mutualCheckedRecordModule}.lean`, bytes: source.length
			, sha256: sha256(source)
		});
		assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(identity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.equal(identity.extractorSha256
			, sha256(original(producerCommit, "src/analyze/NativeExports.lean")));
		digest(identity.leanCompilerSha256);
		assert.match(identity.leanCommit, /^[a-f0-9]{40}$/u);
		const toolchain = inputs["lean-toolchain"].toString().trim();
		assert.equal(identity.leanVersion, toolchain.split(":v").at(-1));
		assert.equal(identity.sourceTreeSha256, treeSha256);
		assert.equal(identity.sourceNoticesSha256, sha256(canonicalJson(notices)));
		assert.equal(identity.lakeDependencies, undefined);
		assert.deepEqual(identity.request.metadata.modules.map(item => item.sourceSha256)
			, [sha256(source)]);
		assert.equal(identity.request.metadata.toolchain, toolchain);
		let selection = configuration;
		if(route === "reviewed")
		{
			assert.deepEqual(await json(prefix + "api.binding-ir.json"), expected);
			assert.equal(identity.reviewedBindingIr.path, "api.binding-ir.json");
			assert.equal(identity.reviewedBindingIr.source, canonicalJson(expected));
			assert.equal(identity.reviewedBindingIr.sourceSha256, sha256(canonicalJson(expected)));
			assert.equal(identity.reviewedBindingIr.semanticSha256, hashBindingIr(expected));
			selection = reviewedSourceSelection(identity.reviewedBindingIr);
		}
		else assert.equal(identity.reviewedBindingIr, undefined);
		for(const key of ["contracts", "exports", "specializations"])
			assert.deepEqual(identity.request[key], selection[key]);
		for(const key of ["arities", "resources"])
			assert.deepEqual(identity.request[key], []);
		for(const key of ["modules", "exportModules"])
			assert.deepEqual(identity.request[key], [mutualCheckedRecordModule]);
		assert.equal(identity.request.profile, "native-library-v1");
		const snapshot = await json(prefix + "author-inputs.json");
		assert.deepEqual(snapshot.map(item => item.path), Object.keys(inputs).sort());
		for(const item of snapshot)
		{
			exactKeys(item, ["path", "sha256", "mode", "mtime", "ctime"], item.path);
			assert.equal(item.sha256, sha256(inputs[item.path]));
			assert.equal(item.mode & 0o170000, 0o100000);
			assert.ok(Number.isFinite(item.mtime) && item.mtime > 0);
			assert.ok(Number.isFinite(item.ctime) && item.ctime > 0);
		}
		assert.equal(receipt.source.treeSha256, identity.sourceTreeSha256);
		assert.deepEqual(receipt.component, component);
		assert.equal(receipt.profiles.length, 1);
		assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(pkg => pkg.target).sort()
			, [...mutualCheckedRecordNativeProfiles]);
		for(const pkg of receipt.packages)
			assert.equal(pkg.runtimeIdentity, receipt.profiles[0].runtimeIdentity);
		assert.deepEqual(build, {
			bindingIrSha256: model.bindingIrSha256, modelSha256: sha256(modelBytes)
			, receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
				pkg.artifacts.map(artifact => [artifact.path, artifact.sha256])))
		});
	}
	for(const path of [
		"model.json", "package-set-receipt.json"
		, `${mutualCheckedRecordModule}.lean`, "lean-bridge.exports.json"
		, ...route === "reviewed" ? ["api.binding-ir.json"] : []
	]) assert.deepEqual(await read(`build-0/${path}`), await read(`build-1/${path}`), path);
	return { model, receipt };
};

const checkPackages = async ({ read, model, receipt, floor, producerCommit }) => {
	const receiptBytes = await read("handoff/package-set-receipt.json");
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString()
		, `${sha256(receiptBytes)}  package-set-receipt.json\n`);
	const generators = await historicalGenerators(producerCommit), results = [];
	for(const pkg of receipt.packages)
	{
		const profile = pkg.target, name = component.name;
		assert.ok(mutualCheckedRecordNativeProfiles.includes(profile));
		assert.equal(pkg.ecosystem, profile);
		assert.equal(pkg.role, "component");
		assert.equal(pkg.profile, "native-library-v1");
		assert.equal(pkg.runtimeDelivery, "embedded");
		assert.deepEqual(pkg.requires, []);
		assert.equal(pkg.name, name);
		assert.equal(pkg.version, component.version);
		assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.runtimeIdentity, receipt.profiles[0].runtimeIdentity);
		const artifact = pkg.artifacts[0], root = `${name}-1.0.0-${profile}`;
		assert.equal(artifact.path, `archives/${root}.tar.gz`);
		const archive = await read(`handoff/${artifact.path}`);
		assert.equal(archive.length, artifact.bytes);
		assert.equal(sha256(archive), artifact.sha256);
		const files = readRepositoryTar(archive, root);
		const packageBytes = files.get("lean-bridge-package.json");
		const packaged = JSON.parse(packageBytes);
		assert.equal(packageBytes.toString(), canonicalJson(packaged));
		assert.equal(packaged.schemaVersion, 1);
		assert.equal(packaged.kind, "lean-bridge-native-c-package");
		assert.equal(packaged.ecosystem, profile);
		assert.equal(packaged.name, name);
		assert.equal(packaged.version, component.version);
		assert.equal(packaged.profile, "native-library-v1");
		assert.equal(packaged.runtimeIdentity, pkg.runtimeIdentity);
		assert.equal(packaged.bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(packaged.component, component);
		assert.equal(packaged.glibcMinimumVersion, floor);
		assert.equal(packaged.pkgConfig, name);
		assert.equal(packaged.cmakePackage, "LeanBridgeMutualcheckedrecords");
		assert.equal(packaged.cmakeTarget, "LeanBridge::mutualcheckedrecords");
		assert.equal(packaged.exactIntegers, profile === "c" ? "gmp-6.3.0" : undefined);
		assert.deepEqual([...files.keys()].sort()
			, [...Object.keys(packaged.files), "lean-bridge-package.json"].sort());
		for(const [path, record] of Object.entries(packaged.files))
		{
			const bytes = files.get(path);
			assert.deepEqual(record, { bytes: bytes.length, sha256: sha256(bytes) }, path);
		}
		const json = path => {
			const bytes = files.get(`share/lean-bridge/${path}`), value = JSON.parse(bytes);
			assert.equal(bytes.toString(), canonicalJson(value), path);
			return value;
		};
		assert.deepEqual(json("component/model.json"), model);
		assert.deepEqual(json("component/binding-ir.json"), model.bindingIr);
		const nativeComponent = json("component/native-component.json");
		const adapter = json("native-c-adapter.json"), runtime = json("runtime.json");
		assert.equal(sha256(canonicalJson(runtime)), packaged.runtimeIdentity);
		assert.equal(nativeComponent.runtimeIdentity, packaged.runtimeIdentity);
		assert.equal(adapter.runtimeIdentity, packaged.runtimeIdentity);
		assert.equal(nativeComponent.bindingIrSha256, model.bindingIrSha256);
		assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(nativeComponent.sourceIdentity, model.sourceIdentity);
		assert.equal(packaged.componentReceiptSha256
			, sha256(canonicalJson(nativeComponent)));
		assert.equal(packaged.adapterReceiptSha256, sha256(canonicalJson(adapter)));
		const libraries = {
			[`lib/${adapter.library}`]: adapter.files[`lib/${adapter.library}`]
			, [`lib/${nativeComponent.library}`]: nativeComponent.nativeLibrary
			, ...Object.fromEntries(Object.entries(runtime.files)
				.filter(([path]) => path.startsWith("lib/")))
			, ...profile === "c" ? Object.fromEntries(Object.entries(adapter.files)
				.filter(([path]) => path.startsWith("gmp/lib/"))
				.map(([path, file]) => [path.slice(4), file])) : {}
		};
		assert.deepEqual(Object.keys(packaged.files).filter(path =>
			path.startsWith("lib/") && !path.startsWith("lib/pkgconfig/")
			&& !path.startsWith("lib/cmake/")).sort(), Object.keys(libraries).sort());
		for(const [path, record] of Object.entries(libraries))
			assert.deepEqual(packaged.files[path]
				, { bytes: record.bytes, sha256: record.sha256 }, path);
		const raw = generators.generateCBindingPackage(model.bindingIr);
		const generated = profile === "c"
			? generators.generateGmpProjection(model.bindingIr).files
			: {
				...raw, ...generators.generateCppBindingPackage(model.bindingIr)
				, ...generators.boostSources()
			};
		for(const [path, source] of Object.entries(generated).filter(([path]) =>
			path.startsWith("include/") || path === "share/lean-bridge/boost.json"
			|| path.endsWith("Boost-LICENSE")))
			assert.equal(files.get(path)?.toString(), source, path);
		const headers = Object.keys(generated).filter(path => path.startsWith("include/"));
		if(profile === "c")
		{
			headers.push("include/gmp.h");
			const gmp = json("gmp.json");
			const source = files.get("share/lean-bridge/sources/gmp-6.3.0.tar.xz");
			assert.deepEqual(source, original(producerCommit, "src/backends/c/gmp.source.tar.xz"));
			assert.equal(gmp.version, "6.3.0");
			assert.equal(gmp.checked, true);
			assert.equal(gmp.sha256, sha256(source));
		}
		assert.deepEqual([...files.keys()].filter(path => path.startsWith("include/")).sort()
			, headers.sort());
		const sourceLicense = original(producerCommit, fixturePath("LICENSE"));
		const noticePath = "share/lean-bridge/licenses/source-notices.json";
		assert.equal(sha256(files.get(noticePath)), model.sourceIdentity.sourceNoticesSha256);
		const payloadPath = "share/lean-bridge/licenses/source-notices/"
			+ sha256(sourceLicense) + ".txt";
		assert.deepEqual(files.get(payloadPath), sourceLicense);
		const expectedPaths = [
			"README.md", "package-metadata.json", ...headers, ...Object.keys(libraries)
			, `lib/pkgconfig/${name}.pc`
			, ...["Config", "ConfigVersion"].map(suffix =>
				`lib/cmake/${packaged.cmakePackage}/${packaged.cmakePackage}${suffix}.cmake`)
			, ...["native-component.json", "model.json", "metadata.json"
				, "binding-ir.json", "generated.lean", "component.h"
				, "allocation-guard.h", "artifacts.json"]
				.map(path => `share/lean-bridge/component/${path}`)
			, "share/lean-bridge/runtime.json", "share/lean-bridge/native-c-adapter.json"
			, ...["Lean-LICENSE", "Lean-LICENSES", "LeanBridge-LICENSE"]
				.map(path => `share/lean-bridge/licenses/${path}`)
			, noticePath, payloadPath
			, ...profile === "c" ? [
				"share/lean-bridge/gmp.json"
				, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"
				, ...["COPYING", "COPYING.LESSERv3", "COPYINGv2", "COPYINGv3"]
					.map(path => `share/lean-bridge/licenses/GMP-${path}`)
			] : [
				"share/lean-bridge/boost.json"
				, "share/lean-bridge/licenses/Boost-LICENSE"
			]
		];
		assert.equal(new Set(expectedPaths).size, expectedPaths.length);
		assert.deepEqual(Object.keys(packaged.files).sort(), expectedPaths.sort());
		results.push({
			profile, artifact, receiptSha256: sha256(packageBytes)
			, packageFileSetSha256: sha256(canonicalJson([...files.keys()].sort()))
			, files: files.size
		});
	}
	return results;
};

/**
 * Authenticate all retained records for one ordinary or reviewed route.
 *
 * @param read - Reader relative to the route record directory.
 * @param options - Exact route, producer revision and observed host contract.
 */
export const checkMutualCheckedRecordNativeReport = async (read, options) => {
	const { route, producerCommit, runtime, floor } = options;
	assert.ok(mutualCheckedRecordNativeRoutes.includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.match(floor, /^2\.[0-9]+$/u);
	exactKeys(runtime, ["platform", "arch", "glibc"], "runtime option");
	assert.equal(runtime.platform, "linux");
	assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= Number(floor.split(".")[1]));
	const bytes = async path => Buffer.from(await read(path));
	const json = async path => canonical(await bytes(path), path);
	const reportBytes = await bytes("report.json");
	const report = canonical(reportBytes, "report.json");
	exactKeys(report, [
		"schemaVersion", "route", "profiles", "builds", "reports"
		, "producerCommit", "expectedBindingIrSha256", "runtime"
		, "declaredGlibcFloor", "authorInputsUnchanged", "reproducible"
		, "independentBuilds", "relocated", "sourceFree"
	], "report keys");
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, route);
	assert.deepEqual(report.profiles, [...mutualCheckedRecordNativeProfiles]);
	assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.reproducible, true);
	assert.equal(report.independentBuilds, 2);
	assert.equal(report.authorInputsUnchanged, true);
	assert.equal(report.relocated, true);
	assert.equal(report.sourceFree, true);
	assert.equal(report.declaredGlibcFloor, floor);
	const observedRuntime = {
		platform: runtime.platform, arch: runtime.arch
		, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" }
	};
	assert.deepEqual(report.runtime, observedRuntime);
	assert.deepEqual(await json("runtime.json"), observedRuntime);
	const { model, receipt } = await checkModels({
		read: bytes, json, report, route, producerCommit
	});
	assert.equal(report.reports.length, mutualCheckedRecordNativeProfiles.length);
	const observations = [];
	for(const profile of mutualCheckedRecordNativeProfiles)
	{
		const consumerPath = `consumers/${profile}.${profile}`;
		const consumer = await bytes(consumerPath);
		assert.deepEqual(consumer
			, mutualCheckedRecordNativeConsumer(profile, producerCommit));
		const profileReport = await json(`${profile}/report.json`);
		exactKeys(profileReport, [
			"profile", "route", "packages", "checks", "consumerSha256"
			, "relocatedReplay", "closure", "sourceRemovedBeforeInstallation"
			, "offlineInstall", "compilerFreeReplay"
			, "immutableCallerAssertions", "malformedDepthCycleRecovery"
		], `${profile} report keys`);
		assert.deepEqual(profileReport
			, report.reports.find(item => item.profile === profile));
		assert.equal(profileReport.route, route);
		assert.equal(profileReport.checks, mutualCheckedRecordNativeChecks[profile]);
		assert.equal(profileReport.consumerSha256, sha256(consumer));
		assert.deepEqual(profileReport.relocatedReplay, expectedResult(profile));
		assert.deepEqual(profileReport.packages
			, receipt.packages.filter(pkg => pkg.target === profile));
		for(const key of [
			"sourceRemovedBeforeInstallation", "offlineInstall"
			, "compilerFreeReplay", "immutableCallerAssertions"
			, "malformedDepthCycleRecovery"
		]) assert.equal(profileReport[key], true, `${profile}.${key}`);
		exactKeys(profileReport.closure
			, ["packageFileSetSha256", "receiptSha256"], `${profile}.closure`);
		digest(profileReport.closure.packageFileSetSha256);
		digest(profileReport.closure.receiptSha256);
		observations.push(profileReport);
	}
	const packages = await checkPackages({
		read: bytes, model, receipt, floor, producerCommit
	});
	for(const profileReport of observations)
	{
		const packageResult = packages.find(item => item.profile === profileReport.profile);
		assert.deepEqual(profileReport.closure, {
			packageFileSetSha256: packageResult.packageFileSetSha256
			, receiptSha256: packageResult.receiptSha256
		});
	}
	const recordPaths = mutualCheckedRecordNativeRecords(route, receipt).sort();
	return {
		route, producerCommit, runtime, floor, reportSha256: sha256(reportBytes)
		, bindingIrSha256: report.expectedBindingIrSha256, recordPaths, receipt
		, observations, packages, independentBuilds: report.independentBuilds
	};
};
