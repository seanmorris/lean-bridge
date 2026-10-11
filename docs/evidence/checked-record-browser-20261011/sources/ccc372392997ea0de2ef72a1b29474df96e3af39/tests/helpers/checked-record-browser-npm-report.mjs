/**
 * Reconcile original checked-record npm executions with source, compiler and receipt identities.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { validateCompilerAdapterPlan } from "../../src/build/compiler-adapters.mjs";
import { validateComponentBuildPlan } from "../../src/build/component-plan.mjs";
import { createComponentPrivateAbi } from "../../src/build/component-callable-adapters.mjs";
import { validateComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { checkedRecordBrowserRoutes, checkedRecordBrowserSelection, checkedRecordBrowserExpected } from "./checked-record-browser-fixture.mjs";
import { assertJsonSchema } from "./json-schema.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const buildPaths = ["binding/binding-ir.json", "locks/compiler-adapters.json", "locks/component-build-plan.json", "metadata/provenance.json", "component-package-receipt.json", "CheckedRecords.lean"];
export const checkedRecordNpmRecordPaths = Object.freeze([
	"report.json", "configuration.json", "expected.binding-ir.json", "install.json"
	, "index.mjs", "index.mts", "check.mjs", "installed.json", "relocated.json"
	, ...[0, 1].flatMap(attempt => buildPaths.map(path => `build-${attempt}/${path}`))
]);

/**
 * Validate two reproduced builds, exact public callers and both installed executions.
 *
 * @param read - Reader of original run records, relative to the selected route.
 * @param options - Expected route and original producer identity.
 * @param options.route - Ordinary or independently reviewed source.
 * @param options.producerCommit - Frozen Git revision used to produce the original records.
 */
export const checkCheckedRecordNpmReport = async (read, { route, producerCommit }) => {
	assert.ok(checkedRecordBrowserRoutes.includes(route)); assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	const original = path => execFileSync("git", ["show", `${producerCommit}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
	const report = await json("report.json");
	const { configuration, expected, reviewed, resultOnly } = checkedRecordBrowserSelection(route);
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route); assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.configuration, configuration); assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.independentBuilds, 2); assert.equal(report.builds.length, 2);
	for(const key of ["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath", "relocatedInstallation"]) assert.equal(report[key], true, key);
	assert.deepEqual(report.dispatch, { observed: false, reason: "No constructor/source entry counters in this npm caller" });
	assert.deepEqual(report.builds[1], report.builds[0]);
	const inputs = { "lean-bridge.exports.json": Buffer.from(canonicalJson(configuration)) };
	for(const path of ["CheckedRecords.lean", "lakefile.toml", "lean-toolchain", "LICENSE", "package.json"])
		inputs[path] = original(`tests/fixtures/onboarding/checked-records/${path}`);
	if(reviewed) inputs["api.binding-ir.json"] = Buffer.from(canonicalJson(expected));
	const sourceInputs = Object.keys(inputs).sort((a, b) => a.localeCompare(b)).map(path => ({ path, bytes: inputs[path].length, sha256: sha256(inputs[path]) }));
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, build = report.builds[attempt];
		const ir = await json(prefix + "binding/binding-ir.json"), adapters = await json(prefix + "locks/compiler-adapters.json");
		const plan = await json(prefix + "locks/component-build-plan.json"), provenance = await json(prefix + "metadata/provenance.json");
		const receipt = await json(prefix + "component-package-receipt.json");
		validateBindingIr(ir); validateCompilerAdapterPlan(adapters); validateComponentBuildPlan(plan); validateComponentPackageReceipt(receipt);
		await assertJsonSchema("compiler-adapter-plan", adapters);
		assert.equal(reviewedContractDifference(expected, ir), null);
		assert.equal(ir.types.length, resultOnly ? 1 : 3);
		for(const definition of ir.types)
		{
			const reviewedType = expected.types.find(item => item.id === definition.id);
			assert.ok(reviewedType);
			assert.deepEqual(definition.fields.map(field => ({ name: field.name, type: field.type })), reviewedType.fields.map(field => ({ name: field.name, type: field.type })));
			for(const key of ["lean-lang.org/erased-proofs", "lean-lang.org/instantiation"])
				assert.deepEqual(definition.source.extensions[key], reviewedType.source.extensions[key]);
		}
		assert.equal(build.bindingIrSha256, hashBindingIr(ir)); assert.equal(receipt.bindingIrSha256, build.bindingIrSha256);
		assert.equal(plan.bindingIr.semanticSha256, build.bindingIrSha256);
		assert.equal(build.receiptSha256, sha256(await read(prefix + "component-package-receipt.json")));
		assert.equal(build.componentArchiveSha256, receipt.package.sha256); assert.equal(build.runtimeArchiveSha256, receipt.runtime.sha256);
		assert.deepEqual(report.receipt, receipt);
		assert.deepEqual(await read(prefix + "CheckedRecords.lean"), inputs["CheckedRecords.lean"]);
		assert.deepEqual(plan.source.inputs, sourceInputs); assert.equal(plan.source.toolchain, inputs["lean-toolchain"].toString().trim());
		assert.equal(receipt.source.treeSha256, plan.source.treeSha256);
		assert.deepEqual(plan.targets, ["npm"]); assert.deepEqual(plan.component, ir.component); assert.deepEqual(receipt.component, ir.component);
		assert.equal(adapters.component, ir.component.id); assert.deepEqual(adapters.imports, ["CheckedRecords"]);
		assert.deepEqual(adapters.privateAbi, createComponentPrivateAbi(ir)); assert.equal(adapters.privateAbi.version, 8);
		assert.equal(adapters.componentPlanSha256, sha256(await read(prefix + "locks/component-build-plan.json")));
		assert.deepEqual(plan.bindingIr.declarations, ir.declarations.map(declaration => declaration.id).sort());
		assert.deepEqual(adapters.exports.map(item => item.bindingId).sort(), plan.bindingIr.declarations);
		assert.equal(adapters.exports.length, resultOnly ? 1 : 8);
		for(const item of adapters.exports)
		{
			const declaration = ir.declarations.find(value => value.id === item.bindingId);
			const reviewedDeclaration = expected.declarations.find(value => value.id === item.bindingId);
			assert.ok(reviewedDeclaration);
			assert.deepEqual(declaration.source.extensions["lean-lang.org/refinements"], reviewedDeclaration.source.extensions["lean-lang.org/refinements"]);
			assert.deepEqual(item.refinements, declaration.source.extensions["lean-lang.org/refinements"]);
			assert.equal(item.sourceDeclaration, declaration.source.declaration); assert.equal(item.sourceModule, "CheckedRecords");
			assert.equal(item.sourceApplication, declaration.source.extensions["lean-lang.org/specialization"]?.application);
			assert.equal(item.symbol, "lean_bridge_" + sha256(`${ir.component.id}\0${item.bindingId}`).slice(0, 24));
			assert.equal(item.wrapper, "export_" + sha256(item.bindingId).slice(0, 20));
		}
		assert.equal(provenance.schemaVersion, 1); assert.equal(provenance.component, ir.component.id);
		assert.equal(provenance.sourceTreeSha256, plan.source.treeSha256); assert.equal(provenance.componentPlanSha256, adapters.componentPlanSha256);
		assert.equal(receipt.provenanceSha256, sha256(await read(prefix + "metadata/provenance.json")));
		for(const key of ["compilationPlanSha256", "componentArtifactManifestSha256", "linkManifestSha256", "targetCManifestSha256"]) digest(provenance[key]);
	}
	for(const path of buildPaths) assert.deepEqual(await read(`build-0/${path}`), await read(`build-1/${path}`));
	const caller = `import * as api from "checkedrecords";\nimport {checkCheckedRecords} from "./check.mjs";\nconsole.log(JSON.stringify(checkCheckedRecords(api, ${resultOnly})));\n`;
	assert.equal((await read("index.mjs")).toString(), caller); assert.equal(report.consumerSha256, sha256(caller));
	for(const [record, source] of [["check.mjs", "javascript.mjs"], ["index.mts", resultOnly ? "result-only.mts" : "full.mts"]])
		assert.deepEqual(await read(record), original(`tests/fixtures/checked-record-browser/${source}`));
	assert.equal(report.corpusSha256, sha256(await read("check.mjs")));
	assert.deepEqual(report.typescript, { strict: true, skipLibCheck: false, sourceSha256: sha256(await read("index.mts")) });
	assert.deepEqual(Object.keys(report.trees).sort(), ["@lean-bridge/runtime", "checkedrecords"]);
	for(const tree of Object.values(report.trees))
	{
		assert.ok(Object.keys(tree).length > 5); assert.ok(Object.hasOwn(tree, "package.json"));
		for(const [path, hash] of Object.entries(tree))
		{
			assert.ok(!path.startsWith("/") && !path.split("/").some(part => ["", ".", ".."].includes(part)));
			digest(hash);
		}
	}
	const component = report.trees.checkedrecords;
	for(const path of ["metadata/provenance.json", "metadata/binding-ir.json"])
		assert.equal(component[path], sha256(await read(`build-0/${path === "metadata/binding-ir.json" ? "binding/binding-ir.json" : path}`)));
	assert.equal(component["metadata/lean-bridge.exports.json"], sha256(canonicalJson(configuration)));
	assert.equal(component["metadata/component-release-bundle.json"], report.receipt.componentBundleSha256);
	assert.equal(component["metadata/runtime-requirement.json"], report.receipt.runtimeRequirementSha256);
	const wasm = Object.keys(component).filter(path => path.startsWith("internal/wasm/") && path.endsWith(".so.wasm"));
	assert.equal(wasm.length, 1); assert.equal(component[wasm[0]], report.receipt.componentArtifactSha256);
	for(const path of ["index.mjs", "index.d.ts", "internal/runtime.mjs", "internal/validators.mjs"]) digest(component[path]);
	const install = await json("install.json"); assert.equal(install.code, 0);
	// npm may print its cached version notice even during a successful offline install.
	assert.match(install.stderr, /^(?:npm notice[^\n]*\n)*$/u);
	assert.match(install.stdout, /^\nadded 2 packages in [0-9]+(?:ms|s)\n$/u);
	assert.equal(report.observations.length, 2);
	for(const [index, name] of ["installed", "relocated"].entries())
	{
		const observation = await json(`${name}.json`); assert.deepEqual(report.observations[index], observation);
		assert.equal(observation.relocated, index === 1);
		assert.deepEqual(observation.result, { code: 0, stdout: JSON.stringify(checkedRecordBrowserExpected(route)) + "\n", stderr: "" });
		assert.deepEqual(observation.typescript, { code: 0, stdout: "", stderr: "" });
	}
	return { route, producerCommit, ...checkedRecordBrowserExpected(route), executions: 2, dispatchObserved: false };
};
