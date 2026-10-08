/**
 * Inherited generic records in installed C, C++ and npm packages: each parent stays one field typed
 * by its source alias, with the child's and the parent's instantiation provenance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";

export const genericInheritanceFixture = "tests/fixtures/onboarding/generic-inheritance";
export const genericInheritanceExports = Object.freeze(["grow", "lift", "relabel"]);
const nat = { kind: "primitive", name: "nat" }, string = { kind: "primitive", name: "string" };
/**
 * Every record the Binding IR carries, in Lean's field order. A parent is one field named by Lean's
 * subobject projection and typed by the source alias; an instantiation names the generic structure.
 * Marker reaches the package only as a phantom argument, so it has no instantiation of its own.
 */
const records = {
	NatBase: { fields: [["base", nat]], structure: "Base", arguments: [nat] }
	, NatChild: { fields: [["toBase", "NatBase"], ["child", nat]], structure: "Child", arguments: [nat] }
	// UBase and UChild are universe-polymorphic, instantiated at Type.
	, UNatBase: { fields: [["value", nat]], structure: "UBase", arguments: [nat] }
	, UNatChild: { fields: [["toUBase", "UNatBase"], ["extra", nat]], structure: "UChild", arguments: [nat] }
	, MarkerTag: { fields: [["label", string]], structure: "Tag", arguments: ["Marker"] }
	, MarkerTagged: { fields: [["toTag", "MarkerTag"], ["count", nat]], structure: "Tagged", arguments: ["Marker"] }
	, Marker: { fields: [["id", nat]] } };
/** Each export's signature: one record argument and its result, by alias or primitive. */
const signatures = { grow: [["NatChild"], "NatChild"], lift: [["UNatChild"], nat], relabel: [["MarkerTagged"], "MarkerTagged"] };

/**
 * A Binding IR type reference: a named alias in the module, or a primitive as given.
 *
 * @param module - Lean module and namespace name.
 */
const reference = module => value => typeof value === "string" ? { kind: "named", id: `lean:${module}.${value}` } : value;

/**
 * The expected record definitions, as the Binding IR spells them for a module.
 *
 * @param module - Lean module and namespace name.
 */
export const expectedGenericInheritanceRecords = module => {
	const type = reference(module);
	return Object.entries(records).map(([name, record]) => ({ id: `lean:${module}.${name}`
		, kind: "record"
		, fields: record.fields.map(([field, value]) => ({ name: field, type: type(value) }))
		, instantiation: record.structure ? { structure: `${module}.${record.structure}`, arguments: record.arguments.map(type) } : null }))
		.sort((left, right) => left.id < right.id ? -1 : 1);
};

/**
 * The expected export signatures, as the Binding IR spells them for a module.
 *
 * @param module - Lean module and namespace name.
 */
export const expectedGenericInheritanceSignatures = module => {
	const type = reference(module);
	return Object.entries(signatures).map(([name, [parameters, result]]) => ({ id: `lean:${module}.${name}`
		, kind: "function"
		, parameters: parameters.map(type)
		, result: type(result) }))
		.sort((left, right) => left.id < right.id ? -1 : 1);
};

/**
 * Assert the Binding IR carries exactly the expected types, each parent as its own alias-typed field
 * in Lean's order with the child's and the parent's instantiation provenance, and exactly the three
 * export signatures.
 *
 * @param ir - Binding IR document.
 * @param module - Lean module name used by the fixture.
 */
export const assertGenericInheritanceIr = (ir, module) => {
	const byId = (left, right) => left.id < right.id ? -1 : 1;
	const types = ir.types.map(type => ({ id: type.id
		, kind: type.kind
		, fields: type.fields?.map(field => ({ name: field.name, type: field.type })) ?? null
		, instantiation: type.source?.extensions?.["lean-lang.org/instantiation"] ?? null })).sort(byId);
	assert.deepEqual(types, expectedGenericInheritanceRecords(module));
	const declarations = ir.declarations.map(item => ({ id: item.id
		, kind: item.kind
		, parameters: item.parameters.map(parameter => parameter.type)
		, result: item.result?.type ?? null })).sort(byId);
	assert.deepEqual(declarations, expectedGenericInheritanceSignatures(module));
};

/**
 * Read the fixture source under another module name, for the npm author project.
 *
 * @param module - Lean module and namespace name.
 */
export const genericInheritanceSource = async (module = "GenericInheritance") => (await readFile(join(genericInheritanceFixture, "GenericInheritance.lean"), "utf8")).replaceAll("GenericInheritance", module);

/** Node consumer: each export through its parent fields, big numbers, Unicode, shape rejections and recovery. */
export const genericInheritanceNodeConsumer = () => `import * as api from "onboarding-small";
let checks = 0, rejections = 0;
const check = (ok, label) => { if(!ok) throw new Error("failed: " + label); checks++; };
const rejected = (call, label) => { try { call(); } catch { rejections++; return; } throw new Error("accepted: " + label); };
const grown = api.grow({ toBase: { base: 4n }, child: 7n });
check(grown.toBase.base === 5n && grown.child === 14n && Object.keys(grown).join() === "toBase,child", "grow keeps the parent field");
const wide = api.grow({ toBase: { base: 2n ** 70n }, child: 2n ** 65n + 1n });
check(wide.toBase.base === 2n ** 70n + 1n && wide.child === 2n ** 66n + 2n, "grow keeps Nat precision");
check(api.lift({ toUBase: { value: 30n }, extra: 12n }) === 42n && api.lift({ toUBase: { value: 2n ** 80n }, extra: 12n }) === 2n ** 80n + 12n, "lift");
const relabeled = api.relabel({ toTag: { label: "héllo 🙂" }, count: 3n });
check(relabeled.toTag.label === "héllo 🙂!" && relabeled.count === 3n && Object.keys(relabeled.toTag).join() === "label", "relabel carries only the label");
check(api.relabel({ toTag: { label: "" }, count: 0n }).toTag.label === "!", "relabel empty");
// A flattened parent, a missing or extra field, or a wrong parent shape is rejected at the boundary.
rejected(() => api.grow({ base: 4n, child: 7n }), "flattened parent");
rejected(() => api.grow({ toBase: { base: 4n } }), "missing child field");
rejected(() => api.grow({ toBase: { base: 4n, extra: 1n }, child: 7n }), "extra parent field");
rejected(() => api.grow({ toBase: 4n, child: 7n }), "parent is not a record");
rejected(() => api.lift({ toBase: { base: 4n }, extra: 1n }), "another child's parent field");
rejected(() => api.relabel({ toTag: { label: "x", id: 1n }, count: 0n }), "phantom argument is not a field");
for(let i = 0; i < 1000; i++) {
  rejected(() => api.grow({ toBase: { base: i }, child: 0n }), "round");
  check(api.grow({ toBase: { base: BigInt(i) }, child: BigInt(i) }).toBase.base === BigInt(i + 1), "recovers");
}
console.log(JSON.stringify({ checks, rejections }));
`;

const typescript = `import * as api from "onboarding-small";
const base: api.NatBase = { base: 1n };
const grown: api.NatChild = api.grow({ toBase: base, child: 2n });
const parent: api.NatBase = grown.toBase;
const lifted: bigint = api.lift({ toUBase: { value: 1n }, extra: 2n });
const ubase: api.UNatBase = { value: 0n };
const tag: api.MarkerTag = api.relabel({ toTag: { label: "m" }, count: 0n }).toTag;
const tagged: api.MarkerTagged = { toTag: tag, count: 1n };
// @ts-expect-error The parent is a field, never flattened into the child.
api.grow({ base: 1n, child: 2n });
// @ts-expect-error Each child names its own parent field.
api.lift({ toBase: { base: 1n }, extra: 2n });
// @ts-expect-error Marker is a phantom argument: the parent carries only its label.
const phantom: api.MarkerTag = { label: "m", id: 1n };
void parent; void lifted; void ubase; void tagged; void phantom;
`;

/**
 * Build the npm package from two clean roots, delete both, install offline under a Node-only PATH and
 * run the Node and strict TypeScript consumers.
 *
 * @param t - Test context.
 * @param options - Build helpers.
 * @param options.build - Builds the canonical project for npm.
 * @param options.runtimeRoot - Prepared shared runtime root.
 * @param options.engineRoot - Checkout containing the TypeScript compiler.
 */
export const checkGenericInheritanceNpmPackages = async (t, { build, runtimeRoot, engineRoot }) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-generic-inheritance-npm-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project"), moved = join(directory, "moved"), releases = [], facts = [];
	await cp("tests/fixtures/documentation/lean-author", root, { recursive: true });
	await saveLakeFile(root, "OnboardingSmall.lean", await genericInheritanceSource("OnboardingSmall"));
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], exports: genericInheritanceExports.map(name => `OnboardingSmall.${name}`) }));
	await cp(root, moved, { recursive: true });
	for(const [index, projectRoot] of [root, moved].entries())
	{
		const before = await lakeInputState(projectRoot), outputRoot = join(directory, `build-${index}`);
		await build(projectRoot, outputRoot).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
		const irBytes = await readFile(join(outputRoot, "bundle/binding/binding-ir.json")), ir = JSON.parse(irBytes);
		assertGenericInheritanceIr(ir, "OnboardingSmall");
		facts.push({ bindingIrSha256: hashBindingIr(ir), bindingIrFileSha256: sha256(irBytes) });
		releases.push(await buildComponentNpmPackages({ bundleRoot: join(outputRoot, "bundle"), runtimeRoot, outputRoot: join(directory, `npm-${index}`) }));
		await verifyComponentPackageReceipt({ receiptPath: join(releases[index].output, "component-package-receipt.json") });
		assert.equal(releases[index].report.bindingIrSha256, facts[index].bindingIrSha256);
		assert.deepEqual(await lakeInputState(projectRoot), before);
	}
	assert.deepEqual(releases[0].report, releases[1].report);
	assert.deepEqual(facts[0], facts[1]);
	const archiveSha256 = sha256(await readFile(releases[0].componentArchive));
	assert.equal(archiveSha256, sha256(await readFile(releases[1].componentArchive)));
	const runtimeArchiveSha256 = sha256(await readFile(releases[0].runtimeArchive));
	assert.equal(runtimeArchiveSha256, sha256(await readFile(releases[1].runtimeArchive)));
	const receipt = releases[0].report;
	const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-generic-inheritance-consumer-"));
	t.after(() => rm(consumer, { recursive: true, force: true }));
	const handoff = join(consumer, "handoff"), bin = join(consumer, "bin");
	await mkdir(handoff);
	for(const name of [receipt.package.archive, receipt.runtime.archive, "component-package-receipt.json", "verify-component-package-receipt.mjs"])
		await cp(join(releases[0].output, name), join(handoff, name));
	// This test owns the temporary directory: delete both author roots and all build staging.
	await rm(directory, { recursive: true, force: true });
	await assert.rejects(lstat(directory), { code: "ENOENT" });
	await verifyComponentPackageReceipt({ receiptPath: join(handoff, "component-package-receipt.json") });
	await mkdir(bin);
	await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(consumer, "package.json", '{"private":true,"type":"module"}');
	for(const name of ["user.npmrc", "global.npmrc"]) await saveLakeFile(consumer, name, "");
	const npmCli = await realpath(join(process.execPath, "../../bin/npm"));
	const env = { PATH: bin, CC: "/unavailable/compiler", CXX: "/unavailable/compiler", LEAN_BRIDGE_LEAN: "/unavailable/lean", LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime", NODE_PATH: "" };
	const execute = args => processBuildRunner.capture({ command: process.execPath, args, cwd: consumer, env, timeoutMs: 300_000 })
		.catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
	await execute([npmCli, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--userconfig", join(consumer, "user.npmrc"), "--globalconfig", join(consumer, "global.npmrc"), "--cache", join(consumer, "empty-cache"), join(handoff, receipt.runtime.archive), join(handoff, receipt.package.archive)]);
	const script = genericInheritanceNodeConsumer();
	await saveLakeFile(consumer, "index.mjs", script);
	const run = await execute(["index.mjs"]);
	assert.equal(run.stderr, "");
	const result = JSON.parse(run.stdout.trim());
	assert.deepEqual(result, { checks: 1005, rejections: 1006 });
	// Strict TypeScript sees one interface per alias, the parent as a field of its alias type.
	const declarations = await readFile(join(consumer, "node_modules/onboarding-small/index.d.ts"), "utf8");
	for(const [name, fields] of [["NatChild", ["toBase: NatBase", "child: bigint"]], ["UNatChild", ["toUBase: UNatBase", "extra: bigint"]], ["MarkerTagged", ["toTag: MarkerTag", "count: bigint"]], ["MarkerTag", ["label: string"]]])
		assert.match(declarations, new RegExp(`export interface ${name} \\{\\s*${fields.map(field => `readonly ${field};`).join("\\s*")}\\s*\\}`), name);
	await saveLakeFile(consumer, "index.mts", typescript);
	await execute([join(engineRoot, "node_modules/typescript/lib/tsc.js"), "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext", "--moduleResolution", "NodeNext", "index.mts"]);
	return { archiveSha256, runtimeArchiveSha256
		, ...facts[0], ...result, receipt
		, receiptSha256: sha256(await readFile(join(handoff, "component-package-receipt.json")))
		, consumerSha256: sha256(script)
		, typescript: { strict: true, skipLibCheck: false, sourceSha256: sha256(typescript), declarationsSha256: sha256(declarations) }
		, reproducible: true, independentBuilds: 2
		, sourceRemovedBeforeInstallation: true
		, offlineInstall: true, compilerFreePath: true, dispatch: "not measured" };
};
