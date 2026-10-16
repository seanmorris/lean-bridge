/**
 * Copied Ruby records escape Lean fields named like reserved Ruby members.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedRubyGraphPackage } from "../src/backends/ruby/copied-graph-package.mjs";
import { rubyMemberName } from "../src/backends/ruby/copied-graph-values.mjs";
import { generateCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { mutualCheckedRecordReview } from "./helpers/mutual-checked-record-fixture.mjs";
import { nestedCheckedRecordReview } from "./helpers/nested-checked-record-fixture.mjs";
import "./helpers/ruby-graph-keyword-field-source-history-tests.mjs";
import "./helpers/ruby-member-escape-source-history-tests.mjs";

const ruby = resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby");
const publicPath = "lib/lean_bridge/mutualcheckedrecords.rb";
// Rename consistently in types and refinement trees.
const renamed = (ir, from, to) => JSON.parse(JSON.stringify(ir)
	.replaceAll(`"name":"${from}"`, `"name":"${to}"`));

test("Ruby graph records escape reserved Lean field names and keep the Lean name in metadata", () => {
	const files = generateCopiedRubyGraphPackage(mutualCheckedRecordReview());
	const source = files[publicPath];
	assert.match(source, /^ {6}attr_reader :value, :mode, :next_$/mu);
	assert.match(source, /^ {6}def initialize\(value:, mode:, next_:\)$/mu);
	assert.match(source, /^ {8}@next_ = next_$/mu);
	assert.match(source, /^ {8}\{ value: @value, mode: @mode, next_: @next_ \}$/mu);
	assert.doesNotMatch(source, /binding\.local_variable_get/u);
	assert.deepEqual(JSON.parse(files["binding-manifest.json"]).memberNames
		, [{ type: "Envelope", field: "next", ruby: "next_" }]);
	assert.ok(files["README.md"].includes("Envelope#next_ is Lean field next. Diagnostics name the Lean field."));
	assert.equal(rubyMemberName("next"), "next_"); assert.equal(rubyMemberName("hash"), "hash_");
	assert.equal(rubyMemberName("value"), "value");
	for(const name of ["begin", "end", "in", "redo", "undef", "hash", "freeze", "send", "self"])
	{
		const generated = generateCopiedRubyGraphPackage(renamed(mutualCheckedRecordReview(), "next", name));
		assert.match(generated[publicPath], new RegExp(`def initialize\\(value:, mode:, ${name}_:\\)`, "u"), name);
		assert.deepEqual(JSON.parse(generated["binding-manifest.json"]).memberNames
			, [{ type: "Envelope", field: name, ruby: `${name}_` }]);
	}
	assert.throws(() => generateCopiedRubyGraphPackage(renamed(mutualCheckedRecordReview(), "mode", "next_")));
});

test("copied Ruby records escape reserved Lean field names and reject post-escape collisions", () => {
	const plain = generateCopiedRubyPackage(nestedCheckedRecordReview("full"));
	assert.equal(JSON.parse(plain["binding-manifest.json"]).memberNames, undefined);
	assert.doesNotMatch(plain["README.md"], /trailing underscore/u);
	const files = generateCopiedRubyPackage(renamed(nestedCheckedRecordReview("full"), "word", "next"));
	const source = Object.entries(files).find(([path]) => path.endsWith("/nestedcheckedrecords.rb"))[1];
	assert.match(source, /def initialize\(digit:, next_:\)/u);
	assert.deepEqual(JSON.parse(files["binding-manifest.json"]).memberNames
		, [{ type: "Packet", field: "next", ruby: "next_" }]);
	assert.ok(files["README.md"].includes("Packet#next_ is Lean field next."));
	assert.throws(() => generateCopiedRubyPackage(renamed(renamed(nestedCheckedRecordReview("full")
		, "word", "next"), "digit", "next_")));
});

test("escaped Ruby fields construct, read, compare and pattern-match in Ruby 3.3", async t => {
	if(await access(ruby).then(() => false, () => true))
	{
		t.skip(`Ruby 3.3 is unavailable at ${ruby}`);
		return;
	}
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-member-escape-"));
	t.after(() => rm(root, { recursive: true }));
	await writeFile(join(root, "public.rb"), generateCopiedRubyGraphPackage(mutualCheckedRecordReview())[publicPath]);
	const program = `require "json"
src = File.read(ARGV[0]).sub(%(require_relative "mutualcheckedrecords/native"\\n), "")
eval(src)
M = LeanBridge::Mutualcheckedrecords
inner = M::Envelope.new(value: 2, mode: 1, next_: nil)
outer = M::Envelope.new(value: 1, mode: 0, next_: M::Some.new(value: M::Step::More.new(packet: inner)))
matched = case outer
          in { next_: M::Some[value: { packet: { value: } }] } then value
          end
copy = M::Envelope.new(value: 1, mode: 0, next_: M::Some.new(value: M::Step::More.new(packet: inner)))
puts JSON.generate([outer.next_.value.packet.value, matched, outer == copy, outer.frozen?, outer.deconstruct_keys(nil).keys])
`;
	assert.deepEqual(JSON.parse(execFileSync(ruby, ["-e", program, join(root, "public.rb")], { encoding: "utf8" }))
		, [2, 2, true, true, ["value", "mode", "next_"]]);
});
