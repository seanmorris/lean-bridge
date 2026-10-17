/**
 * Authenticate reproduced inherited checked-record npm packages and both installed callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { validateCompilerAdapterPlan } from "../../src/build/compiler-adapters.mjs";
import { createComponentPrivateAbi } from "../../src/build/component-callable-adapters.mjs";
import { validateComponentBuildPlan } from "../../src/build/component-plan.mjs";
import {
	parseNpmPackageCoordinate,
	validateComponentPackageReceipt
} from "../../src/release/component-package-receipt.mjs";
import { readOwnedPerlCallbackVariantTar as readRepositoryTar } from "./owned-perl-callback-result-variant-archives.mjs";
import {
	inheritedCheckedRecordFixture,
	inheritedCheckedRecordModule,
	inheritedCheckedRecordName
} from "./inherited-checked-record-fixture.mjs";
import {
	inheritedCheckedRecordNpmExpected,
	inheritedCheckedRecordNpmPositions,
	inheritedCheckedRecordNpmSelection
} from "./inherited-checked-record-npm-fixture.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const buildPaths = [
	"binding/binding-ir.json", "locks/compiler-adapters.json"
	, "locks/component-build-plan.json", "metadata/provenance.json"
	, "component-package-receipt.json", `${inheritedCheckedRecordModule}.lean`
];
const callerPaths = ["index.mjs", "check.mjs", "index.mts"];
const installedPaths = [
	"package.json", "package-lock.json", "runtime-identity.json"
	, "runtime-package.json", "component-package.json"
];
const handoffPaths = receipt => [
	"component-package-receipt.json", "verify-component-package-receipt.mjs"
	, receipt.runtime.archive, receipt.package.archive
].map(path => `handoff/${path}`);

/**
 * Enumerate every original file needed to replay one accepted npm report.
 *
 * @param mode - Full or result-only export selection.
 * @param receipt - Independently validated component-package receipt.
 */
export const inheritedCheckedRecordNpmRecordPaths = (mode, receipt) => {
	assert.ok(["full", "result-only"].includes(mode));
	validateComponentPackageReceipt(receipt);
	return [
		"report.json", "configuration.json"
		, "expected.binding-ir.json"
		, "install.json", "installed.json", "relocated.json"
		, ...installedPaths.map(path => `installed/${path}`)
		, ...callerPaths.map(path => `callers/${path}`)
		, ...handoffPaths(receipt)
		, ...[0, 1].flatMap(attempt => [
			...buildPaths.map(path => `build-${attempt}/${path}`)
			, `build-${attempt}/author-inputs.json`
		])
	];
};

const canonical = async (read, path) => {
	const bytes = await read(path), value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path);
	return value;
};
const stableInputs = state => state.map(({ path, mode, sha256: hash }) => ({
	path, mode, sha256: hash
}));
const sourceInputs = (original, selection) => {
	const inputs = {
		"lean-bridge.exports.json": Buffer.from(canonicalJson(selection.configuration))
	};
	for(const path of [
		`${inheritedCheckedRecordModule}.lean`, "lakefile.toml", "lean-toolchain"
		, "LICENSE", "package.json"
	]) inputs[path] = original(`${inheritedCheckedRecordFixture}/${path}`);
	if(selection.reviewed)
		inputs["api.binding-ir.json"] = Buffer.from(canonicalJson(selection.expected));
	return inputs;
};

const assertHandoff = async (read, report, original) => {
	const receipt = report.receipt;
	validateComponentPackageReceipt(receipt);
	assert.equal((await read("handoff/component-package-receipt.json")).toString()
		, canonicalJson(receipt));
	assert.deepEqual(await read("handoff/verify-component-package-receipt.mjs")
		, original("src/release/component-package-receipt.mjs"));
	const basisBytes = await read("installed/runtime-identity.json");
	const basis = JSON.parse(basisBytes);
	assert.equal(basisBytes.toString(), canonicalJson(basis));
	assert.equal(typeof basis.packing.collationLocale, "string");
	assert.ok(basis.packing.collationLocale.length > 0);
	const artifacts = {}, packages = {};
	for(const [role, item] of [["runtime", receipt.runtime], ["component", receipt.package]])
	{
		const bytes = await read(`handoff/${item.archive}`);
		assert.equal(sha256(bytes), item.sha256, item.archive);
		const files = readRepositoryTar(bytes, "package", basis.packing.collationLocale);
		const metadataBytes = files.get("package.json"), metadata = JSON.parse(metadataBytes);
		const coordinate = parseNpmPackageCoordinate(item.package);
		const expectedName = role === "runtime" ? "@lean-bridge/runtime" : inheritedCheckedRecordName;
		assert.equal(coordinate.name, expectedName);
		assert.equal(metadata.name, expectedName); assert.equal(metadata.version, coordinate.version);
		assert.deepEqual(await read(`installed/${role}-package.json`), metadataBytes);
		assert.deepEqual(Object.fromEntries([...files].map(([path, value]) => [path, sha256(value)]))
			, report.trees[expectedName]);
		if(role === "runtime")
		{
			assert.deepEqual(files.get("runtime-identity.json"), basisBytes);
			assert.equal(metadata.leanBridge.runtimeIdentity, sha256(basisBytes));
			assert.deepEqual([...files.keys()].sort()
				, [...basis.files.map(file => file.path), "package.json", "runtime-identity.json"].sort());
			for(const file of basis.files) assert.equal(sha256(files.get(file.path)), file.sha256, file.path);
		}
		else
		{
			assert.equal(sha256(files.get("index.d.ts")), report.typescript.declarationsSha256);
			assert.deepEqual(metadata.leanBridge, {
				component: receipt.package.package
				, componentBundleSha256: receipt.componentBundleSha256
				, componentIdentitySha256: receipt.componentIdentitySha256
				, bindingIrSha256: report.builds[0].bindingIrSha256
				, sharedRuntime: true
			});
		}
		artifacts[expectedName] = {
			bytes: bytes.length, sha256: sha256(bytes)
			, integrity: "sha512-" + createHash("sha512").update(bytes).digest("base64")
		};
		packages[role] = metadata;
	}
	assert.deepEqual(packages.component.dependencies
		, { "@lean-bridge/runtime": packages.runtime.version });
	const manifest = JSON.parse(await read("installed/package.json"));
	const lock = JSON.parse(await read("installed/package-lock.json"));
	assert.deepEqual(manifest, { private: true, type: "module", dependencies: manifest.dependencies });
	assert.equal(lock.lockfileVersion, 3);
	assert.deepEqual(Object.keys(manifest.dependencies).sort()
		, ["@lean-bridge/runtime", inheritedCheckedRecordName].sort());
	assert.deepEqual(Object.keys(lock.packages).sort(), [
		"", "node_modules/@lean-bridge/runtime"
		, `node_modules/${inheritedCheckedRecordName}`
	].sort());
	assert.deepEqual(lock.packages[""].dependencies, manifest.dependencies);
	for(const [role, item] of [["runtime", receipt.runtime], ["component", receipt.package]])
	{
		const metadata = packages[role], dependency = lock.packages[`node_modules/${metadata.name}`];
		assert.equal(dependency.version, metadata.version);
		assert.equal(dependency.resolved, `file:../handoff/${item.archive}`);
		assert.equal(manifest.dependencies[metadata.name], dependency.resolved);
		assert.equal(dependency.integrity, artifacts[metadata.name].integrity);
	}
	return artifacts;
};

/**
 * Validate reproduced author builds, retained packages and both source-free executions.
 *
 * @param read - Reader of original files relative to one route record.
 * @param options - Identity observed independently of the report.
 * @param options.route - Exact ordinary/reviewed and full/result-only route.
 * @param options.producerCommit - Frozen repository revision used by the producer.
 * @param options.runtime - Node runtime identity observed by the invoking gate.
 */
export const checkInheritedCheckedRecordNpmReport = async (read, {
	route, producerCommit, runtime
}) => {
	const selection = inheritedCheckedRecordNpmSelection(route);
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "node", "platform"]);
	assert.match(runtime.node, /^v[0-9]+\.[0-9]+\.[0-9]+$/u);
	const original = path => execFileSync("git", ["show", `${producerCommit}:${path}`], {
		maxBuffer: 32 * 1024 * 1024
	});
	const report = await canonical(read, "report.json");
	assert.deepEqual(Object.keys(report).sort(), [
		"apiMode", "authorInputsUnchanged", "authorRoute", "builds", "callers"
		, "compilerFreePath", "configuration", "consumerProfiles", "dispatch"
		, "expected", "expectedBindingIrSha256", "independentBuilds"
		, "observations", "offlineInstall", "positions", "producerCommit"
		, "receipt", "relocatedInstallation", "reproducible"
		, "route", "runtime", "schemaVersion", "sourceCommitClean"
		, "sourceRemovedBeforeInstallation", "trees", "typescript"
	].sort());
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.authorRoute, selection.reviewed ? "reviewed" : "ordinary");
	assert.equal(report.apiMode, selection.mode); assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.runtime, runtime);
	assert.deepEqual(report.configuration, selection.configuration);
	assert.deepEqual(await canonical(read, "configuration.json"), selection.configuration);
	assert.deepEqual(report.expected, inheritedCheckedRecordNpmExpected(route));
	assert.deepEqual(await canonical(read, "expected.binding-ir.json"), selection.expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(selection.expected));
	assert.deepEqual(report.consumerProfiles, ["node-javascript", "node-typescript"]);
	assert.deepEqual(report.positions, inheritedCheckedRecordNpmPositions[selection.mode]);
	assert.equal(report.independentBuilds, 2); assert.equal(report.builds.length, 2);
	for(const key of [
		"reproducible", "authorInputsUnchanged", "sourceCommitClean"
		, "sourceRemovedBeforeInstallation", "offlineInstall"
		, "compilerFreePath", "relocatedInstallation"
	]) assert.equal(report[key], true, key);
	const dispatchReason = "No constructor/source entry counters in this npm caller";
	assert.deepEqual(report.dispatch, { observed: false, reason: dispatchReason });
	assert.deepEqual(report.builds[1], report.builds[0]);
	const inputs = sourceInputs(original, selection), inputPaths = Object.keys(inputs).sort();
	let firstStableInputs;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, build = report.builds[attempt];
		assert.deepEqual(Object.keys(build).sort(), [
			"authorInputsSha256", "bindingIrFileSha256", "bindingIrSha256"
			, "componentArchiveSha256", "receiptSha256", "runtimeArchiveSha256"
		].sort());
		const irBytes = await read(prefix + "binding/binding-ir.json"), ir = JSON.parse(irBytes);
		assert.equal(irBytes.toString(), canonicalJson(ir)); validateBindingIr(ir);
		const adapters = await canonical(read, prefix + "locks/compiler-adapters.json");
		const plan = await canonical(read, prefix + "locks/component-build-plan.json");
		const provenance = await canonical(read, prefix + "metadata/provenance.json");
		const receipt = await canonical(read, prefix + "component-package-receipt.json");
		validateCompilerAdapterPlan(adapters); validateComponentBuildPlan(plan);
		validateComponentPackageReceipt(receipt);
		assert.equal(reviewedContractDifference(selection.expected, ir), null);
		assert.equal(build.bindingIrSha256, hashBindingIr(ir));
		assert.equal(build.bindingIrFileSha256, sha256(irBytes));
		assert.equal(build.receiptSha256
			, sha256(await read(prefix + "component-package-receipt.json")));
		assert.equal(build.componentArchiveSha256, receipt.package.sha256);
		assert.equal(build.runtimeArchiveSha256, receipt.runtime.sha256);
		assert.deepEqual(report.receipt, receipt);
		assert.deepEqual(await read(prefix + `${inheritedCheckedRecordModule}.lean`)
			, inputs[`${inheritedCheckedRecordModule}.lean`]);
		assert.equal(plan.bindingIr.semanticSha256, build.bindingIrSha256);
		assert.equal(receipt.bindingIrSha256, build.bindingIrSha256);
		assert.deepEqual(plan.targets, ["npm"]); assert.deepEqual(plan.component, ir.component);
		assert.deepEqual(receipt.component, ir.component); assert.equal(adapters.component, ir.component.id);
		assert.deepEqual(adapters.imports, [inheritedCheckedRecordModule]);
		assert.deepEqual(adapters.privateAbi, createComponentPrivateAbi(ir));
		assert.equal(adapters.privateAbi.version, 8);
		assert.equal(adapters.componentPlanSha256
			, sha256(await read(prefix + "locks/component-build-plan.json")));
		assert.deepEqual(plan.bindingIr.declarations
			, ir.declarations.map(declaration => declaration.id).sort());
		assert.equal(adapters.exports.length, selection.expected.declarations.length);
		for(const item of adapters.exports)
		{
			const declaration = ir.declarations.find(value => value.id === item.bindingId);
			assert.deepEqual(item.refinements
				, declaration.source.extensions["lean-lang.org/refinements"]);
		}
		assert.equal(provenance.schemaVersion, 1); assert.equal(provenance.component, ir.component.id);
		assert.equal(provenance.sourceTreeSha256, plan.source.treeSha256);
		assert.equal(provenance.componentPlanSha256, adapters.componentPlanSha256);
		assert.equal(receipt.source.treeSha256, plan.source.treeSha256);
		assert.equal(receipt.provenanceSha256
			, sha256(await read(prefix + "metadata/provenance.json")));
		for(const key of [
			"compilationPlanSha256", "componentArtifactManifestSha256"
			, "linkManifestSha256", "targetCManifestSha256"
		]) digest(provenance[key]);
		const planInputs = Object.fromEntries(plan.source.inputs.map(item => [item.path, item]));
		assert.deepEqual(Object.keys(planInputs).sort(), inputPaths);
		for(const [path, bytes] of Object.entries(inputs))
			assert.deepEqual(planInputs[path], { path, bytes: bytes.length, sha256: sha256(bytes) });
		const state = await canonical(read, prefix + "author-inputs.json");
		assert.deepEqual(state.map(item => item.path).sort(), inputPaths);
		for(const item of state)
		{
			assert.deepEqual(Object.keys(item).sort(), ["ctime", "mode", "mtime", "path", "sha256"]);
			assert.equal(item.mode, 0o100644); assert.ok(Number.isFinite(item.mtime));
			assert.ok(Number.isFinite(item.ctime)); assert.equal(item.sha256, sha256(inputs[item.path]));
		}
		const stable = stableInputs(state);
		assert.equal(build.authorInputsSha256, sha256(canonicalJson(stable)));
		if(attempt === 0) firstStableInputs = stable;
		else assert.deepEqual(stable, firstStableInputs);
	}
	for(const path of buildPaths)
		assert.deepEqual(await read(`build-0/${path}`), await read(`build-1/${path}`), path);
	const resultOnly = selection.resultOnly;
	const callers = {
		"index.mjs": `import * as api from "${inheritedCheckedRecordName}";\nimport {checkInheritedCheckedRecords} from "./check.mjs";\nconsole.log(JSON.stringify(checkInheritedCheckedRecords(api, {resultOnly: ${resultOnly}})));\n`
		, "check.mjs": original("tests/fixtures/inherited-checked-record-consumers/javascript.mjs")
		, "index.mts": original(`tests/fixtures/inherited-checked-record-consumers/${selection.mode}.mts`)
	};
	assert.deepEqual(Object.keys(report.callers).sort(), callerPaths.slice().sort());
	for(const [path, source] of Object.entries(callers))
	{
		const bytes = await read(`callers/${path}`);
		assert.deepEqual(bytes, Buffer.from(source)); assert.equal(report.callers[path], sha256(bytes));
	}
	assert.deepEqual(report.typescript, {
		strict: true, skipLibCheck: false
		, sourceSha256: sha256(callers["index.mts"])
		, declarationsSha256: report.typescript.declarationsSha256
	});
	digest(report.typescript.declarationsSha256);
	assert.deepEqual(Object.keys(report.trees).sort()
		, ["@lean-bridge/runtime", inheritedCheckedRecordName]);
	for(const tree of Object.values(report.trees))
	{
		assert.ok(Object.keys(tree).length > 5); assert.ok(Object.hasOwn(tree, "package.json"));
		assert.ok(!Object.keys(tree).some(path => path.endsWith(".lean")));
		for(const [path, hash] of Object.entries(tree))
		{
			assert.ok(!path.startsWith("/")
				&& !path.split("/").some(part => ["", ".", ".."].includes(part)));
			digest(hash);
		}
	}
	const install = await canonical(read, "install.json"); assert.equal(install.code, 0);
	assert.match(install.stderr, /^(?:npm notice[^\n]*\n)*$/u);
	assert.match(install.stdout, /^\nadded 2 packages in [0-9]+(?:ms|s)\n$/u);
	assert.equal(report.observations.length, 2);
	const expectedCounts = inheritedCheckedRecordNpmExpected(route);
	const expectedRuntime = {
		node: runtime.node, platform: runtime.platform, arch: runtime.arch
	};
	for(const [index, name] of ["installed", "relocated"].entries())
	{
		const observation = await canonical(read, `${name}.json`);
		assert.deepEqual(report.observations[index], observation);
		assert.deepEqual(Object.keys(observation).sort()
			, ["relocated", "result", "runtime", "typescript"]);
		assert.equal(observation.relocated, index === 1);
		assert.deepEqual(observation.result, {
			code: 0, stdout: JSON.stringify(expectedCounts) + "\n", stderr: ""
		});
		assert.deepEqual(observation.typescript, { code: 0, stdout: "", stderr: "" });
		assert.deepEqual(observation.runtime, {
			code: 0, stdout: JSON.stringify(expectedRuntime) + "\n", stderr: ""
		});
	}
	const artifacts = await assertHandoff(read, report, original);
	return { route, mode: selection.mode, producerCommit, runtime
		, ...report.expected, executions: 2, artifacts };
};

/**
 * Prove the report checker rejects omissions and identity substitutions.
 *
 * @param read - Reader of one accepted original record.
 * @param options - The same independent identity passed to the report checker.
 * @param options.checkerCommit - Frozen revision containing these controls.
 */
export const controlInheritedCheckedRecordNpmReport = async (read, options) => {
	assert.match(options.checkerCommit, /^[a-f0-9]{40}$/u);
	const accepted = await checkInheritedCheckedRecordNpmReport(read, options);
	const bytes = await read("report.json"), base = JSON.parse(bytes);
	const paths = inheritedCheckedRecordNpmRecordPaths(base.apiMode, base.receipt);
	assert.equal(new Set(paths).size, paths.length);
	const originals = new Map();
	for(const path of paths) originals.set(path, Buffer.from(await read(path)));
	const identities = new Map([...originals].map(([path, value]) => [path, sha256(value)]));
	const selected = async (path, changes = new Map()) => {
		const value = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(value), `Missing original record: ${path}`);
		return Buffer.from(value);
	};
	let recordControls = 0;
	for(const [path, value] of originals)
	{
		for(const replacement of [null, Buffer.concat([value, Buffer.from("corrupted")])])
		{
			const changes = new Map([[path, replacement]]);
			await assert.rejects(checkInheritedCheckedRecordNpmReport(
				path_ => selected(path_, changes), options));
			recordControls++;
		}
	}
	const reportMutations = [
		["route", value => { value.route = value.route === "ordinary-full"
			? "reviewed-full" : "ordinary-full"; }]
		, ["producer commit", value => { value.producerCommit = "0".repeat(40); }]
		, ["runtime", value => { value.runtime.node = "v0.0.0"; }]
		, ["consumer profiles", value => { value.consumerProfiles.pop(); }]
		, ["positions", value => { value.positions.pop(); }]
		, ["caller", value => { value.callers["check.mjs"] = "0".repeat(64); }]
		, ["author inputs", value => { value.builds[0].authorInputsSha256 = "0".repeat(64); }]
		, ["package tree", value => { value.trees[inheritedCheckedRecordName]["index.mjs"] = "0".repeat(64); }]
		, ["installed result", value => { value.observations[0].result.stdout = "{}\n"; }]
		, ["missing field", value => { delete value.authorInputsUnchanged; }]
	];
	for(const [name, mutate] of reportMutations)
	{
		const changed = structuredClone(base); mutate(changed);
		const changes = new Map([["report.json", Buffer.from(canonicalJson(changed))]]);
		await assert.rejects(checkInheritedCheckedRecordNpmReport(
			path => selected(path, changes), options), name);
	}
	const adapterMutations = [
		["omitted export", plan => { plan.exports.pop(); }]
		, ["wrong private ABI", plan => { plan.privateAbi.version = 7; }]
		, ["changed output Fin bound", plan => {
			const item = plan.exports.find(value =>
				value.sourceDeclaration.endsWith("produceStamped"));
			item.refinements.result.fields[1].refinement.bound = "9";
		}]
		, ["invented output constructor", plan => {
			const item = plan.exports.find(value =>
				value.sourceDeclaration.endsWith("produce"));
			item.refinements.result.constructor = "InheritedCheckedRecords.mkTicket";
		}]
		, ...base.apiMode === "full" ? [
			["changed outer constructor", plan => {
				const item = plan.exports.find(value => value.sourceDeclaration.endsWith("first"));
				item.refinements.parameters[0].constructor
					= "InheritedCheckedRecords.normalizeTicket";
			}]
			, ["changed inherited parent constructor", plan => {
				const item = plan.exports.find(value =>
					value.sourceDeclaration.endsWith("first"));
				item.refinements.parameters[0].fields[0].refinement.constructor
					= "InheritedCheckedRecords.normalizeSpan";
			}]
			, ["changed field constructor", plan => {
				const item = plan.exports.find(value => value.sourceDeclaration.endsWith("first"));
				item.refinements.parameters[0].fields[1].refinement.constructor
					= "InheritedCheckedRecords.normalizeWord";
			}]
			, ["changed inherited child constructor", plan => {
				const item = plan.exports.find(value =>
					value.sourceDeclaration.endsWith("nested"));
				item.refinements.parameters[0].fields[0].refinement.constructor
					= "InheritedCheckedRecords.normalizeTicket";
			}]
		] : []
	];
	for(const [name, mutate] of adapterMutations)
	{
		const plan = JSON.parse(originals.get("build-0/locks/compiler-adapters.json"));
		mutate(plan); const value = Buffer.from(canonicalJson(plan));
		const changes = new Map([0, 1].map(attempt => [
			`build-${attempt}/locks/compiler-adapters.json`, value
		]));
		await assert.rejects(checkInheritedCheckedRecordNpmReport(
			path => selected(path, changes), options), name);
	}
	for(const [path, value] of originals)
		assert.equal(sha256(value), identities.get(path), path);
	return {
		schemaVersion: 1, checkerCommit: options.checkerCommit, accepted
		, recordControls, reportControls: reportMutations.length
		, adapterControls: adapterMutations.length
	};
};
