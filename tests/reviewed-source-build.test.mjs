/**
 * Fresh Lean compilation must reject review/source disagreement before linking.
 *
 * @file
 */
import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { corpusLibraries } from "./fixtures/type-corpus/cases.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const source = `namespace Public
structure Packet where
  word : UInt32
  label : String
def increment (value : UInt32) : UInt32 := value + 1
def copyPacket (value : Packet) := value
theorem copyPacket_spec (value : Packet) : copyPacket value = value := rfl
end Public
`;
const contract = () => {
	const document = corpusReviewedIr(corpusLibraries[0]);
	document.component = { id: "sample@1.0.0", name: "sample", version: "1.0.0" };
	const reference = { kind: "named", id: "lean:Public.Packet" };
	const scalar = { kind: "primitive", name: "uint32" };
	const record = document.types[0];
	document.types = [{ ...record, id: reference.id, name: "Packet"
		, source: { ...record.source, declaration: "Public.Packet" }
		, fields: ["word", "label"].map((name, index) => ({ name
			, type: index ? { kind: "primitive", name: "string" } : scalar
			, mutability: "immutable", documentation: record.documentation })) }];
	const template = document.declarations[0];
	document.declarations = ["increment", "copyPacket"].map((name, index) => ({ ...template
		, id: `lean:Public.${name}`, name, overloadKey: `Public.${name}`
		, source: { ...template.source, declaration: `Public.${name}` }
		, parameters: [{ ...template.parameters[0], type: index ? reference : scalar }]
		, result: { ...template.result, type: index ? reference : scalar } }));
	return document;
};

test("fresh Lean checks review identities, record layouts, selection and drift before linking", {
	skip: process.env.LEAN_BRIDGE_REVIEWED_SOURCE_TEST !== "1", timeout: 180_000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-source-test-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project"), outputRoot = join(directory, "component");
	await saveLakeFile(root, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(root, "lakefile.toml", 'name = "sample"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Entry"\n');
	await saveLakeFile(root, "Elsewhere.lean", "namespace Elsewhere\ndef secret : UInt32 := 9\nend Elsewhere\n");
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Entry"] }));
	const variants = [
		{ name: "unrelated module and namespace", code: "test-checked", change: () => {} }
		, { name: "parameter mismatch", code: "reviewed-ir-source-mismatch", change: ir => { ir.declarations[0].parameters[0].type = { kind: "primitive", name: "uint64" }; } }
		, { name: "return mismatch", code: "reviewed-ir-source-mismatch", change: ir => { ir.declarations[0].result.type = { kind: "primitive", name: "uint64" }; } }
		, { name: "field order", code: "reviewed-ir-source-mismatch", change: ir => { ir.types[0].fields.reverse(); } }
		, { name: "nominal record name", code: "reviewed-ir-source-mismatch", change: ir => { ir.types[0].name = "OtherPacket"; } }
		, { name: "export outside roots", code: "native-elaboration-unsupported"
			, change: ir => {
			const declaration = ir.declarations[0];
			Object.assign(declaration, { id: "lean:Elsewhere.secret", name: "secret", overloadKey: "Elsewhere.secret" });
				declaration.source.declaration = "Elsewhere.secret";
			}
		}
		, { name: "source signature changed", code: "reviewed-ir-source-mismatch"
			, change: () => {}
			, source: source.replaceAll("UInt32", "UInt64") }
		, { name: "review drift", code: "native-elaboration-drift", change: () => {}, drift: true }
	];
	for(const variant of variants)
	{
		const document = contract(); variant.change(document);
		await saveLakeFile(root, "Entry.lean", variant.source ?? source);
		await saveLakeFile(root, "api.binding-ir.json", canonicalJson(document));
		const before = await lakeInputState(root);
		let adapterChecked = false, extracted = false;
		const runner = { capture: async command => {
			const result = await processBuildRunner.capture(command);
			if(command.args.includes("--metadata"))
			{
				extracted = true;
				if(variant.drift) await saveLakeFile(root, "api.binding-ir.json", `${await readFile(join(root, "api.binding-ir.json"), "utf8")} `);
			}
			return result;
		} };
		const options = { projectRoot: root, outputRoot
			, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
			, targets: ["c"], profile: "native-library-v1"
			, receiptName: "native-component.json"
			, createModel: createNativeModel, runner
			, compileComponent: async ({ model, adapters }) => {
				assert.equal(variant.code, "test-checked", "Invalid review reached the native linker");
				adapterChecked = true;
				assert.ok(model.exports.every(item => item.module === "Entry"));
				assert.match(adapters.leanSource, /import Entry/);
				throw Object.assign(new Error("Checked before native linking"), { code: "test-checked" });
			}
		};
		await assert.rejects(() => buildElaboratedComponent(options), error => {
			assert.equal(error.code, variant.code, `${variant.name}: ${error.message}`);
			if(variant.code === "reviewed-ir-source-mismatch") assert.ok(error.details.field.startsWith("bindingIr."));
			return true;
		});
		assert.equal(extracted, true);
		assert.equal(adapterChecked, variant.code === "test-checked");
		await assert.rejects(() => lstat(outputRoot), { code: "ENOENT" });
		if(!variant.drift) assert.deepEqual(await lakeInputState(root), before);
	}
});
