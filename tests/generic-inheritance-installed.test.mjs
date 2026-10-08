/**
 * Installed inherited generic records: relocated source-free C, C++ and npm packages keep each
 * parent as its own field typed by its source alias, with instantiation provenance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import "./helpers/inheritance-subtype-harness-source-history-tests.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../src/build/native-graph-model.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { inspectLeanProject } from "../src/analyze/lean-project.mjs";
import { prepareLakeEntryIntent } from "../src/build/lake-entry-intent.mjs";
import { resolveLakeBuildWorkspace } from "../src/build/lake-build-workspace.mjs";
import { elaborateLakeEntryModules } from "../src/build/lake-entry-elaboration.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { refinementEngineTransport } from "./helpers/refinement-engine.mjs";
import { assertGenericInheritanceIr, checkGenericInheritanceNpmPackages, expectedGenericInheritanceRecords, expectedGenericInheritanceSignatures, genericInheritanceExports, genericInheritanceFixture, genericInheritanceSource } from "./helpers/generic-inheritance-packages.mjs";

const module = "GenericInheritance";
const exports = genericInheritanceExports.map(name => `${module}.${name}`);
const leanPrefix = join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");

/**
 * A Binding IR with exactly the expected types and export signatures, for the pure controls.
 *
 * @param edit - Changes one copy of the expected types or declarations.
 */
const expectedIr = (edit = () => {}) => {
	const types = structuredClone(expectedGenericInheritanceRecords(module)).map(({ instantiation, ...record }) => ({ ...record
		, source: { extensions: instantiation ? { "lean-lang.org/instantiation": instantiation } : {} } }));
	const declarations = structuredClone(expectedGenericInheritanceSignatures(module)).map(({ parameters, result, ...declaration }) => ({ ...declaration
		, parameters: parameters.map((type, index) => ({ name: `arg${index}`, type }))
		, result: { type: result } }));
	const find = name => [...types, ...declarations].find(item => item.id === `lean:${module}.${name}`);
	edit(find, types, declarations);
	return { types, declarations };
};

test("the installed-package check refuses a flattened, reordered or retyped parent, wrong provenance, extra types and wrong signatures", () => {
	assertGenericInheritanceIr(expectedIr(), module);
	const named = name => ({ kind: "named", id: `lean:${module}.${name}` });
	const nat = { kind: "primitive", name: "nat" };
	const cases = [
		["a flattened parent", find => { find("NatChild").fields = [{ name: "base", type: nat }, find("NatChild").fields[1]]; }]
		, ["parent after the child's own field", find => { find("UNatChild").fields.reverse(); }]
		, ["a parent typed by the structure, not its alias", find => { find("NatChild").fields[0].type = named("Base"); }]
		, ["a parent typed by another alias", find => { find("UNatChild").fields[0].type = named("NatBase"); }]
		, ["a renamed parent field", find => { find("MarkerTagged").fields[0].name = "tag"; }]
		, ["the phantom argument erased to Nat", find => { find("MarkerTag").source.extensions["lean-lang.org/instantiation"].arguments = [nat]; }]
		, ["the child's provenance dropped", find => { find("MarkerTagged").source.extensions = {}; }]
		, ["the parent's provenance naming the child structure", find => { find("NatBase").source.extensions["lean-lang.org/instantiation"].structure = `${module}.Child`; }]
		, ["Marker given an instantiation", find => { find("Marker").source.extensions["lean-lang.org/instantiation"] = { structure: `${module}.Marker`, arguments: [] }; }]
		, ["Marker dropped", (_, types) => { types.splice(types.findIndex(type => type.id === `lean:${module}.Marker`), 1); }]
		, ["an extra parent alias", (_, types) => { types.push({ id: `lean:${module}.NatBaseAgain`, kind: "record", fields: [{ name: "base", type: nat }], source: { extensions: {} } }); }]
		, ["an injected non-record type", (_, types) => { types.push({ id: `lean:${module}.Count`, kind: "alias", target: nat, source: { extensions: {} } }); }]
		, ["a record turned into another kind", find => { find("Marker").kind = "variant"; }]
		, ["an extra declaration", (_, __, declarations) => { declarations.push({ id: `lean:${module}.peek`, kind: "function", parameters: [{ name: "arg0", type: named("NatBase") }], result: { type: nat } }); }]
		, ["a declaration dropped", (_, __, declarations) => { declarations.pop(); }]
		, ["grow taking another child", find => { find("grow").parameters[0].type = named("UNatChild"); }]
		, ["grow taking its parent", find => { find("grow").parameters[0].type = named("NatBase"); }]
		, ["grow with an extra parameter", find => { find("grow").parameters.push({ name: "arg1", type: nat }); }]
		, ["lift returning a record", find => { find("lift").result.type = named("UNatChild"); }]
		, ["relabel returning its parent", find => { find("relabel").result.type = named("MarkerTag"); }]
		, ["relabel as a non-function", find => { find("relabel").kind = "constant"; }]];
	for(const [label, edit] of cases) assert.throws(() => assertGenericInheritanceIr(expectedIr(edit), module), assert.AssertionError, label);
});

test("fresh Lean gives the native model exactly the checked parent layout and provenance", { skip: process.env.LEAN_BRIDGE_GENERIC_INHERITANCE_LEAN_TEST !== "1", timeout: 900_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-generic-inheritance-installed-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project");
	await cp(genericInheritanceFixture, projectRoot, { recursive: true });
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: [module], exports, targets: { c: { name: "genericinheritance", version: "1.0.0" } } }));
	let captured;
	const options = { projectRoot
		, outputRoot: join(directory, "out")
		, leanPrefix
		, targets: ["c"]
		, profile: "native-library-v1"
		, receiptName: "native-component.json"
		, createModel: input => createCompiledNativeModel(input, { nativeRefinements: true })
		, createAdapters: generateCompiledNativeLeanAdapters
		, compileComponent: async ({ model }) => { captured = model; throw Object.assign(new Error("stop before C"), { code: "stop-before-c" }); } };
	await assert.rejects(() => buildElaboratedComponent(options), error => {
		if(error.code !== "stop-before-c") throw error;
		return true;
	});
	assertGenericInheritanceIr(captured.bindingIr, module);
	// Marker is provenance only: the native model compiles no value type for it.
	assert.ok(!captured.types.some(type => type.name === `${module}.Marker`));
	// The npm author project elaborates the same records under its own module name.
	const author = join(directory, "author");
	await cp("tests/fixtures/documentation/lean-author", author, { recursive: true });
	await saveLakeFile(author, "OnboardingSmall.lean", await genericInheritanceSource("OnboardingSmall"));
	await saveLakeFile(author, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], exports: genericInheritanceExports.map(name => `OnboardingSmall.${name}`) }));
	const intent = await prepareLakeEntryIntent({ projectRoot: author });
	const workspace = await resolveLakeBuildWorkspace({ snapshot: intent.lakeSnapshot, modules: intent.document.modules.map(entry => entry.module), leanPrefix });
	try
	{
		const inventory = await inspectLeanProject(author);
		const result = await elaborateLakeEntryModules({ inventory, entries: intent.document.modules, workspace, leanPrefix, engineRoot: process.cwd() });
		assertGenericInheritanceIr(result.bindingIr.document, "OnboardingSmall");
	}
	finally
	{ await workspace.dispose(); }
});

const profiles = process.env.LEAN_BRIDGE_GENERIC_INHERITANCE_PROFILES?.split(",").sort() ?? [];
assert.ok(profiles.every(profile => ["c", "cpp"].includes(profile)), "Inherited generic record acceptance covers C and C++ first");
assert.equal(new Set(profiles).size, profiles.length, "Duplicate inherited generic record profile");
const coordinate = { name: "genericinheritance", version: "1.0.0" };
const targets = { c: ["c", coordinate], cpp: ["cpp", coordinate] };

test("relocated source-free C and C++ packages keep each inherited generic parent as its alias-typed field", { skip: !profiles.length, timeout: 2_400_000 }, async t => {
	const reports = [], archives = [], identities = [];
	const selected = Object.fromEntries(profiles.map(profile => targets[profile]));
	const environment = nativeFixtureEnvironment(profiles);
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-generic-inheritance-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-generic-inheritance-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp(genericInheritanceFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: [module], exports, targets: selected }));
		t.diagnostic(`build ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(selected), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assertGenericInheritanceIr(model.bindingIr, module);
		identities.push({ bindingIrSha256: built.bindingIrSha256, modelBindingIrSha256: hashBindingIr(model.bindingIr), modelSha256: sha256(canonicalJson(model)) });
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		// Install from prepared archives only. No author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		await assert.rejects(lstat(directory), { code: "ENOENT" });
		if(attempt === 1) break;
		for(const profile of profiles)
		{
			t.diagnostic(`installing and checking ${profile}`);
			const packages = receipt.packages.filter(pkg => pkg.target === targets[profile][0]);
			const source = (name, extension) => readFile(`tests/fixtures/generic-inheritance-consumers/${name}.${extension}`, "utf8");
			const observation = await installCopiedConsumer({ profile, consumer, handoff, packages, environment, fixture: { source, wit: [], success: "generic-inheritance-ok" } });
			delete observation.command;
			const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
			reports.push({ profile, path: "ordinary-source", ...observation, packages, ...identities[0], receiptSha256, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	// Two independent author roots give byte-identical archives and the same model.
	assert.deepEqual(archives[1], archives[0]);
	assert.deepEqual(identities[1], identities[0]);
	const reportPath = resolve(process.env.LEAN_BRIDGE_GENERIC_INHERITANCE_REPORT ?? `build/generic-inheritance/${profiles.join("-")}.json`);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, records: expectedGenericInheritanceRecords(module), reports, archives: archives[0], reproducible: true, independentBuilds: 2 }));
});

const npm = process.env.LEAN_BRIDGE_GENERIC_INHERITANCE_NPM_TEST === "1";
const engineRoot = process.cwd();
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");

test("a relocated source-free npm package keeps each inherited generic parent for Node and strict TypeScript", { skip: !npm, timeout: 3_600_000 }, async t => {
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
	// Only the Nix command transport is substituted: the locked engine when configured, else the pinned local engine.
	const build = (projectRoot, outputRoot) => buildCanonicalProject({ projectRoot, outputRoot, engineRoot, environment, targets: ["npm"], runner: refinementEngineTransport() });
	const observation = await checkGenericInheritanceNpmPackages(t, { build, runtimeRoot, engineRoot });
	const reportPath = resolve(process.env.LEAN_BRIDGE_GENERIC_INHERITANCE_NPM_REPORT ?? "build/generic-inheritance/npm.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, profile: "npm", path: "ordinary-source", records: expectedGenericInheritanceRecords("OnboardingSmall"), ...observation }));
});
