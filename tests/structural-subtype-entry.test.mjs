/**
 * Source-only controls for separately identified structural Subtype entry observation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { generateGmpProjection } from "../src/backends/c/gmp-projection.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { structuralSubtypeEntrySource, structuralSubtypeEntryReview, structuralSubtypeEntrySelection, structuralSubtypeEntryInterposer } from "./helpers/structural-subtype-entry.mjs";
import { structuralSubtypeEntryCorpus, structuralSubtypeEntryCall } from "./helpers/structural-subtype-entry-cases.mjs";
import { structuralSubtypeRawProbe, structuralSubtypeRawCases, structuralSubtypeRawEntries } from "./helpers/structural-subtype-entry-raw.mjs";
import { parseSubtypeEntryTrace } from "./helpers/php-wasm-subtype-entry-trace.mjs";
import { checkStructuralSubtypePublicTrace, checkStructuralSubtypeRawTrace } from "./helpers/structural-subtype-entry-observe.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const sourcePath = "tests/fixtures/onboarding/structural-subtypes/StructuralSubtypes.lean";
const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const compilerAvailable = existsSync(join(leanPrefix, "include/lean/lean.h"));
const fixture = async () => {
	const probe = structuralSubtypeEntrySource(await readFile(sourcePath, "utf8"));
	const model = JSON.parse(await readFile("docs/evidence/structural-subtype-native-20261011/ordinary/records/build-0/model.json"));
	const scalar = model.exports.find(item => item.name === "StructuralSubtypes.scalar");
	model.exports.push({ ...scalar, name: "StructuralSubtypes.unrestricted", symbol: "lb_" + sha256("structuralsubtypes@1.0.0\0StructuralSubtypes.unrestricted").slice(0, 24), refinements: undefined });
	model.bindingIr = structuralSubtypeEntryReview();
	return { probe, model, selected: structuralSubtypeEntrySelection(model, probe) };
};

test("structural entry annotations are reversible and never silently invent missing source definitions", async () => {
	const original = await readFile(sourcePath, "utf8"), { probe, selected } = await fixture();
	assert.equal(probe.originalSha256, sha256(original)); assert.equal(probe.probeSha256, sha256(probe.source));
	assert.equal(probe.edits.length, 16); assert.equal(selected.length, 59);
	assert.throws(() => structuralSubtypeEntrySource(probe.source));
	assert.throws(() => structuralSubtypeEntrySource(original.replace("def checkedPositive", "def missingPositive")));
	assert.equal(selected.find(item => item.label === "StructuralSubtypes.checkedByte").parameters[0], "uint8_t");
	assert.ok(selected.filter(item => item.kind === "validator").every(item => item.result === "uint8_t"));
	assert.equal(selected.find(item => item.label === "StructuralSubtypes.generic").symbol, "l_StructuralSubtypes_generic___redArg");
});

test("structural entry expectations retain every original public call and reject missing instrumentation", async () => {
	const { selected } = await fixture(), calls = structuralSubtypeEntryCorpus();
	assert.equal(calls.length, 2037);
	const trace = calls.map(call => [`LB_SUBTYPE_ENTRY_V1 begin public ${call.publicName}`, ...call.entries.map(item => `LB_SUBTYPE_ENTRY_V1 enter ${item.kind} ${item.label}`), `LB_SUBTYPE_ENTRY_V1 end public ${call.publicName}`].join("\n") + "\n").join("");
	assert.deepEqual(parseSubtypeEntryTrace(trace, selected), calls);
	assert.equal(checkStructuralSubtypePublicTrace(trace, selected).length, 2037);
	assert.throws(() => checkStructuralSubtypePublicTrace(trace.replace("LB_SUBTYPE_ENTRY_V1 enter source StructuralSubtypes.scalar\n", ""), selected));
	assert.throws(() => checkStructuralSubtypePublicTrace("", selected));
	assert.ok(trace.length < 4 * 1024 * 1024);
	assert.notEqual(parseSubtypeEntryTrace("", selected).length, calls.length);
	assert.throws(() => parseSubtypeEntryTrace(trace.replace("begin public scalar", "begin public invented"), selected));
	const invalidFin = calls.filter(call => call.publicName === "nested")[1];
	assert.deepEqual(invalidFin.counts, { validator: 0, constructor: 0, adapter: 0, source: 0 });
	assert.deepEqual(structuralSubtypeEntryCall("unrestricted").counts, { validator: 0, constructor: 0, adapter: 1, source: 1 });
	const raw = structuralSubtypeRawCases(); assert.equal(raw.length, 11);
	for(const item of raw)
	{
		const entries = structuralSubtypeRawEntries(item);
		assert.ok(!entries.some(entry => entry.kind === "validator"));
		assert.equal(entries.filter(entry => entry.kind === "source").length, item.bad < 0 ? 1 : 0);
		const initialization = structuralSubtypeEntryCall("unrestricted");
		const prefix = `LB_SUBTYPE_ENTRY_V1 begin public unrestricted\n${initialization.entries.map(entry => `LB_SUBTYPE_ENTRY_V1 enter ${entry.kind} ${entry.label}\n`).join("")}LB_SUBTYPE_ENTRY_V1 end public unrestricted\n`;
		const rawTrace = prefix + "LB_STRUCTURAL_RAW_V1 begin\n" + entries.map(entry => `LB_SUBTYPE_ENTRY_V1 enter ${entry.kind} ${entry.label}\n`).join("") + "LB_STRUCTURAL_RAW_V1 end\n";
		assert.deepEqual(checkStructuralSubtypeRawTrace(rawTrace, selected, item), entries);
		assert.throws(() => checkStructuralSubtypeRawTrace(rawTrace.replace(/LB_SUBTYPE_ENTRY_V1 enter constructor [^\n]+\n/u, ""), selected, item));
	}
});

test("structural entry interposer and raw driver compile against exact public and Lean ABI headers", { skip: !compilerAvailable && !process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_ENTRY_TEST && !process.env.LEAN_BRIDGE_LEAN_PREFIX }, async t => {
	const { model, selected } = await fixture(), root = await mkdtemp(join(tmpdir(), "lean-bridge-structural-entry-syntax-"));
	t.after(() => rm(root, { recursive: true }));
	const files = { ...generateCBindingPackage(model.bindingIr), ...generateGmpProjection(model.bindingIr).files };
	for(const [path, content] of Object.entries(files)) await saveLakeFile(root, path, content);
	const header = generateNativeLeanAdapters(model).header;
	await saveLakeFile(root, "component.h", header);
	await saveLakeFile(root, "interposer.c", '#include "component.h"\n' + structuralSubtypeEntryInterposer(selected));
	await saveLakeFile(root, "raw.c", structuralSubtypeRawProbe(model));
	for(const source of ["interposer.c", "raw.c"])
		await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-isystem", join(leanPrefix, "include"), "-Iinclude", source], root);
});
