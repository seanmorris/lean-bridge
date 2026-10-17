/**
 * Authenticate retained inherited checked-record C/C++ packages independently of
 * the producer harness.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import {
	reviewedContractDifference, reviewedSourceSelection
} from "../../src/analyze/reviewed-source.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	inheritedCheckedRecordFixture, inheritedCheckedRecordModule
	, inheritedCheckedRecordName
} from "./inherited-checked-record-fixture.mjs";
import {
	inheritedCheckedRecordNativeConfiguration, inheritedCheckedRecordNativeCounts
	, inheritedCheckedRecordNativeReview
} from "./inherited-checked-record-native-fixture.mjs";
import {
	nominalPrimitiveSubtypeNativeGenerators as historicalGenerators
	, nominalPrimitiveSubtypeNativeOriginal as original
} from "./nominal-primitive-subtype-native-generators.mjs";
import {
	readOwnedPerlCallbackVariantTar as readRepositoryTar
} from "./owned-perl-callback-result-variant-archives.mjs";

const profiles = Object.freeze(["c", "cpp"]);
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const exactKeys = (value, keys, label = "record") =>
	assert.deepEqual(Object.keys(value).sort(), keys.slice().sort(), label);

const nativeTree = tree => {
	if(tree === null || ["fin", "subtype"].includes(tree.kind)) return tree;
	if(["record", "checked-record"].includes(tree.kind)) return {
		kind: tree.kind, definition: tree.name
		, ...tree.kind === "checked-record" ? { constructor: tree.constructor } : {}
		, fields: tree.fields.map(field => field.name)
		, arguments: tree.fields.map(field => nativeTree(field.refinement))
	};
	if(tree.kind === "variant") return {
		kind: "variant", definition: tree.name
		, cases: tree.cases.map(branch => ({ name: branch.name
			, fields: branch.fields.map(field => field.name)
			, arguments: branch.fields.map(field => nativeTree(field.refinement)) }))
	};
	return { kind: tree.kind, arguments: tree.arguments.map(nativeTree) };
};

/**
 * Name the complete retained record set for one selection.
 *
 * @param route - Ordinary or reviewed author source.
 * @param receipt - Independently authenticated package-set receipt.
 */
export const inheritedCheckedRecordNativeRecords = (route, receipt) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	validatePackageSetReceipt(receipt);
	assert.deepEqual(receipt.packages.map(pkg => pkg.target), profiles);
	const build = ["model.json", "package-set-receipt.json", "author-inputs.json"
		, `${inheritedCheckedRecordModule}.lean`, "lean-bridge.exports.json"
		, ...route === "reviewed" ? ["api.binding-ir.json"] : []];
	return [
		"report.json", "resources.json", "runtime.json"
		, "configuration.json", "expected.binding-ir.json"
		, ...[0, 1].flatMap(attempt => build.map(path => `build-${attempt}/${path}`))
		, ...profiles.flatMap(profile => [`consumers/${profile}.${profile}`
			, ...["compiler.json", "lean-bridge-package.json", "installed.json"
				, "relocated.json", "report.json"].map(path => `${profile}/${path}`)])
		, ...["package-set-receipt.json", "package-set-receipt.json.sha256"
			, ...receipt.packages.flatMap(pkg => pkg.artifacts.map(file => file.path))]
			.map(path => "handoff/" + path)
	];
};

const checkResources = async (json, report, maxLoad) => {
	assert.ok([6, 8, 10, 12].includes(maxLoad));
	const resources = await json("resources.json");
	exactKeys(resources, ["maxLoad", "samples"], "resources");
	assert.equal(resources.maxLoad, maxLoad);
	assert.equal(resources.samples.length, 5);
	assert.deepEqual(report.resourceAdmission
		, { maxLoad, samples: resources.samples.length });
	for(const group of resources.samples)
	{
		exactKeys(group, ["observations", "waits"], "resource admission");
		assert.ok(Number.isInteger(group.waits) && group.waits >= 0 && group.waits <= 20);
		assert.equal(group.observations.length, group.waits + 1);
		for(const [index, observation] of group.observations.entries())
		{
			exactKeys(observation, ["availableBytes", "freeBytes", "load"]
				, "resource observation");
			assert.ok(observation.freeBytes >= 2 * 1024 ** 3);
			assert.ok(observation.availableBytes >= 2 * 1024 ** 3);
			assert.ok(Number.isFinite(observation.load) && observation.load >= 0);
			assert.equal(observation.load < maxLoad, index === group.observations.length - 1);
		}
	}
	return resources;
};

const checkModels = async ({ report, read, json, route, mode, producerCommit }) => {
	const expected = inheritedCheckedRecordNativeReview(mode);
	const configuration = inheritedCheckedRecordNativeConfiguration(route, mode);
	assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	const inputs = { "lean-bridge.exports.json": Buffer.from(canonicalJson(configuration)) };
	for(const path of [`${inheritedCheckedRecordModule}.lean`, "lakefile.toml"
		, "lean-toolchain", "LICENSE", "package.json"])
		inputs[path] = original(producerCommit, `${inheritedCheckedRecordFixture}/${path}`);
	if(route === "reviewed") inputs["api.binding-ir.json"] = Buffer.from(canonicalJson(expected));
	const sourceInputs = Object.entries(inputs).sort(([a], [b]) => a.localeCompare(b))
		.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }));
	const treeSha256 = sha256(sourceInputs.map(item =>
		item.sha256 + "  " + item.path + "\n").join(""));
	const license = sourceInputs.find(item => item.path === "LICENSE");
	const notices = { schemaVersion: 2, kind: "lean-bridge-source-notices"
		, packages: [{ name: inheritedCheckedRecordName
			, source: { kind: "root", sourceTreeSha256: treeSha256, inputs: sourceInputs }
			, configurationSource: canonicalJson(configuration)
			, notices: [{ ...license, payload: "source-notices/" + license.sha256 + ".txt" }] }] };
	let model, receipt;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, build = report.builds[attempt];
		const modelBytes = await read(prefix + "model.json");
		const receiptBytes = await read(prefix + "package-set-receipt.json");
		model = await json(prefix + "model.json");
		receipt = await json(prefix + "package-set-receipt.json");
		validateBindingIr(model.bindingIr); validatePackageSetReceipt(receipt);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(model.profile, "native-library-v1"); assert.equal(model.pointerBits, 64);
		assert.equal(model.byteOrder, "little");
		assert.equal(model.schemaVersion, route === "reviewed" ? 3 : 2);
		assert.deepEqual(model.component, {
			id: `${inheritedCheckedRecordName}@1.0.0`
			, name: inheritedCheckedRecordName
			, version: "1.0.0"
		});
		assert.deepEqual(model.exports.map(item => item.name).sort()
			, expected.declarations.map(item => item.id.slice(5)).sort());
		for(const declaration of expected.declarations)
		{
			const item = model.exports.find(value => value.name === declaration.id.slice(5));
			const tree = declaration.source.extensions["lean-lang.org/refinements"];
			assert.deepEqual(item.refinements, {
				parameters: tree.parameters.map(nativeTree), result: nativeTree(tree.result)
			});
		}
		const source = inputs[`${inheritedCheckedRecordModule}.lean`], identity = model.sourceIdentity;
		assert.deepEqual(await read(prefix + `${inheritedCheckedRecordModule}.lean`), source);
		assert.deepEqual(await json(prefix + "lean-bridge.exports.json"), configuration);
		assert.equal(identity.modules.length, 1);
		assert.deepEqual(identity.modules[0].source, {
			path: `${inheritedCheckedRecordModule}.lean`
			, bytes: source.length
			, sha256: sha256(source)
		});
		assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(identity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.equal(identity.extractorSha256
			, sha256(original(producerCommit, "src/analyze/NativeExports.lean")));
		digest(identity.leanCompilerSha256);
		assert.equal(identity.sourceTreeSha256, treeSha256);
		assert.equal(identity.sourceNoticesSha256, sha256(canonicalJson(notices)));
		assert.equal(identity.lakeDependencies, undefined);
		assert.deepEqual(identity.request.metadata.modules.map(item => item.sourceSha256)
			, [sha256(source)]);
		assert.equal(identity.request.metadata.toolchain, inputs["lean-toolchain"].toString().trim());
		let selection = configuration;
		if(route === "reviewed")
		{
			assert.deepEqual(await json(prefix + "api.binding-ir.json"), expected);
			assert.equal(identity.reviewedBindingIr.source, canonicalJson(expected));
			assert.equal(identity.reviewedBindingIr.sourceSha256, sha256(canonicalJson(expected)));
			assert.equal(identity.reviewedBindingIr.semanticSha256, hashBindingIr(expected));
			selection = reviewedSourceSelection(identity.reviewedBindingIr);
		}
		else assert.equal(identity.reviewedBindingIr, undefined);
		for(const key of ["contracts", "exports", "specializations"])
			assert.deepEqual(identity.request[key], selection[key]);
		for(const key of ["arities", "resources"]) assert.deepEqual(identity.request[key], []);
		for(const key of ["modules", "exportModules"])
			assert.deepEqual(identity.request[key], [inheritedCheckedRecordModule]);
		assert.equal(identity.request.profile, "native-library-v1");
		const snapshot = await json(prefix + "author-inputs.json");
		assert.deepEqual(snapshot.map(item => item.path), Object.keys(inputs).sort());
		for(const item of snapshot)
		{
			assert.equal(item.sha256, sha256(inputs[item.path]));
			assert.equal(item.mode & 0o170000, 0o100000);
			assert.ok(Number.isFinite(item.mtime) && item.mtime > 0);
			assert.ok(Number.isFinite(item.ctime) && item.ctime > 0);
		}
		assert.equal(receipt.source.treeSha256, identity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.equal(receipt.profiles.length, 1);
		assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(pkg => pkg.target), profiles);
		for(const pkg of receipt.packages)
			assert.equal(pkg.runtimeIdentity, receipt.profiles[0].runtimeIdentity);
		assert.deepEqual(build, {
			bindingIrSha256: model.bindingIrSha256, modelSha256: sha256(modelBytes)
			, receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
				pkg.artifacts.map(item => [item.path, item.sha256])))
		});
	}
	for(const path of ["model.json", "package-set-receipt.json"
		, `${inheritedCheckedRecordModule}.lean`, "lean-bridge.exports.json"
		, ...route === "reviewed" ? ["api.binding-ir.json"] : []])
		assert.deepEqual(await read(`build-0/${path}`), await read(`build-1/${path}`), path);
	return { model, receipt };
};

const checkPackages = async ({ read, model, receipt, floor, producerCommit }) => {
	const receiptBytes = await read("handoff/package-set-receipt.json");
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString()
		, sha256(receiptBytes) + "  package-set-receipt.json\n");
	const generators = await historicalGenerators(producerCommit), results = [];
	for(const pkg of receipt.packages)
	{
		const { target: profile } = pkg, name = inheritedCheckedRecordName;
		assert.ok(profiles.includes(profile)); assert.equal(pkg.ecosystem, profile);
		assert.equal(pkg.role, "component"); assert.equal(pkg.profile, "native-library-v1");
		assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
		assert.equal(pkg.name, name); assert.equal(pkg.version, "1.0.0");
		assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.runtimeIdentity, receipt.profiles[0].runtimeIdentity);
		const artifact = pkg.artifacts[0], root = `${name}-1.0.0-${profile}`;
		assert.equal(artifact.path, `archives/${root}.tar.gz`);
		const archive = await read("handoff/" + artifact.path);
		assert.equal(archive.length, artifact.bytes); assert.equal(sha256(archive), artifact.sha256);
		const files = readRepositoryTar(archive, root);
		const packageBytes = files.get("lean-bridge-package.json");
		const packaged = JSON.parse(packageBytes);
		assert.equal(packageBytes.toString(), canonicalJson(packaged));
		assert.deepEqual(await read(`${profile}/lean-bridge-package.json`), packageBytes);
		assert.equal(packaged.schemaVersion, 1);
		assert.equal(packaged.kind, "lean-bridge-native-c-package");
		assert.equal(packaged.ecosystem, profile); assert.equal(packaged.name, name);
		assert.equal(packaged.version, "1.0.0"); assert.equal(packaged.profile, "native-library-v1");
		assert.equal(packaged.runtimeIdentity, pkg.runtimeIdentity);
		assert.equal(packaged.bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(packaged.component, model.component);
		assert.equal(packaged.glibcMinimumVersion, floor);
		assert.equal(packaged.pkgConfig, name);
		assert.equal(packaged.cmakePackage, "LeanBridgeInheritedcheckedrecords");
		assert.equal(packaged.cmakeTarget, "LeanBridge::inheritedcheckedrecords");
		assert.equal(packaged.exactIntegers, profile === "c" ? "gmp-6.3.0" : undefined);
		assert.deepEqual([...files.keys()].sort()
			, [...Object.keys(packaged.files), "lean-bridge-package.json"].sort());
		for(const [path, record] of Object.entries(packaged.files))
		{
			const bytes = files.get(path);
			assert.deepEqual(record, { bytes: bytes.length, sha256: sha256(bytes) }, path);
		}
		const json = path => {
			const bytes = files.get("share/lean-bridge/" + path), value = JSON.parse(bytes);
			assert.equal(bytes.toString(), canonicalJson(value), path); return value;
		};
		assert.deepEqual(json("component/model.json"), model);
		assert.deepEqual(json("component/binding-ir.json"), model.bindingIr);
		const component = json("component/native-component.json");
		const adapter = json("native-c-adapter.json"), runtime = json("runtime.json");
		assert.equal(sha256(canonicalJson(runtime)), packaged.runtimeIdentity);
		assert.equal(component.runtimeIdentity, packaged.runtimeIdentity);
		assert.equal(adapter.runtimeIdentity, packaged.runtimeIdentity);
		assert.equal(component.bindingIrSha256, model.bindingIrSha256);
		assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
		assert.equal(packaged.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(packaged.adapterReceiptSha256, sha256(canonicalJson(adapter)));
		const libraries = {
			["lib/" + adapter.library]: adapter.files["lib/" + adapter.library]
			, ["lib/" + component.library]: component.nativeLibrary
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
			: { ...raw, ...generators.generateCppBindingPackage(model.bindingIr)
				, ...generators.boostSources() };
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
			assert.equal(gmp.version, "6.3.0"); assert.equal(gmp.checked, true);
			assert.equal(gmp.sha256, sha256(source));
		}
		assert.deepEqual([...files.keys()].filter(path => path.startsWith("include/")).sort()
			, headers.sort());
		const sourceLicense = original(producerCommit, `${inheritedCheckedRecordFixture}/LICENSE`);
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
				.map(path => "share/lean-bridge/component/" + path)
			, "share/lean-bridge/runtime.json", "share/lean-bridge/native-c-adapter.json"
			, ...["Lean-LICENSE", "Lean-LICENSES", "LeanBridge-LICENSE"]
				.map(path => "share/lean-bridge/licenses/" + path)
			, noticePath, payloadPath
			, ...profile === "c" ? ["share/lean-bridge/gmp.json"
				, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"
				, ...["COPYING", "COPYING.LESSERv3", "COPYINGv2", "COPYINGv3"]
					.map(path => "share/lean-bridge/licenses/GMP-" + path)]
				: ["share/lean-bridge/boost.json"
					, "share/lean-bridge/licenses/Boost-LICENSE"]
		];
		assert.equal(new Set(expectedPaths).size, expectedPaths.length);
		assert.deepEqual(Object.keys(packaged.files).sort(), expectedPaths.sort());
		results.push({ profile, artifact, receiptSha256: sha256(packageBytes)
			, packageFileSetSha256: sha256(canonicalJson([...files.keys()].sort()))
			, files: files.size });
	}
	return results;
};

/**
 * Authenticate producer authority, exact models, complete archives and replay.
 *
 * @param read - Read one selection-relative original record.
 * @param options - Independently fixed run identity.
 */
export const checkInheritedCheckedRecordNativeReport = async (read, options) => {
	const { route, mode, producerCommit, runtime, floor, maxLoad } = options;
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.ok(["full", "result-only"].includes(mode));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u); assert.match(floor, /^2\.[0-9]+$/u);
	exactKeys(runtime, ["platform", "arch", "glibc"], "runtime option");
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.slice(2)) >= Number(floor.slice(2)));
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path); return value;
	};
	const report = await json("report.json");
	exactKeys(report, ["schemaVersion", "route", "mode"
		, "profiles", "producerCommit"
		, "configuration", "builds", "reports", "expectedBindingIrSha256", "runtime"
		, "reproducible", "independentBuilds", "authorInputsUnchanged"
		, "declaredGlibcFloor", "resourceAdmission"], "report");
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.mode, mode); assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.profiles, profiles);
	assert.deepEqual(report.configuration
		, inheritedCheckedRecordNativeConfiguration(route, mode));
	assert.equal(report.reproducible, true); assert.equal(report.independentBuilds, 2);
	assert.equal(report.authorInputsUnchanged, true);
	assert.equal(report.declaredGlibcFloor, floor);
	const observedRuntime = { platform: runtime.platform, arch: runtime.arch
		, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" } };
	assert.deepEqual(report.runtime, observedRuntime);
	assert.deepEqual(await json("runtime.json"), observedRuntime);
	await checkResources(json, report, maxLoad);
	const { model, receipt } = await checkModels({
		report, read, json, route, mode, producerCommit
	});
	assert.deepEqual(report.reports.map(item => item.profile), profiles);
	for(const item of report.reports)
	{
		const { profile } = item, counts = inheritedCheckedRecordNativeCounts[profile][mode];
		exactKeys(item, ["profile", "checks", "result", "consumerSha256"
			, "offlineInstall"
			, "compilerFreePath"
			, "executableSha256"
			, "runs"
			, "packages"
			, "sourceSha256", "compiler", "relocatedInstallation"
			, "sourceRemovedBeforeInstallation"
			, "compilerFreeReplay"], profile + " report");
		assert.deepEqual(await json(`${profile}/report.json`), item);
		assert.deepEqual(item.result, counts); assert.equal(item.checks, counts.checks);
		for(const key of ["offlineInstall", "compilerFreePath"
			, "relocatedInstallation"
			, "sourceRemovedBeforeInstallation", "compilerFreeReplay"])
			assert.equal(item[key], true, key);
		digest(item.executableSha256);
		const source = (mode === "result-only" ? "#define INHERITED_CHECKED_RECORD_RESULT_ONLY\n" : "")
			+ (route === "reviewed" ? '#define NESTED_PARAMETER_PREFIX "value"\n' : "")
			+ original(producerCommit
				, `tests/fixtures/inherited-checked-record-consumers/${profile}.${profile}`).toString();
		assert.equal((await read(`consumers/${profile}.${profile}`)).toString(), source);
		assert.equal(item.sourceSha256, sha256(source));
		assert.equal(item.consumerSha256, sha256(source));
		assert.deepEqual(item.packages, receipt.packages.filter(pkg => pkg.target === profile));
		const compiler = await json(`${profile}/compiler.json`);
		assert.deepEqual(item.compiler, compiler); assert.equal(compiler.code, 0);
		assert.equal(compiler.stderr, "");
		assert.match(compiler.stdout, profile === "c" ? /^cc .+\n/u : /^c\+\+ .+\n/u);
		assert.equal(item.runs.length, 2);
		const packageBytes = await read(`${profile}/lean-bridge-package.json`);
		const packaged = JSON.parse(packageBytes);
		assert.equal(packageBytes.toString(), canonicalJson(packaged));
		const closure = { receiptSha256: sha256(packageBytes)
			, packageFileSetSha256: sha256(canonicalJson(
				[...Object.keys(packaged.files), "lean-bridge-package.json"].sort())) };
		for(const [position, name] of ["installed", "relocated"].entries())
		{
			const run = await json(`${profile}/${name}.json`);
			assert.deepEqual(run, item.runs[position]);
			assert.deepEqual(run, { code: 0, stdout: JSON.stringify(counts) + "\n"
				, stderr: ""
				, receiptSha256: closure.receiptSha256
				, packageFileSetSha256: closure.packageFileSetSha256
				, relocated: position === 1 });
		}
	}
	const packages = await checkPackages({ read, model, receipt, floor, producerCommit });
	return { route, mode, producerCommit, profiles, runtime, floor, maxLoad
		, counts: Object.fromEntries(profiles.map(profile =>
			[profile, inheritedCheckedRecordNativeCounts[profile][mode]]))
		, executions: 4, initialExecutions: 2, packages };
};
