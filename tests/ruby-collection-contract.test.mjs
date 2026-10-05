/**
 * Generated Ruby collection admission, stable snapshots and value semantics.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { generateCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { generateRubyBindingPackage } from "../src/backends/ruby/generate.mjs";
import { auditManagedBindingPackage } from "../src/backends/managed/package-audit.mjs";
import { copiedRubyConversions, copiedRubyHelpers } from "../src/backends/ruby/copied-conversions.mjs";
import { collectionReviewedIr, collectionSignatures } from "./helpers/collection-fixture.mjs";
import { assertRubyVariantSourceHash } from "./helpers/ruby-source-history.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { rubyVariantReviewedIr } from "./helpers/ruby-variant-fixture.mjs";

test("Ruby collections preserve the complete independent copied contract", () => {
	const ir = collectionReviewedIr(), model = compileCopiedRubyModel(ir), files = generateCopiedRubyPackage(ir);
	assert.equal(model.surface.functions.length, 35); assert.equal(collectionSignatures.length, 35);
	assert.equal(model.surface.copies.filter(copy => copy.record).length, 7);
	assert.deepEqual(files, generateCopiedRubyPackage(structuredClone(ir)));
	assert.deepEqual(files, generateRubyBindingPackage(ir));
	assert.equal(auditManagedBindingPackage(ir, files, "ruby").publicFiles.length, 1);
	const source = files["lib/lean_bridge/collections.rb"], native = files["lib/lean_bridge/collections/native.rb"];
	for(const name of ["Primitives", "Empty", "Single", "Count", "Pair", "Reversed", "Packet"])
		assert.ok(source.includes(`class ${name}`));
	assert.match(source, /char_:/);
	for(const name of ["==", "eql?", "hash", "deconstruct_keys"])
		assert.equal(source.split(`def ${name}`).length - 1, 7);
	assert.doesNotMatch(source, /Fiddle|Pointer|dispatch|constructor_tag/);
	assert.match(native, /EXACT_TYPE = ::Object.instance_method\(:instance_of\?\)/);
	assert.match(native, /field\d+ = STORED_FIELD.bind_call\(value, :@char_\)/);
	assert.match(native, /values = array_input\(value, scope, 8\)/);
	assert.match(native, /length = STRING_BYTESIZE.bind_call\(value\)\n\s*data = scope.allocate\(length, charged: true\)\n\s*data\[0, length\] = value\n\s*span\(scope, data, length, 32\)/);
	assert.doesNotMatch(native, /value\.(?:instance_of\?|bytesize|length|encoding|valid_encoding\?|ord)/);
	assert.match(files["README.md"], /bounded snapshots/);
	assert.match(files["README.md"], /field-by-field ==, eql\?, hash and deconstruct_keys/);
});

test("Ruby record pattern methods cannot overwrite source fields", () => {
	for(const name of ["deconstruct", "deconstruct_keys", "deconstructKeys"])
	{
		const ir = collectionReviewedIr();
		ir.types.find(type => type.name === "Pair").fields[0].name = name;
		assert.throws(() => compileCopiedRubyModel(ir), /Ruby record field name collides/);
	}
});

const ruby = process.env.LEAN_BRIDGE_RUBY ?? resolve(".toolchains/ruby33/bin/ruby");
test("Ruby builtin snapshots reject spoofed types and keep entries through reentrant allocation", { skip: !existsSync(ruby) }, async () => {
	const ir = collectionReviewedIr(), model = compileCopiedRubyModel(ir), files = generateCopiedRubyPackage(ir);
	const publicSource = files["lib/lean_bridge/collections.rb"].split("require_relative ")[0];
	const fixture = await readFile("tests/fixtures/collection-consumers/ruby-snapshots.rb", "utf8");
	const source = `require "fiddle"\n${publicSource}\nmodule LeanBridge\nmodule Collections\nmodule Native\n  extend self\n${copiedRubyHelpers}\n${copiedRubyConversions(model)}\nend\nend\nend\n${fixture}`;
	const index = predicate => model.surface.copies.find(predicate).index;
	const layout = {
		bytes: index(copy => copy.scalarName === "bytes")
		, string: index(copy => copy.scalarName === "string")
		, array: index(copy => copy.element?.scalarName === "uint32")
		, char: index(copy => copy.scalarName === "char")
		, bool: index(copy => copy.scalarName === "bool")
		, unit: index(copy => copy.scalarName === "unit")
		, record: index(copy => copy.record?.name === "Pair")
	};
	const result = await runCopied(ruby, ["--disable-gems", "-e", source, JSON.stringify(layout)], ".").catch(error => {
		throw new Error(error.details?.stderr ?? error.message);
	});
	assert.equal(result.stderr, "");
	assert.deepEqual(JSON.parse(result.stdout), { snapshots: 7, rejections: 8, valueChecks: 5 });
});

test("generated Ruby variant values compare constructor identity and nested copied contents", { skip: !existsSync(ruby) }, async () => {
	const files = generateCopiedRubyPackage(rubyVariantReviewedIr());
	const publicSource = files["lib/lean_bridge/variants.rb"].split("require_relative ")[0];
	const source = `require "fiddle"
${publicSource}
module LeanBridge
module Variants
module Native
  extend self
${copiedRubyHelpers}
end
end
end
api = LeanBridge::Variants
a = api::Signal::Data.new(count: 2**200, label: +"same")
b = api::Signal::Data.new(count: 2**200, label: +"same")
raise "value equality" unless a == b && a.eql?(b) && a.hash == b.hash && {a => 7}.fetch(b) == 7
raise "constructor identity" if api::Signal::Idle.new == api::Signal::Stopped.new
left = api::Packet.new(current: a, events: [a, api::Signal::Idle.new], fallback: api::Some.new(a), modes: [api::Mode::First.new])
right = api::Packet.new(current: b, events: [b, api::Signal::Idle.new], fallback: api::Some.new(b), modes: [api::Mode::First.new])
raise "nested equality" unless left == right && left.eql?(right) && left.hash == right.hash
a.label.replace("changed")
raise "mutable contents" if left == right
puts "value semantics passed"
`;
	const result = await runCopied(ruby, ["--disable-gems", "-e", source], ".").catch(error => {
		throw new Error(error.details?.stderr ?? error.message);
	});
	assert.equal(result.stderr, ""); assert.equal(result.stdout, "value semantics passed\n");
});

test("Ruby historical verifier upgrades preserve every recorded byte and reject unrelated edits", async () => {
	const record = JSON.parse(await readFile("docs/evidence/ruby-variants-20260921.json"));
	for(const path of ["tests/ruby-variant-contract.test.mjs", "tests/ruby-variant-evidence.test.mjs"])
	{
		const current = await readFile(path), hash = record.sourceHashes[path];
		assert.notEqual(sha256(current), hash);
		assertRubyVariantSourceHash(path, current, hash);
		assert.throws(() => assertRubyVariantSourceHash(path, `${current}\n// unrelated change\n`, hash));
	}
	const path = "tests/fixtures/variant-consumers/ruby.rb", current = await readFile(path);
	assertRubyVariantSourceHash(path, current, record.sourceHashes[path]);
	assert.throws(() => assertRubyVariantSourceHash(path, `${current}\n# changed fixture\n`, record.sourceHashes[path]));
});
