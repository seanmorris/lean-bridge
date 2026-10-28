/**
 * Compiler-free controls for Perl/Python/Ruby/Rust proof erasure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createNativeModel } from "../../src/build/native-model.mjs";
import { generatePerlBindingPackage } from "../../src/backends/perl/generate.mjs";
import { generatePythonBindingPackage } from "../../src/backends/python/generate.mjs";
import { generateRubyBindingPackage } from "../../src/backends/ruby/generate.mjs";
import { generateRustBindingPackage } from "../../src/backends/rust/generate.mjs";
import { directProofErasureReview } from "./direct-proof-erasure-fixture.mjs";
import { nativeMetadataFixture } from "./native-metadata.mjs";

test("language direct proof APIs expose one word and no proof slot", () => {
	const ir = directProofErasureReview();
	const python = generatePythonBindingPackage(ir)[
		"lean_directprooferasure/__init__.py"
	];
	const ruby = generateRubyBindingPackage(ir)[
		"lib/lean_bridge/directprooferasure.rb"
	];
	const rust = generateRustBindingPackage(ir)["src/lib.rs"];
	const model = createNativeModel({
		...nativeMetadataFixture()
		, component: {
			id: "directprooferasure@1.0.0", name: "directprooferasure"
			, version: "1.0.0"
		}
		, moduleName: "LeanBridge::DirectProofErasure"
	});
	model.exports[0].name = "DirectProofErasure.keep";
	model.exports[0].module = "DirectProofErasure";
	model.exports[0].publicName = "keep";
	const perlFiles = generatePerlBindingPackage(model, {
		library: "libdirectprooferasure.so"
		, nativeLibrary: { sha256: "b".repeat(64) }
		, runtimeIdentity: "c".repeat(64)
		, initializer: "initialize_DirectProofErasure"
	});
	const perl = perlFiles["Component.xs"];
	assert.match(python, /def keep\(value: int\) -> int:/u);
	assert.match(ruby, /def keep\(arg0\)/u);
	assert.match(rust, /pub fn keep\(value: u32\) -> Result<u32, Error>/u);
	assert.match(perl, /keep\(\.\.\.\)[\s\S]*?items != 1[\s\S]*?keep expects 1 arguments/u);
	for(const source of [python, ruby, rust, perl])
	{
		assert.doesNotMatch(source, /(?:\bproof\b|_before|_after)/iu);
		assert.doesNotMatch(source, /\bTrue\b/u);
	}
});

test("language direct proof callers retain the payload and omit proof values", async () => {
	const sources = {};
	for(const profile of ["perl", "python", "ruby", "rust"])
	{
		const suffix = { perl: "pl", python: "py", ruby: "rb", rust: "rs" }[profile];
		sources[profile] = await readFile(
			`tests/fixtures/direct-proof-erasure-consumers/${profile}.${suffix}`
			, "utf8");
		assert.match(sources[profile], /1005|1004/u);
		assert.doesNotMatch(sources[profile], /(?:_before|_after|True\.intro)/u);
	}
	assert.match(sources.perl, /keep\(\$value\) == \$value/u);
	assert.match(sources.python, /keep\(value\) == value/u);
	assert.match(sources.ruby, /keep\(value\) == value/u);
	assert.match(sources.rust, /keep\(value\)\?, value/u);
});

test("language direct proof runner owns every profile and retained verification", async () => {
	const source = await readFile(
		"scripts/run-direct-proof-erasure-language-ci.sh", "utf8"
	);
	for(const required of [
		"<perl|python|ruby|rust>", "LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_TEST=1"
		, "LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_PROFILE"
		, "LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_ROUTES"
		, "LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_OUTPUT"
		, "for route in ordinary reviewed"
		, "check-direct-proof-erasure-language-ci.mjs"
	]) assert.ok(source.includes(required), required);
	assert.doesNotMatch(source, /continue-on-error/u);
	const workflows = [
		await readFile(".github/workflows/consumer-matrix.yml", "utf8")
		, await readFile(".github/workflows/perl-consumer.yml", "utf8")
	].join("\n");
	for(const required of [
		"id: direct_proof_language"
		, "run-direct-proof-erasure-language-ci.sh \"${{ matrix.profile }}\""
		, "run-direct-proof-erasure-language-ci.sh perl"
		, "direct-proof-erasure-language-${{ matrix.profile }}-${{ github.sha }}"
		, "direct-proof-erasure-language-perl-${{ github.sha }}"
		, "steps.direct_proof_language.outcome != 'success'"
	]) assert.ok(workflows.includes(required), required);
});
