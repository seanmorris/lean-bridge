/**
 * Independently authenticate retained dependent checked-record npm and browser
 * records without trusting the hosted producer's assertions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateCompilerAdapterPlan } from "../../src/build/compiler-adapters.mjs";
import { createComponentPrivateAbi } from "../../src/build/component-callable-adapters.mjs";
import { validateComponentBuildPlan } from "../../src/build/component-plan.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	parseNpmPackageCoordinate, validateComponentPackageReceipt
} from "../../src/release/component-package-receipt.mjs";
import {
	dependentCheckedRecordBrowserPackage
	, dependentCheckedRecordEngines
	, dependentCheckedRecordExpected
	, dependentCheckedRecordName
	, dependentCheckedRecordProfiles
	, dependentCheckedRecordSelection
	, validateDependentCheckedRecordObservation
	, validateDependentCheckedRecordPhases
} from "./dependent-checked-record-browser-fixture.mjs";
import {
	readOwnedPerlCallbackVariantTar as readRepositoryTar
} from "./owned-perl-callback-result-variant-archives.mjs";

const fixtureRoot = "tests/fixtures/onboarding/dependent-checked-records";
const consumerRoot = "tests/fixtures/dependent-checked-record-browser";
const fixturePaths = Object.freeze([
	"DependentRecords.lean", "LICENSE", "lakefile.toml"
	, "lean-toolchain", "package.json"
]);
const buildPaths = Object.freeze([
	"binding/binding-ir.json", "component-package-receipt.json"
	, "locks/compiler-adapters.json", "locks/component-build-plan.json"
	, "metadata/provenance.json", "DependentRecords.lean"
]);
const callerPaths = Object.freeze(["index.mjs", "check.mjs", "index.mts"]);
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const exactKeys = (value, keys) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort());
const stableInputs = state => state.map(
	({ path, mode, sha256: hash }) => ({ path, mode, sha256: hash })
);
const canonical = async (read, path) => {
	const bytes = await read(path), value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path);
	return value;
};
const profilePaths = profile => {
	const entry = {
		"browser-javascript": "plain", "browser-react": "react"
		, "browser-worker": "worker-main"
	}[profile];
	return [
		"check.mjs", "index.html", "inputs.json", "install.json"
		, "installed-binding-ir.json", "installed-component-package.json"
		, "installed-index.d.ts", "installed-runtime-identity.json"
		, "installed-runtime-package.json", "javascript.mjs", "observations.json"
		, "package-lock.json", "package.mjs", "package.json", "report.json"
		, "request.json", `${entry}.mjs`
		, ...profile === "browser-worker" ? ["worker.mjs"] : []
	].map(path => `browser/${profile}/${path}`);
};

/**
 * Enumerate the complete original file closure for one hosted route.
 *
 * @param receipt - Independently validated component-package receipt.
 */
export const dependentCheckedRecordBrowserRecordPaths = receipt => {
	validateComponentPackageReceipt(receipt);
	return [
		"browser.json", "configuration.json", "expected.binding-ir.json"
		, "install.json", "installed.json", "relocated.json", "report.json"
		, ...callerPaths
		, "handoff/component-package-receipt.json"
		, "handoff/verify-component-package-receipt.mjs"
		, `handoff/${receipt.package.archive}`, `handoff/${receipt.runtime.archive}`
		, ...[0, 1].flatMap(attempt => [
			...buildPaths.map(path => `build-${attempt}/${path}`)
			, `build-${attempt}/author-inputs.json`
		])
		, ...dependentCheckedRecordProfiles.flatMap(profilePaths)
	].sort();
};

const sourceInputs = (original, selection) => {
	const inputs = {
		"lean-bridge.exports.json": Buffer.from(
			canonicalJson(selection.configuration)
		)
	};
	for(const path of fixturePaths)
		inputs[path] = original(`${fixtureRoot}/${path}`);
	if(selection.reviewed)
		inputs["api.binding-ir.json"] = Buffer.from(
			canonicalJson(selection.expected)
		);
	return inputs;
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
	const refinements
		= record.source.extensions["lean-lang.org/nominal-refinements"];
	assert.deepEqual(refinements, {
		kind: "record"
		, fields: [null, { kind: "fin-field", field: "bound" }]
	});
};

const assertHandoff = async (read, report, original) => {
	const receipt = report.receipt;
	validateComponentPackageReceipt(receipt);
	assert.equal((await read(
		"handoff/component-package-receipt.json"
	)).toString(), canonicalJson(receipt));
	assert.deepEqual(await read(
		"handoff/verify-component-package-receipt.mjs"
	), original("src/release/component-package-receipt.mjs"));
	const basisBytes = await read(
		"browser/browser-javascript/installed-runtime-identity.json"
	);
	const basis = JSON.parse(basisBytes);
	assert.equal(basisBytes.toString(), canonicalJson(basis));
	assert.ok(typeof basis.packing?.collationLocale === "string"
		&& basis.packing.collationLocale.length > 0);
	const packages = {};
	for(const [role, item] of [
		["runtime", receipt.runtime], ["component", receipt.package]
	]) {
		const bytes = await read(`handoff/${item.archive}`);
		assert.equal(sha256(bytes), item.sha256);
		const files = readRepositoryTar(
			bytes, "package", basis.packing.collationLocale
		);
		const metadata = JSON.parse(files.get("package.json"));
		const coordinate = parseNpmPackageCoordinate(item.package);
		const expectedName = role === "runtime"
			? "@lean-bridge/runtime" : dependentCheckedRecordName;
		assert.equal(coordinate.name, expectedName);
		assert.equal(metadata.name, expectedName);
		assert.equal(metadata.version, coordinate.version);
		assert.deepEqual(
			Object.fromEntries([...files].map(([path, value]) => [
				path, sha256(value)
			])), report.trees[expectedName]
		);
		if(role === "runtime")
		{
			assert.deepEqual(files.get("runtime-identity.json"), basisBytes);
			assert.equal(metadata.leanBridge.runtimeIdentity, sha256(basisBytes));
		}
		else
		{
			assert.equal(sha256(files.get("index.d.ts"))
				, report.typescript.declarationsSha256);
			assert.deepEqual(metadata.leanBridge, {
				component: receipt.package.package
				, componentBundleSha256: receipt.componentBundleSha256
				, componentIdentitySha256: receipt.componentIdentitySha256
				, bindingIrSha256: report.builds[0].bindingIrSha256
				, sharedRuntime: true
			});
		}
		packages[role] = metadata;
	}
	assert.deepEqual(packages.component.dependencies
		, { "@lean-bridge/runtime": packages.runtime.version });
};

/**
 * Authenticate the reproduced npm package, both source-free Node executions,
 * and all author/build identities.
 *
 * @param read - Route-relative original byte reader.
 * @param options - Independent route and producer identity.
 * @param options.route - Closed ordinary/reviewed and full/result-only route.
 * @param options.producerCommit - Exact hosted package-producing revision.
 */
export const checkDependentCheckedRecordNpmReport = async (
	read, { route, producerCommit }
) => {
	const selection = dependentCheckedRecordSelection(route);
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const original = path => execFileSync(
		"git", ["show", `${producerCommit}:${path}`]
		, { maxBuffer: 32 * 1024 * 1024 }
	);
	const reportBytes = await read("report.json");
	const report = JSON.parse(reportBytes);
	assert.equal(reportBytes.toString(), canonicalJson(report));
	exactKeys(report, [
		"schemaVersion", "route", "producerCommit", "configuration", "builds"
		, "receipt", "trees", "observations", "expectedBindingIrSha256"
		, "expected", "consumerProfiles", "callers", "typescript"
		, "independentBuilds", "reproducible", "authorInputsUnchanged"
		, "sourceCommitClean", "sourceRemovedBeforeInstallation"
		, "offlineInstall", "compilerFreePath", "relocatedInstallation"
		, "relation"
	]);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.configuration, selection.configuration);
	assert.deepEqual(await canonical(read, "configuration.json")
		, selection.configuration);
	assert.deepEqual(report.expected, dependentCheckedRecordExpected(route));
	assert.deepEqual(await canonical(read, "expected.binding-ir.json")
		, selection.expected);
	assert.equal(report.expectedBindingIrSha256
		, hashBindingIr(selection.expected));
	assert.equal(report.relation, "below < bound");
	assert.deepEqual(report.consumerProfiles
		, ["node-javascript", "node-typescript"]);
	assert.equal(report.independentBuilds, 2);
	assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]);
	for(const key of [
		"reproducible", "authorInputsUnchanged", "sourceCommitClean"
		, "sourceRemovedBeforeInstallation", "offlineInstall"
		, "compilerFreePath", "relocatedInstallation"
	]) assert.equal(report[key], true, key);
	const inputs = sourceInputs(original, selection);
	const inputPaths = Object.keys(inputs).sort();
	let firstStable;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`;
		const build = report.builds[attempt];
		exactKeys(build, [
			"authorInputsSha256", "bindingIrSha256", "bindingIrFileSha256"
			, "receiptSha256", "componentArchiveSha256"
			, "runtimeArchiveSha256"
		]);
		const irBytes = await read(prefix + "binding/binding-ir.json");
		const ir = JSON.parse(irBytes);
		assert.equal(irBytes.toString(), canonicalJson(ir));
		assertDependentProvenance(ir, selection.expected);
		const adapters = await canonical(
			read, prefix + "locks/compiler-adapters.json"
		);
		const plan = await canonical(
			read, prefix + "locks/component-build-plan.json"
		);
		const provenance = await canonical(
			read, prefix + "metadata/provenance.json"
		);
		const receipt = await canonical(
			read, prefix + "component-package-receipt.json"
		);
		validateCompilerAdapterPlan(adapters);
		validateComponentBuildPlan(plan);
		validateComponentPackageReceipt(receipt);
		assert.equal(build.bindingIrSha256, hashBindingIr(ir));
		assert.equal(build.bindingIrFileSha256, sha256(irBytes));
		assert.equal(build.receiptSha256, sha256(await read(
			prefix + "component-package-receipt.json"
		)));
		assert.equal(build.componentArchiveSha256, receipt.package.sha256);
		assert.equal(build.runtimeArchiveSha256, receipt.runtime.sha256);
		assert.deepEqual(report.receipt, receipt);
		assert.deepEqual(await read(prefix + "DependentRecords.lean")
			, inputs["DependentRecords.lean"]);
		assert.equal(plan.bindingIr.semanticSha256, build.bindingIrSha256);
		assert.equal(receipt.bindingIrSha256, build.bindingIrSha256);
		assert.deepEqual(plan.targets, ["npm"]);
		assert.deepEqual(plan.component, ir.component);
		assert.deepEqual(receipt.component, ir.component);
		assert.equal(adapters.component, ir.component.id);
		assert.deepEqual(adapters.imports, ["DependentRecords"]);
		assert.deepEqual(adapters.privateAbi, createComponentPrivateAbi(ir));
		assert.equal(adapters.componentPlanSha256, sha256(await read(
			prefix + "locks/component-build-plan.json"
		)));
		assert.equal(provenance.sourceTreeSha256, plan.source.treeSha256);
		assert.equal(provenance.componentPlanSha256
			, adapters.componentPlanSha256);
		assert.equal(receipt.source.treeSha256, plan.source.treeSha256);
		assert.equal(receipt.provenanceSha256, sha256(await read(
			prefix + "metadata/provenance.json"
		)));
		const planInputs = Object.fromEntries(
			plan.source.inputs.map(item => [item.path, item])
		);
		assert.deepEqual(Object.keys(planInputs).sort(), inputPaths);
		for(const [path, bytes] of Object.entries(inputs))
			assert.deepEqual(planInputs[path], {
				path, bytes: bytes.length, sha256: sha256(bytes)
			});
		const state = await canonical(read, prefix + "author-inputs.json");
		assert.deepEqual(state.map(item => item.path).sort(), inputPaths);
		for(const item of state)
		{
			exactKeys(item, ["ctime", "mode", "mtime", "path", "sha256"]);
			assert.equal(item.mode, 0o100644);
			assert.ok(Number.isFinite(item.mtime)
				&& Number.isFinite(item.ctime));
			assert.equal(item.sha256, sha256(inputs[item.path]));
		}
		const stable = stableInputs(state);
		assert.equal(build.authorInputsSha256, sha256(canonicalJson(stable)));
		if(attempt === 0) firstStable = stable;
		else assert.deepEqual(stable, firstStable);
	}
	for(const path of buildPaths)
		assert.deepEqual(await read(`build-0/${path}`)
			, await read(`build-1/${path}`), path);
	const index = `import * as api from "${dependentCheckedRecordName}";\n`
		+ "import {checkDependentRecords} from \"./check.mjs\";\n"
		+ `console.log(JSON.stringify(checkDependentRecords(api, ${selection.resultOnly}, ${selection.reviewed})));\n`;
	const callers = {
		"index.mjs": Buffer.from(index)
		, "check.mjs": original(`${consumerRoot}/javascript.mjs`)
		, "index.mts": original(`${consumerRoot}/${
			selection.resultOnly ? "result-only" : "full"
		}.mts`)
	};
	exactKeys(report.callers, callerPaths);
	for(const [path, source] of Object.entries(callers))
	{
		assert.deepEqual(await read(path), source);
		assert.equal(report.callers[path], sha256(source));
	}
	assert.deepEqual(report.typescript, {
		strict: true, skipLibCheck: false
		, sourceSha256: sha256(callers["index.mts"])
		, declarationsSha256: report.typescript.declarationsSha256
	});
	digest(report.typescript.declarationsSha256);
	assert.deepEqual(Object.keys(report.trees).sort()
		, ["@lean-bridge/runtime", dependentCheckedRecordName]);
	for(const tree of Object.values(report.trees))
	{
		assert.ok(Object.keys(tree).length > 5);
		assert.ok(Object.hasOwn(tree, "package.json"));
		assert.ok(!Object.keys(tree).some(path => path.endsWith(".lean")));
		for(const [path, hash] of Object.entries(tree))
		{
			const unsafe = path.split("/").some(
				part => ["", ".", ".."].includes(part)
			);
			assert.ok(!path.startsWith("/") && !unsafe);
			digest(hash);
		}
	}
	await assertHandoff(read, report, original);
	assert.equal(report.observations.length, 2);
	for(const [index_, name] of ["installed.json", "relocated.json"].entries())
	{
		const observation = await canonical(read, name);
		assert.deepEqual(report.observations[index_], observation);
		exactKeys(observation, ["relocated", "result", "typescript"]);
		assert.equal(observation.relocated, index_ === 1);
		assert.deepEqual(observation.result, {
			code: 0
			, stdout: JSON.stringify(report.expected) + "\n", stderr: ""
		});
		assert.deepEqual(observation.typescript
			, { code: 0, stdout: "", stderr: "" });
	}
	const install = await canonical(read, "install.json");
	assert.equal(install.code, 0);
	assert.match(install.stderr, /^(?:npm notice[^\n]*\n)*$/u);
	assert.match(install.stdout
		, /^\nadded 2 packages in [0-9]+(?:ms|s)\n$/u);
	return {
		route, producerCommit, npmReportSha256: sha256(reportBytes)
		, expected: report.expected, receipt: report.receipt
		, bindingIrSha256: report.builds[0].bindingIrSha256
		, declarationsSha256: report.typescript.declarationsSha256
		, trees: report.trees, nodeExecutions: report.observations.length
	};
};

const variantsFor = profile => profile === "browser-react"
	? ["production", "strict"] : ["production"];
const lifecycle = (profile, variant) => profile === "browser-worker"
	? { created: 2, terminated: 2, live: 0 }
	: profile === "browser-react"
		? variant === "strict"
			? { effects: 6, cleanups: 5, ignored: 3, commits: 3 }
			: { effects: 3, cleanups: 2, ignored: 0, commits: 3 }
		: { rerun: true };
const byHash = files => files.map(
	({ bytes, sha256: hash }) => ({ bytes, sha256: hash })
).sort((left, right) => left.sha256.localeCompare(right.sha256));

const checkBrowserInputs = async ({
	item, npm, read, json, original
}) => {
	const { profile } = item, prefix = `browser/${profile}/`;
	const entry = {
		"browser-javascript": "plain", "browser-react": "react"
		, "browser-worker": "worker-main"
	}[profile];
	const names = [
		"package.json", "package-lock.json", "request.json", "package.mjs"
		, "index.html", "javascript.mjs", "check.mjs", `${entry}.mjs`
		, ...profile === "browser-worker" ? ["worker.mjs"] : []
	];
	assert.deepEqual(item.inputs, await json(prefix + "inputs.json"));
	exactKeys(item.inputs, names);
	for(const name of names)
	{
		const bytes = await read(prefix + name);
		assert.deepEqual(item.inputs[name]
			, { bytes: bytes.length, sha256: sha256(bytes) });
	}
	assert.equal((await read(prefix + "package.mjs")).toString()
		, dependentCheckedRecordBrowserPackage);
	assert.deepEqual(await json(prefix + "request.json"), {
		module: dependentCheckedRecordName, profile, route: item.route
		, resultOnly: dependentCheckedRecordSelection(item.route).resultOnly
	});
	assert.equal((await read(prefix + "index.html")).toString()
		, `<!doctype html><meta charset="utf-8"><title>Installed corpus</title><div id="root"><button id="rerun">Run again</button><button id="stop">Stop worker</button><pre id="result" data-status="loading"></pre></div><script type="module" src="./${entry}.mjs"></script>\n`);
	assert.deepEqual(await read(prefix + "javascript.mjs")
		, original(`${consumerRoot}/browser.mjs`));
	assert.deepEqual(await read(prefix + "check.mjs")
		, original(`${consumerRoot}/javascript.mjs`));
	for(const name of [entry
		, ...profile === "browser-worker" ? ["worker"] : []])
		assert.deepEqual(await read(prefix + `${name}.mjs`)
			, original(`tests/fixtures/type-corpus/consumers/browser/${
				name
			}.mjs`));
	assert.equal(hashBindingIr(await json(
		prefix + "installed-binding-ir.json"
	)), npm.bindingIrSha256);
	assert.equal(sha256(await read(prefix + "installed-index.d.ts"))
		, npm.declarationsSha256);
};

const checkBrowserPackages = async ({ item, npm, read, json, original }) => {
	const { profile, browser } = item, prefix = `browser/${profile}/`;
	const install = await json(prefix + "install.json");
	assert.equal(install.code, 0);
	assert.match(install.stderr, /^(?:npm notice[^\n]*\n)*$/u);
	assert.match(install.stdout, new RegExp(
		`^\\nadded ${profile === "browser-react" ? 5 : 2} packages in [0-9]+(?:ms|s)\\n$`
		, "u"));
	const runtime = await json(prefix + "installed-runtime-package.json");
	const basis = await json(prefix + "installed-runtime-identity.json");
	assert.equal(runtime.leanBridge.runtimeIdentity
		, sha256(canonicalJson(basis)));
	assert.equal(`${runtime.name}@${runtime.version}`
		, npm.receipt.runtime.package);
	const component = await json(prefix + "installed-component-package.json");
	assert.equal(`${component.name}@${component.version}`
		, npm.receipt.package.package);
	assert.deepEqual(component.dependencies
		, { "@lean-bridge/runtime": runtime.version });
	assert.deepEqual(component.leanBridge, {
		component: npm.receipt.package.package
		, componentBundleSha256: npm.receipt.componentBundleSha256
		, componentIdentitySha256: npm.receipt.componentIdentitySha256
		, bindingIrSha256: npm.bindingIrSha256, sharedRuntime: true
	});
	const manifest = await json(prefix + "package.json");
	const lock = await json(prefix + "package-lock.json");
	assert.deepEqual(manifest
		, { private: true, type: "module", dependencies: manifest.dependencies });
	assert.equal(lock.lockfileVersion, 3);
	const frameworkNames = profile === "browser-react"
		? ["react", "react-dom", "scheduler"] : [];
	const dependencies = [
		"@lean-bridge/runtime", dependentCheckedRecordName, ...frameworkNames
	];
	exactKeys(lock.packages, [
		"", ...dependencies.map(name => `node_modules/${name}`)
	]);
	exactKeys(manifest.dependencies, dependencies);
	for(const [metadata, archive] of [
		[component, npm.receipt.package.archive]
		, [runtime, npm.receipt.runtime.archive]
	]) {
		const dependency = lock.packages[`node_modules/${metadata.name}`];
		assert.equal(dependency.version, metadata.version);
		assert.equal(dependency.resolved, `file:../handoff/${archive}`);
		assert.equal(manifest.dependencies[metadata.name], dependency.resolved);
		assert.equal(dependency.integrity, "sha512-" + createHash("sha512")
			.update(await read(`handoff/${archive}`)).digest("base64"));
		assert.equal(metadata.exports["."].browser, "./index.mjs");
	}
	assert.deepEqual(browser.framework.map(item => item.name), frameworkNames);
	const repositoryLock = JSON.parse(original("package-lock.json"));
	for(const framework of browser.framework)
	{
		assert.equal(framework.version
			, repositoryLock.packages[
				`node_modules/${framework.name}`
			].version);
		digest(framework.sha256);
		assert.equal(framework.archive
			, `framework/${framework.name}-${framework.version}.tgz`);
		const dependency = lock.packages[`node_modules/${framework.name}`];
		assert.equal(dependency.version, framework.version);
		assert.equal(dependency.resolved, `file:${framework.archive}`);
		assert.equal(manifest.dependencies[framework.name]
			, dependency.resolved);
	}
	assert.equal(browser.installedAssets.length, 2);
	const main = browser.installedAssets.find(asset =>
		asset.path
			=== "node_modules/@lean-bridge/runtime/internal/main.wasm"
	);
	assert.ok(main);
	assert.equal(main.sha256, basis.files.find(
		file => file.path === "internal/main.wasm"
	).sha256);
	const wasm = browser.installedAssets.find(asset => asset !== main);
	assert.match(wasm.path
		, /^node_modules\/dependentrecords\/internal\/wasm\/[^/]+\.wasm$/u);
	assert.equal(wasm.sha256, npm.receipt.componentArtifactSha256);
};

const checkBrowserExecutions = (item, browserVersions) => {
	const { profile, browser } = item, variants = variantsFor(profile);
	assert.deepEqual(browser.deployments.map(value => value.variant), variants);
	for(const deployment of browser.deployments)
	{
		assert.equal(deployment.sha256
			, sha256(canonicalJson(deployment.files)));
		assert.equal(new Set(deployment.files.map(
			value => value.path
		)).size, deployment.files.length);
		assert.deepEqual(byHash(deployment.files.filter(
			file => file.path.endsWith(".wasm")
		)), byHash(browser.installedAssets));
		for(const name of [dependentCheckedRecordName, "@lean-bridge/runtime"])
			assert.ok(deployment.modulePaths.includes(
				`node_modules/${name}/index.mjs`
			));
	}
	assert.deepEqual(browser.executions.map(
		({ engine, variant }) => ({ engine, variant })
	), dependentCheckedRecordEngines.flatMap(engine =>
		variants.map(variant => ({ engine, variant }))));
	assert.deepEqual(item.observation, browser.executions[0].observation);
	for(const execution of browser.executions)
	{
		browserVersions[execution.engine]
			??= execution.observation.hostVersion;
		assert.equal(execution.observation.hostVersion
			, browserVersions[execution.engine]);
		validateDependentCheckedRecordObservation(
			execution.observation, profile, item.route
		);
		assert.equal(execution.failedAssetRecovery, true);
		assert.deepEqual(execution.lifecycle
			, lifecycle(profile, execution.variant));
		if(profile === "browser-react")
			assert.equal(execution.pendingUnmount, true);
		const deployment = browser.deployments.find(
			value => value.variant === execution.variant
		);
		assert.equal(execution.assets.length
			, profile === "browser-worker" ? 4 : 2);
		for(const asset of execution.assets)
		{
			assert.equal(asset.status, 200);
			assert.match(asset.mime, /^application\/wasm/u);
			assert.ok(Number.isSafeInteger(asset.bytes) && asset.bytes > 0);
			const installed = browser.installedAssets.find(
				value => value.sha256 === asset.sha256
			);
			assert.ok(installed);
			const deployed = deployment.files.find(
				value => `/corpus/nested/${value.path}` === asset.path
			);
			assert.ok(deployed);
			assert.deepEqual(byHash([asset]), byHash([deployed]));
		}
	}
};

/**
 * Authenticate all page, React and worker executions against their npm
 * producer and immutable consumer sources.
 *
 * @param read - Route-relative original byte reader.
 * @param options - Independent route and producer identity.
 * @param options.route - Closed ordinary/reviewed and full/result-only route.
 * @param options.producerCommit - Exact hosted package-producing revision.
 */
export const checkDependentCheckedRecordBrowserReport = async (
	read, { route, producerCommit }
) => {
	const npm = await checkDependentCheckedRecordNpmReport(
		read, { route, producerCommit }
	);
	const original = path => execFileSync(
		"git", ["show", `${producerCommit}:${path}`]
		, { maxBuffer: 32 * 1024 * 1024 }
	);
	const json = path => canonical(read, path);
	const browserBytes = await read("browser.json");
	const browser = JSON.parse(browserBytes);
	assert.equal(browserBytes.toString(), canonicalJson(browser));
	exactKeys(browser, [
		"schemaVersion", "route", "producerCommit"
		, "requestedEngines", "reports"
	]);
	assert.equal(browser.schemaVersion, 1);
	assert.equal(browser.route, route);
	assert.equal(browser.producerCommit, producerCommit);
	assert.deepEqual(browser.requestedEngines, dependentCheckedRecordEngines);
	assert.deepEqual(browser.reports.map(item => item.profile)
		, dependentCheckedRecordProfiles);
	const browserVersions = {};
	let executions = 0, lifecycleObservations = 0, commonAssets;
	for(const item of browser.reports)
	{
		const { profile, browser: observed } = item;
		const prefix = `browser/${profile}/`;
		exactKeys(item, [
			"schemaVersion", "profile", "route", "producerCommit"
			, "bindingIrSha256", "receiptSha256"
			, "packageSourceSha256", "offlineInstall", "compilerFreePath"
			, "sourceRemovedBeforeInstallation", "inputs", "observations"
			, "observation", "browser"
		]);
		exactKeys(observed, [
			"requestedEngines", "installedAssets", "framework", "deployments"
			, "executions", "installedSourcesRemoved"
			, "externalNetworkBlocked"
		]);
		assert.deepEqual(item, await json(prefix + "report.json"));
		assert.equal(item.schemaVersion, 1);
		assert.equal(item.route, route);
		assert.equal(item.producerCommit, producerCommit);
		assert.equal(item.bindingIrSha256, npm.bindingIrSha256);
		assert.equal(item.receiptSha256, sha256(await read(
			"handoff/component-package-receipt.json"
		)));
		assert.equal(item.packageSourceSha256
			, sha256(dependentCheckedRecordBrowserPackage));
		for(const key of [
			"offlineInstall", "compilerFreePath"
			, "sourceRemovedBeforeInstallation"
		]) assert.equal(item[key], true);
		assert.deepEqual(item.observations
			, await json(prefix + "observations.json"));
		validateDependentCheckedRecordPhases(
			item.observations, profile, dependentCheckedRecordEngines, route
		);
		validateDependentCheckedRecordObservation(
			item.observation, profile, route
		);
		assert.deepEqual(observed.requestedEngines
			, dependentCheckedRecordEngines);
		assert.equal(observed.installedSourcesRemoved, true);
		assert.equal(observed.externalNetworkBlocked, true);
		await checkBrowserInputs({ item, npm, read, json, original });
		await checkBrowserPackages({ item, npm, read, json, original });
		checkBrowserExecutions(item, browserVersions);
		commonAssets ??= observed.installedAssets;
		assert.deepEqual(observed.installedAssets, commonAssets);
		executions += observed.executions.length;
		lifecycleObservations += item.observations.length;
	}
	assert.equal(executions, 12);
	assert.equal(lifecycleObservations, 51);
	exactKeys(browserVersions, dependentCheckedRecordEngines);
	return {
		route, producerCommit
		, npmReportSha256: npm.npmReportSha256
		, browserReportSha256: sha256(browserBytes)
		, nodeExecutions: npm.nodeExecutions, browserExecutions: executions
		, lifecycleObservations, browserVersions, expected: npm.expected
		, receipt: npm.receipt
	};
};
