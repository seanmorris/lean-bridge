/**
 * Char remains semantically distinct from UInt32 in every copied-value projection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { reconcileReviewedSource } from "../src/analyze/reviewed-source.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { copiedCppType } from "../src/backends/cpp/copied-values.mjs";
import { compileCopiedPythonModel } from "../src/backends/python/copied-model.mjs";
import { compileCopiedRustModel } from "../src/backends/rust/copied-model.mjs";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { copiedPhpChecks } from "../src/backends/php/copied-conversions.mjs";
import { copiedRustConversions } from "../src/backends/rust/copied-conversions.mjs";
import { charPoints, nativeCharReviewedIr, nativeCharSignatures } from "./helpers/native-char-fixture.mjs";

const char = { kind: "primitive", name: "char" }, uint32 = { kind: "primitive", name: "uint32" };

test("reviewed Char cannot be substituted with same-width UInt32 in scalar or copied positions", () => {
	const compiled = nativeCharReviewedIr(), configuration = canonicalJson({ schemaVersion: 1, modules: ["Glyphs"] });
	const identity = { exportConfigurationSource: configuration
		, exportConfigurationSha256: sha256(configuration)
		, request: { exportModules: ["Glyphs"], exports: compiled.declarations.map(item => item.source.declaration), resources: [], arities: [] } };
	for(const change of [
		ir => { ir.declarations[0].parameters[0].type.name = "uint32"; }
		, ir => { ir.declarations[0].result.type.name = "uint32"; }
		, ir => { ir.declarations[5].parameters[0].type.arguments[0].name = "uint32"; }
		, ir => { ir.types[0].fields[0].type.name = "uint32"; }
	]){
		const ir = structuredClone(compiled); change(ir);
		const source = canonicalJson(ir);
		const review = { schemaVersion: 1, path: "reviewed.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(ir) };
		assert.throws(() => reconcileReviewedSource(review, compiled, identity), { code: "reviewed-ir-source-mismatch" });
	}
});

test("native Char keeps a separate copied type identity, including arrays and records", () => {
	const surface = compilePrimitiveCSurface(nativeCharReviewedIr());
	const character = surface.copy(char), word = surface.copy(uint32);
	assert.notEqual(character.index, word.index);
	assert.equal(character.name, "uint32_t"); assert.equal(word.name, "uint32_t");
	assert.equal(copiedCppType(character), "char32_t");
	assert.equal(copiedCppType(word), "uint32_t");
	const array = surface.copies.find(copy => copy.element?.ref.name === "char");
	assert.equal(array.name, "glyphs_array_char_span");
	assert.equal(copiedCppType(array), "std::vector<char32_t>");
	const record = surface.copies.find(copy => copy.record);
	assert.equal(record.fields[0].type, character);
	assert.equal(record.fields[1].type, array);
});

test("native public Char types preserve supplementary characters without UTF-16 truncation", () => {
	const ir = nativeCharReviewedIr();
	const python = compileCopiedPythonModel(ir).surface.copy(char);
	assert.equal(python.publicType, "str"); assert.equal(python.ctype, "_c.c_uint32");
	const rust = compileCopiedRustModel(ir), scalar = rust.surface.copy(char);
	assert.equal(scalar.publicType, "char"); assert.equal(scalar.ctype, "u32");
	assert.match(copiedRustConversions(rust), /char::from_u32\(\*value\).ok_or\(Error::InvalidNative\)/);
	const dotnet = compileCopiedDotnetModel(ir);
	assert.equal(dotnet.publicType(dotnet.surface.copy(char)), "global::System.Text.Rune");
	const jvm = compileCopiedJvmModel(ir);
	assert.equal(jvm.publicType(jvm.surface.copy(char)), "int");
	assert.ok(compileCopiedRubyModel(ir).surface.copy(char));
	for(const integerBits of [32, 64])
	{
		const php = compileCopiedPhpModel(ir, { integerBits });
		assert.equal(php.surface.copy(char).publicType, "string");
		assert.equal(php.surface.copy(char).ctype, "uint32_t");
		assert.match(copiedPhpChecks(php), /Char requires one Unicode scalar/);
	}
	const wit = compileCopiedWitModel(ir);
	assert.match(wit.wit, /keep: func\([^)]*: char\) -> char/);
	assert.match(wit.wit, /list<char>/);
	assert.match(wit.wat, /char/);
});

test("recorded Char acceptance binds each host caller and both installed source paths", async () => {
	const record = JSON.parse(await readFile("docs/evidence/char-native-20260918.json", "utf8"));
	const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt", ruby: "rb", perl: "pl", "php-native": "php", "php-wasm": "php", "wit-wasi": "c" };
	assert.equal(record.validScalarCases, charPoints.length);
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(record.signatures), sort(nativeCharSignatures));
	assert.equal(record.executions.length, Object.keys(extensions).length * 2);
	assert.equal(new Set(record.executions.map(run => `${run.profile}/${run.path}`)).size, record.executions.length);
	for(const [profile, extension] of Object.entries(extensions))
	{
		let source = (await readFile(`tests/fixtures/char-consumers/${profile === "php-wasm" ? "php-native" : profile}.${extension}`, "utf8")).replaceAll("__POINTS__", charPoints.join(", "));
		if(profile === "php-wasm") source = source.replace("require 'vendor/autoload.php';", "");
		for(const path of ["ordinary-source", "reviewed-ir"])
		{
			const run = record.executions.find(run => run.profile === profile && run.path === path);
			assert.ok(run, `${profile}/${path}`);
			assert.equal(run.consumerSha256, sha256(source));
			assert.ok(run.checks >= (profile === "c" ? 0x110001 : 1000));
			assert.equal(run.sourceRemovedBeforeInstallation, true);
			assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true);
			for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
			assert.ok(run.packages.some(pkg => pkg.role === "component"));
			for(const pkg of run.packages)
				for(const archive of pkg.artifacts) assert.match(archive.sha256, /^[a-f0-9]{64}$/);
			if(profile !== "php-wasm") continue;
			assert.equal(run.arrangements.length, 12);
			assert.equal(new Set(run.arrangements.map(item => [item.realm, item.arrangement, item.loading, item.mode].join("/"))).size, 12);
			assert.equal(run.arrangements.filter(item => item.realm === "chromium").length, 4);
			assert.ok(run.arrangements.every(item => item.checks === run.checks && item.libraries === 2));
		}
	}
});
