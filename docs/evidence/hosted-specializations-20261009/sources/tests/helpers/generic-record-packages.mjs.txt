/**
 * Closed, alias-named generic records in installed npm and native packages.
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
import { installCopiedConsumer } from "./copied-fixture-install.mjs";
import { checkGenericRecordRustTypes } from "./generic-record-rust.mjs";
import { checkGenericRecordManagedTypes } from "./generic-record-managed-types.mjs";
export { nativeFixtureEnvironment as genericRecordEnvironment } from "./copied-fixture-install.mjs";

const fixture = "tests/fixtures/onboarding/generic-records";
// The WIT host header and the C prefix both derive from this hyphen-free name.
const coordinate = { name: "genericrecords", version: "1.0.0" };
export const genericRecordTargets = Object.freeze({ c: ["c", coordinate]
	, cpp: ["cpp", coordinate]
	, python: ["pypi", coordinate]
	, rust: ["cargo", coordinate]
	, dotnet: ["nuget", { name: "GenericRecords.Api", version: "1.0.0" }]
	, java: ["maven", { name: "org.leanbridge:genericrecords", version: "1.0.0" }]
	, kotlin: ["maven", { name: "org.leanbridge:genericrecords", version: "1.0.0" }]
	, ruby: ["rubygems", coordinate]
	, perl: ["cpan", { module: "LeanBridge::GenericRecords", version: "1.000" }]
	, "php-native": ["php-native", { name: "example/genericrecords", version: "1.0.0" }]
	, "wit-wasi": ["wit-wasi", coordinate] });
export const genericRecordExports = Object.freeze(["swapNamed", "bump", "shout", "again", "orZero", "total", "firstBoxes", "unpair", "retag", "relabel"].map(name => `GenericRecords.${name}`));
const named = id => ({ kind: "named", id });
const primitive = name => ({ kind: "primitive", name });
/** The instantiation every alias-named record must record in its Binding IR definition. */
export const genericRecordInstantiations = Object.freeze({
	WordPair: { structure: "Pair", arguments: [primitive("string"), primitive("nat")] }
	, NatBox: { structure: "Box", arguments: [primitive("nat")] }
	, TextBox: { structure: "Box", arguments: [primitive("string")] }
	, NatBoxAgain: { structure: "Box", arguments: [primitive("nat")] }
	, MaybeBox: { structure: "Box", arguments: [{ kind: "apply", constructor: "option", arguments: [primitive("nat")] }] }
	, BoxPair: { structure: "Pair", arguments: [named("NatBox"), named("TextBox")] }
	// Universe-polymorphic structure instantiated at Type.
	, TaggedNat: { structure: "Tagged", arguments: [primitive("string"), primitive("nat")] }
	// A phantom argument: the nominal Marker reaches the package only through this provenance.
	, MarkerTag: { structure: "Tag", arguments: [named("Marker")], fields: 1 } });
/** Nominal records the fixture carries only as provenance, never in a signature or field. */
export const genericRecordProvenanceOnly = Object.freeze(["Marker"]);

/**
 * Read the fixture source under another module name, for the npm author project.
 *
 * @param module - Lean module and namespace name.
 */
export const genericRecordSource = async (module = "GenericRecords") => (await readFile(join(fixture, "GenericRecords.lean"), "utf8")).replaceAll("GenericRecords", module);

/**
 * Assert the Binding IR carries each alias-named record with its instantiation provenance.
 *
 * @param ir - Binding IR document.
 * @param module - Lean module name used by the fixture.
 */
export const assertGenericRecordIr = (ir, module) => {
	const records = ir.types.filter(type => type.kind === "record");
	assert.deepEqual(records.map(type => type.id).sort(), [...Object.keys(genericRecordInstantiations), ...genericRecordProvenanceOnly].map(name => `lean:${module}.${name}`).sort());
	// A definition reached only through a provenance reference is still carried, without an instantiation of its own.
	for(const name of genericRecordProvenanceOnly) assert.equal(records.find(type => type.id === `lean:${module}.${name}`).source.extensions?.["lean-lang.org/instantiation"], undefined, name);
	for(const [name, expected] of Object.entries(genericRecordInstantiations))
	{
		const record = records.find(type => type.id === `lean:${module}.${name}`);
		const instantiation = record.source.extensions["lean-lang.org/instantiation"];
		const qualify = argument => argument.kind === "named" ? named(`lean:${module}.${argument.id}`) : argument.kind === "apply" ? { ...argument, arguments: argument.arguments.map(qualify) } : argument;
		assert.deepEqual(instantiation, { structure: `${module}.${expected.structure}`, arguments: expected.arguments.map(qualify) }, name);
		assert.equal(record.fields.length, expected.fields ?? 2, name);
	}
	// Two aliases of one application are two definitions with identical fields and the same origin.
	const [natBox, again] = ["NatBox", "NatBoxAgain"].map(name => records.find(type => type.id === `lean:${module}.${name}`));
	assert.deepEqual(natBox.fields, again.fields);
	assert.deepEqual(natBox.source.extensions["lean-lang.org/instantiation"], again.source.extensions["lean-lang.org/instantiation"]);
};

/** Node consumer: every export through its alias-named records, plus shape rejections and recovery. */
export const genericRecordNodeConsumer = () => `import assert from "node:assert/strict";
import * as api from "onboarding-small";
let checks = 0, rejections = 0;
const check = (ok, label) => { if(!ok) throw new Error("failed: " + label); checks++; };
const rejected = (call, label) => { try { call(); } catch { rejections++; return; } throw new Error("accepted: " + label); };
check(JSON.stringify(api.bump({ value: 4n, count: 1n }), (_, v) => typeof v === "bigint" ? v + "n" : v) === '{"value":"5n","count":"2n"}', "bump");
check(api.again({ value: 4n, count: 1n }).value === 8n, "again");
check(api.shout({ value: "héllo 🙂", count: 3n }).value === "héllo 🙂!", "shout");
const swapped = api.swapNamed({ first: "a", second: 1n });
check(swapped.first === "a!" && swapped.second === 2n, "swapNamed");
check(api.orZero({ value: { tag: "some", value: 5n }, count: 2n }) === 7n && api.orZero({ value: { tag: "none" }, count: 2n }) === 2n, "orZero");
check(api.total([{ value: 1n, count: 0n }, { value: 2n ** 70n, count: 0n }]) === 2n ** 70n + 1n && api.total([]) === 0n, "total");
const first = api.firstBoxes(2n);
check(first.tag === "some" && first.value.length === 2 && first.value[1].value === 1n && first.value[1].count === 2n && api.firstBoxes(0n).tag === "none", "firstBoxes");
check(api.unpair({ first: { value: 3n, count: 0n }, second: { value: "abcd", count: 0n } }) === 7n, "unpair");
const retagged = api.retag({ tag: "t", payload: 1n });
check(retagged.tag === "t#" && retagged.payload === 2n, "retag");
check(api.relabel({ label: "m" }).label === "m?", "relabel");
rejected(() => api.bump({ value: "x", count: 1n }), "wrong field type");
rejected(() => api.bump({ value: 4n }), "missing field");
rejected(() => api.bump({ value: 4n, count: 1n, extra: 1n }), "extra field");
rejected(() => api.unpair({ first: { value: 3n, count: 0n }, second: { value: 4n, count: 0n } }), "wrong nested record");
rejected(() => api.total([{ value: 1n }]), "list element missing field");
for(let i = 0; i < 1000; i++) {
  rejected(() => api.bump({ value: i, count: 1n }), "round");
  check(api.bump({ value: BigInt(i), count: 0n }).value === BigInt(i + 1), "recovers");
}
console.log(JSON.stringify({ checks, rejections }));
`;

/**
 * Build the npm package from two clean roots, install it offline and run the Node and strict TypeScript consumers.
 *
 * @param t - Test context.
 * @param options - Unlocked build helpers.
 * @param options.fixture - Creates a project copy.
 * @param options.build - Builds the canonical project for npm.
 * @param options.runtimeRoot - Prepared shared runtime root.
 * @param options.engineRoot - Checkout containing the TypeScript compiler.
 * @param options.specialized - Optional additional source, configured exports and public caller checks.
 * @param options.review - Optional reviewed Binding IR that supplies every export decision instead.
 */
export const checkGenericRecordNpmPackages = async (t, { fixture: project, build, runtimeRoot, engineRoot, specialized, review }) => {
	const { directory, root } = await project(t);
	await saveLakeFile(root, "OnboardingSmall.lean", specialized ? await specialized.source("OnboardingSmall") : await genericRecordSource("OnboardingSmall"));
	const exports = review ? {} : { exports: genericRecordExports.map(name => name.replace("GenericRecords.", "OnboardingSmall.")), ...specialized?.configuration("OnboardingSmall") };
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], ...exports }));
	if(review) await saveLakeFile(root, "api.binding-ir.json", canonicalJson(review));
	const moved = join(directory, "moved"), releases = [], facts = [];
	await cp(root, moved, { recursive: true });
	for(const [index, projectRoot] of [root, moved].entries())
	{
		const before = await lakeInputState(projectRoot), outputRoot = join(directory, `build-${index}`);
		await build(projectRoot, outputRoot).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
		const plan = JSON.parse(await readFile(join(outputRoot, "bundle/locks/compiler-adapters.json"), "utf8"));
		assert.equal(plan.privateAbi.version, 7, "alias-named records with an Option field select the nominal ABI");
		const irBytes = await readFile(join(outputRoot, "bundle/binding/binding-ir.json")), ir = JSON.parse(irBytes);
		(specialized?.assertIr ?? assertGenericRecordIr)(ir, "OnboardingSmall");
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
	const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-generic-record-consumer-"));
	t.after(() => rm(consumer, { recursive: true, force: true }));
	const handoff = join(consumer, "handoff"), bin = join(consumer, "bin");
	await mkdir(handoff);
	for(const name of [receipt.package.archive, receipt.runtime.archive, "component-package-receipt.json", "verify-component-package-receipt.mjs"])
		await cp(join(releases[0].output, name), join(handoff, name));
	// The fixture owns this temporary directory. Delete both author roots and all build staging.
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
	const script = specialized ? await specialized.nodeConsumer() : genericRecordNodeConsumer();
	await saveLakeFile(consumer, "index.mjs", script);
	const run = await execute(["index.mjs"]);
	assert.equal(run.stderr, "");
	const result = JSON.parse(run.stdout.trim());
	assert.deepEqual(result, specialized?.expectedNodeResult ?? { checks: 1010, rejections: 1005 });
	// Strict TypeScript sees one interface per alias; a structurally equal alias is a separate declaration.
	const declarations = await readFile(join(consumer, "node_modules/onboarding-small/index.d.ts"), "utf8");
	for(const name of Object.keys(genericRecordInstantiations).filter(name => name !== "Boxes")) assert.match(declarations, new RegExp(`export interface ${name} \\{`), name);
	assert.match(declarations, /export type Boxes = ReadonlyArray<NatBox>;/);
	const typescript = `import * as api from "onboarding-small";
const box: api.NatBox = api.bump({ value: 1n, count: 2n });
const again: api.NatBoxAgain = api.again({ value: 1n, count: 2n });
const boxes: api.Boxes = [box, { value: 0n, count: 0n }];
const pair: api.WordPair = api.swapNamed({ first: "a", second: 1n });
const tagged: api.TaggedNat = api.retag({ tag: "t", payload: 1n });
const marker: api.MarkerTag = api.relabel({ label: "m" });
const sum: bigint = api.total(boxes) + api.unpair({ first: box, second: { value: "x", count: 0n } }) + api.orZero({ value: { tag: "none" }, count: 1n });
// @ts-expect-error Nat fields keep bigint.
api.bump({ value: 1, count: 2n });
// @ts-expect-error Every field is required.
api.shout({ value: "x" });
void again; void pair; void sum; void tagged; void marker;${specialized?.typescript ?? ""}
`;
	await saveLakeFile(consumer, "index.mts", typescript);
	await execute([join(engineRoot, "node_modules/typescript/lib/tsc.js"), "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext", "--moduleResolution", "NodeNext", "index.mts"]);
	return { archiveSha256, runtimeArchiveSha256, abi: 7
		, ...facts[0], ...result, receipt
		, receiptSha256: sha256(await readFile(join(handoff, "component-package-receipt.json")))
		, consumerSha256: sha256(script)
		, typescript: { strict: true, skipLibCheck: false, sourceSha256: sha256(typescript), declarationsSha256: sha256(declarations) }
		, reproducible: true, independentBuilds: 2
		, sourceRemovedBeforeInstallation: true
		, offlineInstall: true, compilerFreePath: true, dispatch: "not measured" };
};

/**
 * Install and exercise the native package through its generated public API.
 *
 * @param options - Verified archive handoff and selected consumer profile.
 */
export const installGenericRecordConsumer = async options => {
	const observation = await installCopiedConsumer({ ...options, fixture: {
		source: options.source ?? ((profile, extension) => readFile(`tests/fixtures/generic-record-consumers/${profile}.${extension}`, "utf8"))
		// Each alias is its own WIT record with the structure's fields instantiated; two aliases of one application stay distinct.
		, wit: [...["nat-box", "nat-box-again", "text-box", "word-pair", "maybe-box", "box-pair", "tagged-nat", "marker-tag"].map(name => new RegExp(`record ${name} \\{`))
			, /bump: func\([^)]*: nat-box\) -> nat-box/
			, /unpair: func\([^)]*: box-pair\) -> /
			, /type (bridge-value-\d+) = list<nat-box>;[\s\S]*?type boxes = \1;[\s\S]*?type (bridge-alias-value-\d+) = option<boxes>;[\s\S]*?first-boxes: func\([^)]*\) -> \2;/u
			, ...options.wit ?? []]
		, success: "generic-records-ok"
	} });
	if(options.profile === "rust") return { ...observation, rustTypes: await checkGenericRecordRustTypes(options, observation) };
	if(["dotnet", "java", "kotlin"].includes(options.profile))
		return { ...observation, managedTypes: await checkGenericRecordManagedTypes(options, observation) };
	return observation;
};
