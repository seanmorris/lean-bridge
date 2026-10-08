/**
 * Inherited Lean structures keep Lean's own layout: each subobject parent is one field.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../src/build/native-graph-model.mjs";

const lean = process.env.LEAN_BRIDGE_INHERITED_RECORD_LEAN_TEST === "1";
const fixture = "tests/fixtures/onboarding/inherited-records";
const exports = ["move", "total", "restamp", "mergedTotal", "bump"].map(name => `InheritedRecords.${name}`);
const leanPrefix = join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");

/**
 * Elaborate a copy of the fixture, build its native model and compile the generated Lean adapters,
 * stopping before any C or package step.
 *
 * @param t - Test context.
 * @param options - Optional source suffix and export list.
 * @param options.extra - Declarations appended inside the namespace.
 * @param options.names - Exported declarations.
 */
const nativeModel = async (t, { extra = "", names = exports } = {}) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-inherited-records-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project");
	await cp(fixture, projectRoot, { recursive: true });
	const source = await readFile(join(fixture, "InheritedRecords.lean"), "utf8");
	await writeFile(join(projectRoot, "InheritedRecords.lean"), source.replace("end InheritedRecords", `${extra}\nend InheritedRecords`));
	await writeFile(join(projectRoot, "lean-bridge.exports.json"), canonicalJson({ schemaVersion: 1, modules: ["InheritedRecords"], exports: names, targets: { c: { name: "inheritedrecords", version: "1.0.0" } } }));
	let captured;
	const compileComponent = async ({ model, adapters }) => {
		captured = { model, adapters };
		throw Object.assign(new Error("stop before C"), { code: "stop-before-c" });
	};
	const options = {
		projectRoot, outputRoot: join(directory, "out"), leanPrefix, targets: ["c"]
		, profile: "native-library-v1", receiptName: "native-component.json"
		, createModel: input => createCompiledNativeModel(input, { nativeRefinements: true })
		, createAdapters: generateCompiledNativeLeanAdapters, compileComponent
	};
	const stopped = error => {
		if(error.code !== "stop-before-c") throw error;
		return true;
	};
	await assert.rejects(() => buildElaboratedComponent(options), stopped);
	return captured;
};
const layout = records => Object.fromEntries(records.map(type => [type.name.split(".").at(-1), type.fields.map(field => [field.name, field.type.kind === "reference" || field.type.kind === "record" ? field.type.name : field.type.name ?? field.type.kind])]));

test("inherited records carry each subobject parent as its own field and compile their Lean adapters", { skip: !lean, timeout: 900_000 }, async t => {
	const { model } = await nativeModel(t);
	const records = model.types.filter(type => type.kind === "record");
	assert.deepEqual(layout(records), {
		Digit: [["digit", "nat"]]
		, Point: [["x", "nat"], ["y", "nat"]]
		, Labeled: [["toPoint", "InheritedRecords.Point"], ["label", "string"]]
		, Tagged: [["toDigit", "InheritedRecords.Digit"], ["toPoint", "InheritedRecords.Point"], ["tag", "string"]]
		, Stamped: [["toLabeled", "InheritedRecords.Labeled"], ["stamp", "nat"]]
		// Lean keeps Labeled as a subobject and flattens what Tagged adds beyond the shared Point.
		, Merged: [["toLabeled", "InheritedRecords.Labeled"], ["toDigit", "InheritedRecords.Digit"], ["tag", "string"], ["extra", "nat"]] });
	// Each parent projection is the field's own projection; the constructor takes exactly these fields.
	for(const type of records) for(const field of type.fields) assert.equal(field.projection, `${type.name}.${field.name}`, field.projection);
	// A Fin field inside a parent keeps its bound: every export that takes or returns a child checks it through the parent field.
	const digit = { kind: "record", definition: "InheritedRecords.Digit", fields: ["digit"], arguments: [{ kind: "fin", bound: "10" }] };
	const refinements = Object.fromEntries(model.exports.map(item => [item.name.split(".").at(-1), item.refinements ?? null]));
	const tagged = { kind: "record", definition: "InheritedRecords.Tagged", fields: ["toDigit", "toPoint", "tag"], arguments: [digit, null, null] };
	assert.deepEqual(refinements.total, { parameters: [tagged], result: null });
	assert.deepEqual(refinements.bump, { parameters: [tagged], result: tagged });
	assert.deepEqual(refinements.mergedTotal, { parameters: [{ kind: "record", definition: "InheritedRecords.Merged", fields: ["toLabeled", "toDigit", "tag", "extra"], arguments: [null, digit, null, null] }], result: null });
	assert.deepEqual([refinements.move, refinements.restamp], [null, null]);
	const ir = model.bindingIr;
	assert.deepEqual(ir.types.find(type => type.id === "lean:InheritedRecords.Digit").source.extensions["lean-lang.org/nominal-refinements"], { kind: "record", fields: [{ kind: "fin", bound: "10" }] });
	assert.deepEqual(ir.declarations.map(item => item.id).sort(), exports.map(name => `lean:${name}`).sort());
});

test("inherited fields that depend on the record value, and a generic parent without a source alias, are refused at their source", { skip: !lean, timeout: 900_000 }, async t => {
	const refused = (pattern, label) => error => {
		assert.match(JSON.stringify(error.details ?? error.message), pattern, label);
		return true;
	};
	const cases = [
		["a proof field over an inherited value", "structure Small extends Point where\n  small : x < 10\ndef keep (value : Small) : Nat := value.x", "keep", /inherited record fields cannot depend on the record value/u]
		, ["a generic parent with no source alias", "structure Base (α : Type) where\n  base : α\nstructure Child (α : Type) extends Base α where\n  child : Nat\nabbrev NatChild := Child Nat\ndef grow (value : NatChild) : Nat := value.child", "grow", /name this inherited generic parent with an abbrev in the compiled source/u]];
	for(const [label, extra, name, pattern] of cases)
		await assert.rejects(() => nativeModel(t, { extra, names: [`InheritedRecords.${name}`] }), refused(pattern, label), label);
});

const profiles = process.env.LEAN_BRIDGE_INHERITED_RECORD_PROFILES?.split(",").sort() ?? [];
assert.ok(profiles.every(profile => ["c", "cpp"].includes(profile)), "Inherited record acceptance covers C and C++ first");
const coordinate = { name: "inheritedrecords", version: "1.0.0" };
const targets = { c: ["c", coordinate], cpp: ["cpp", coordinate] };

test("relocated source-free C and C++ packages construct inherited records and check a parent's Fin field", { skip: !profiles.length, timeout: 2_400_000 }, async t => {
	const reports = [], archives = [];
	const selected = Object.fromEntries(profiles.map(profile => targets[profile]));
	const environment = nativeFixtureEnvironment(profiles);
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-inherited-records-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-inherited-records-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp(fixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["InheritedRecords"], exports, targets: selected }));
		t.diagnostic(`build ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(selected), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		const tagged = model.types.find(type => type.name === "InheritedRecords.Tagged");
		assert.deepEqual(tagged.fields.map(field => field.name), ["toDigit", "toPoint", "tag"]);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		// Install from prepared archives only. No author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		if(attempt === 1) break;
		for(const profile of profiles)
		{
			t.diagnostic(`installing and checking ${profile}`);
			const packages = receipt.packages.filter(pkg => pkg.target === targets[profile][0]);
			const source = (name, extension) => readFile(`tests/fixtures/inherited-record-consumers/${name}.${extension}`, "utf8");
			const observation = await installCopiedConsumer({ profile, consumer, handoff, packages, environment, fixture: { source, wit: [], success: "inherited-record-ok" } });
			delete observation.command;
			const identities = { bindingIrSha256: built.bindingIrSha256, modelSha256: sha256(canonicalJson(model)), receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json"))) };
			reports.push({ profile, path: "ordinary-source", ...observation, packages, ...identities, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	const reportPath = resolve(process.env.LEAN_BRIDGE_INHERITED_RECORD_REPORT ?? `build/inherited-records/${profiles.join("-")}.json`);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});
