/**
 * Independently authenticate retained dependent checked-record C/C++ package
 * records and source-free replay claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	dependentCheckedRecordNativeProfiles
	, dependentCheckedRecordNativeRoutes
	, dependentCheckedRecordNativeSelection
	, dependentCheckedRecordNativeTarget
} from "./dependent-checked-record-native-fixture.mjs";
import {
	readOwnedPerlCallbackVariantTar as readRepositoryTar
} from "./owned-perl-callback-result-variant-archives.mjs";

const fixtureRoot = "tests/fixtures/onboarding/dependent-checked-records";
const fixturePaths = Object.freeze([
	"DependentRecords.lean", "LICENSE", "lakefile.toml"
	, "lean-toolchain", "package.json"
]);
const buildPaths = selection => [
	"model.json", "package-set-receipt.json", "author-inputs.json"
	, "DependentRecords.lean", "lean-bridge.exports.json"
	, ...selection.reviewed ? ["api.binding-ir.json"] : []
];
const exactKeys = (value, keys, label = "record") => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label);
const canonical = async (read, path) => {
	const bytes = await read(path), value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path);
	return value;
};
const original = (commit, path) => execFileSync(
	"git", ["show", `${commit}:${path}`], { maxBuffer: 32 * 1024 * 1024 }
);
const stableInputs = state => state.map(
	({ path, mode, sha256: hash }) => ({ path, mode, sha256: hash })
);

/**
 * Enumerate the complete original file set for one retained native route.
 *
 * @param route - Closed ordinary/reviewed and full/result-only route.
 * @param receipt - Independently validated native package-set receipt.
 */
export const dependentCheckedRecordNativeRecordPaths = (route, receipt) => {
	assert.ok(dependentCheckedRecordNativeRoutes.includes(route));
	validatePackageSetReceipt(receipt);
	const selection = dependentCheckedRecordNativeSelection(route);
	return [
		"configuration.json", "expected.binding-ir.json", "report.json"
		, ...[0, 1].flatMap(attempt => buildPaths(selection)
			.map(path => `build-${attempt}/${path}`))
		, ...dependentCheckedRecordNativeProfiles.flatMap(profile => [
			`consumers/${profile}.${profile}`, `${profile}/report.json`
		])
		, ...[
			"package-set-receipt.json", "package-set-receipt.json.sha256"
			, ...receipt.packages.flatMap(pkg =>
				pkg.artifacts.map(item => item.path))
		].map(path => "handoff/" + path)
	].sort();
};

const assertDependentProvenance = (ir, expected) => {
	validateBindingIr(ir);
	assert.equal(reviewedContractDifference(expected, ir), null);
	const record = ir.types.find(
		type => type.id === "lean:DependentRecords.Dependent"
	);
	assert.ok(record);
	assert.deepEqual(record.fields.map(field => ({
		name: field.name, type: field.type
	})), ["bound", "below"].map(name => ({
		name, type: { kind: "primitive", name: "nat" }
	})));
	assert.deepEqual(record.source.extensions["lean-lang.org/erased-proofs"]
		, { fields: ["valid"] });
	assert.deepEqual(
		record.source.extensions["lean-lang.org/nominal-refinements"]
		, {
			kind: "record"
			, fields: [null, { kind: "fin-field", field: "bound" }]
		}
	);
};

const sourceInputs = (producerCommit, selection) => {
	const inputs = {
		"lean-bridge.exports.json": Buffer.from(
			canonicalJson(selection.configuration)
		)
	};
	for(const path of fixturePaths)
		inputs[path] = original(producerCommit, `${fixtureRoot}/${path}`);
	if(selection.reviewed)
		inputs["api.binding-ir.json"] = Buffer.from(
			canonicalJson(selection.expected)
		);
	return inputs;
};

const checkModels = async ({
	read, report, selection, producerCommit
}) => {
	const inputs = sourceInputs(producerCommit, selection);
	const inputPaths = Object.keys(inputs).sort();
	assert.deepEqual(await canonical(read, "configuration.json")
		, selection.configuration);
	assert.deepEqual(await canonical(read, "expected.binding-ir.json")
		, selection.expected);
	assert.equal(report.expectedBindingIrSha256
		, hashBindingIr(selection.expected));
	assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]);
	let model, receipt, firstStable;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`;
		const modelBytes = await read(prefix + "model.json");
		const receiptBytes = await read(prefix + "package-set-receipt.json");
		model = JSON.parse(modelBytes);
		receipt = JSON.parse(receiptBytes);
		assert.equal(modelBytes.toString(), canonicalJson(model));
		assert.equal(receiptBytes.toString(), canonicalJson(receipt));
		assertDependentProvenance(model.bindingIr, selection.expected);
		validatePackageSetReceipt(receipt);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(model.profile, "native-library-v1");
		assert.equal(model.pointerBits, 64);
		assert.equal(model.byteOrder, "little");
		assert.equal(model.schemaVersion, selection.reviewed ? 3 : 2);
		assert.deepEqual(model.component, {
			id: "dependentrecords@1.0.0"
			, name: "dependentrecords", version: "1.0.0"
		});
		assert.deepEqual(model.exports.map(item => item.name).sort()
			, selection.expected.declarations.map(
				item => item.source.declaration
			).sort());
		const source = inputs["DependentRecords.lean"];
		assert.deepEqual(await read(prefix + "DependentRecords.lean"), source);
		assert.deepEqual(await canonical(
			read, prefix + "lean-bridge.exports.json"
		), selection.configuration);
		if(selection.reviewed)
			assert.deepEqual(await canonical(
				read, prefix + "api.binding-ir.json"
			), selection.expected);
		const identity = model.sourceIdentity;
		assert.equal(identity.modules.length, 1);
		assert.equal(identity.modules[0].source.sha256, sha256(source));
		assert.equal(identity.exportConfigurationSource
			, canonicalJson(selection.configuration));
		assert.equal(identity.exportConfigurationSha256
			, sha256(canonicalJson(selection.configuration)));
		assert.equal(identity.extractorSha256, sha256(original(
			producerCommit, "src/analyze/NativeExports.lean"
		)));
		assert.equal(receipt.source.treeSha256, identity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.equal(receipt.profiles.length, 1);
		assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256
			, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(pkg => pkg.target).sort()
			, [...dependentCheckedRecordNativeProfiles].sort());
		const state = await canonical(read, prefix + "author-inputs.json");
		assert.deepEqual(state.map(item => item.path).sort(), inputPaths);
		for(const item of state)
		{
			exactKeys(item, ["ctime", "mode", "mtime", "path", "sha256"]);
			assert.equal(item.mode & 0o170000, 0o100000);
			assert.ok(Number.isFinite(item.mtime)
				&& Number.isFinite(item.ctime));
			assert.equal(item.sha256, sha256(inputs[item.path]));
		}
		const stable = stableInputs(state);
		assert.equal(report.builds[attempt].authorInputsSha256
			, sha256(canonicalJson(stable)));
		if(attempt === 0) firstStable = stable;
		else assert.deepEqual(stable, firstStable);
		assert.deepEqual(report.builds[attempt], {
			authorInputsSha256: sha256(canonicalJson(stable))
			, bindingIrSha256: model.bindingIrSha256
			, modelSha256: sha256(modelBytes)
			, receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
				pkg.artifacts.map(item => [item.path, item.sha256])))
		});
	}
	for(const path of buildPaths(selection))
		assert.deepEqual(await read(`build-0/${path}`)
			, await read(`build-1/${path}`), path);
	return { model, receipt };
};

const callerSource = (producerCommit, profile, selection) => {
	const extension = profile === "c" ? "c" : "cpp";
	const path = "tests/fixtures/dependent-checked-record-consumers/"
		+ `${selection.resultOnly ? "result-only-" : ""}`
		+ `${extension}.${extension}`;
	let source = original(producerCommit, path).toString();
	if(selection.reviewed)
		source = source.replaceAll(
			"\"arg0 was rejected by ", "\"value0 was rejected by "
		);
	return source;
};

const checkPackages = async ({
	read, report, receipt, model, selection, producerCommit, floor
}) => {
	const receiptBytes = await read("handoff/package-set-receipt.json");
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	assert.deepEqual(report.receipt, receipt);
	assert.equal((await read(
		"handoff/package-set-receipt.json.sha256"
	)).toString(), sha256(receiptBytes) + "  package-set-receipt.json\n");
	const packages = new Map();
	for(const pkg of receipt.packages)
	{
		const profile = pkg.target;
		assert.ok(dependentCheckedRecordNativeProfiles.includes(profile));
		assert.equal(pkg.ecosystem, profile);
		assert.equal(pkg.role, "component");
		assert.equal(pkg.profile, "native-library-v1");
		assert.equal(pkg.runtimeDelivery, "embedded");
		assert.deepEqual(pkg.requires, []);
		assert.equal(pkg.name, dependentCheckedRecordNativeTarget.name);
		assert.equal(pkg.version, dependentCheckedRecordNativeTarget.version);
		assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.runtimeIdentity
			, receipt.profiles[0].runtimeIdentity);
		const artifact = pkg.artifacts[0];
		const root = `dependentrecords-1.0.0-${profile}`;
		assert.equal(artifact.path, `archives/${root}.tar.gz`);
		const archive = await read("handoff/" + artifact.path);
		assert.equal(archive.length, artifact.bytes);
		assert.equal(sha256(archive), artifact.sha256);
		const files = readRepositoryTar(archive, root);
		const packageBytes = files.get("lean-bridge-package.json");
		const packaged = JSON.parse(packageBytes);
		assert.equal(packageBytes.toString(), canonicalJson(packaged));
		assert.equal(packaged.schemaVersion, 1);
		assert.equal(packaged.kind, "lean-bridge-native-c-package");
		assert.equal(packaged.ecosystem, profile);
		assert.equal(packaged.name, dependentCheckedRecordNativeTarget.name);
		assert.equal(packaged.version
			, dependentCheckedRecordNativeTarget.version);
		assert.equal(packaged.profile, "native-library-v1");
		assert.equal(packaged.runtimeIdentity, pkg.runtimeIdentity);
		assert.equal(packaged.bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(packaged.component, model.component);
		assert.equal(packaged.glibcMinimumVersion, floor);
		assert.deepEqual([...files.keys()].sort()
			, [...Object.keys(packaged.files)
				, "lean-bridge-package.json"].sort());
		for(const [path, identity] of Object.entries(packaged.files))
		{
			const bytes = files.get(path);
			assert.deepEqual(identity, {
				bytes: bytes.length, sha256: sha256(bytes)
			}, path);
		}
		const packagedJson = path => {
			const bytes = files.get("share/lean-bridge/" + path);
			const value = JSON.parse(bytes);
			assert.equal(bytes.toString(), canonicalJson(value), path);
			return value;
		};
		assert.deepEqual(packagedJson("component/model.json"), model);
		assert.deepEqual(packagedJson("component/binding-ir.json")
			, model.bindingIr);
		const component = packagedJson("component/native-component.json");
		const adapter = packagedJson("native-c-adapter.json");
		const runtime = packagedJson("runtime.json");
		assert.equal(sha256(canonicalJson(runtime)), packaged.runtimeIdentity);
		assert.equal(component.runtimeIdentity, packaged.runtimeIdentity);
		assert.equal(adapter.runtimeIdentity, packaged.runtimeIdentity);
		assert.equal(component.bindingIrSha256, model.bindingIrSha256);
		assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
		const tree = Object.fromEntries([...files].map(([path, bytes]) =>
			[path, sha256(bytes)]));
		packages.set(profile, { pkg, artifact, packaged, tree });
	}
	for(const profile of dependentCheckedRecordNativeProfiles)
	{
		const source = callerSource(
			producerCommit, profile, selection
		);
		const retained = await read(`consumers/${profile}.${profile}`);
		assert.equal(retained.toString(), source);
		const item = await canonical(read, `${profile}/report.json`);
		assert.deepEqual(item, report.reports.find(
			value => value.profile === profile
		));
		exactKeys(item, [
			"schemaVersion", "route", "profile", "packages", "checks"
			, "consumerSha256", "installedTree", "installedStdoutSha256"
			, "relocatedStdoutSha256", "sourceRemovedBeforeInstallation"
			, "offlineInstall", "compilerFreePath"
			, "relocatedInstallation", "repeatExecution"
			, "callerInputsUnchanged", "nativePayloadUnchanged"
		]);
		assert.equal(item.schemaVersion, 1);
		assert.equal(item.route, report.route);
		assert.equal(item.profile, profile);
		assert.equal(item.consumerSha256, sha256(retained));
		const checks = selection.resultOnly ? 513 : 521;
		assert.equal(item.checks, checks);
		const expectedStdout
			= `dependent-checked-record-ok:${checks}\n`;
		assert.equal(item.installedStdoutSha256, sha256(expectedStdout));
		assert.equal(item.relocatedStdoutSha256, sha256(expectedStdout));
		for(const key of [
			"sourceRemovedBeforeInstallation", "offlineInstall"
			, "compilerFreePath", "relocatedInstallation", "repeatExecution"
			, "callerInputsUnchanged", "nativePayloadUnchanged"
		]) assert.equal(item[key], true, `${profile}/${key}`);
		const admitted = packages.get(profile);
		assert.deepEqual(item.packages, [admitted.pkg]);
		assert.deepEqual(item.installedTree, admitted.tree);
	}
};

/**
 * Authenticate producer authority, exact models, complete native archives and
 * retained source-free replay records.
 *
 * @param read - Route-relative original byte reader.
 * @param options - Independent route, revision and ABI-floor identity.
 * @param options.route - Closed ordinary/reviewed and full/result-only route.
 * @param options.producerCommit - Exact hosted package-producing revision.
 * @param options.floor - Declared glibc package floor.
 */
export const checkDependentCheckedRecordNativeReport = async (
	read, { route, producerCommit, floor }
) => {
	assert.ok(dependentCheckedRecordNativeRoutes.includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.match(floor, /^2\.[0-9]+$/u);
	const selection = dependentCheckedRecordNativeSelection(route);
	const report = await canonical(read, "report.json");
	exactKeys(report, [
		"schemaVersion", "route", "producerCommit", "configuration"
		, "expectedBindingIrSha256", "builds", "receipt", "reports"
		, "profiles", "independentBuilds", "reproducible"
		, "authorInputsUnchanged", "sourceCommitClean"
		, "sourceRemovedBeforeInstallation", "offlineInstall"
		, "compilerFreePath", "relocatedInstallation"
		, "immutableCallerAssertions", "relation"
	]);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.configuration, selection.configuration);
	assert.deepEqual(report.profiles, dependentCheckedRecordNativeProfiles);
	assert.equal(report.independentBuilds, 2);
	assert.equal(report.relation, "below < bound");
	for(const key of [
		"reproducible", "authorInputsUnchanged", "sourceCommitClean"
		, "sourceRemovedBeforeInstallation", "offlineInstall"
		, "compilerFreePath", "relocatedInstallation"
		, "immutableCallerAssertions"
	]) assert.equal(report[key], true, key);
	const { model, receipt } = await checkModels({
		read, report, selection, producerCommit
	});
	await checkPackages({
		read, report, receipt, model, selection, producerCommit, floor
	});
	return {
		route, producerCommit
		, reportSha256: sha256(canonicalJson(report))
		, receipt, profiles: dependentCheckedRecordNativeProfiles
		, checks: report.reports.reduce(
			(sum, item) => sum + item.checks, 0)
		, executions: report.reports.length * 2
	};
};
