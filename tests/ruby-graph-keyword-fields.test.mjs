/**
 * Ruby graph records keep Lean field names that are Ruby keywords.
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
import { mutualCheckedRecordReview } from "./helpers/mutual-checked-record-fixture.mjs";
import "./helpers/ruby-graph-keyword-field-source-history-tests.mjs";

const ruby = resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby");
const publicPath = "lib/lean_bridge/mutualcheckedrecords.rb";
const renamed = (ir, from, to) => {
	const changed = structuredClone(ir);
	for(const type of changed.types) for(const member of type.fields) if(member.name === from) member.name = to;
	return changed;
};

test("Ruby graph records admit keyword field names and read them through the initializer binding", () => {
	const files = generateCopiedRubyGraphPackage(mutualCheckedRecordReview());
	const source = files[publicPath];
	assert.match(source, /^ {6}attr_reader :value, :mode, :next$/mu);
	assert.match(source, /^ {6}def initialize\(value:, mode:, next:\)$/mu);
	assert.match(source, /^ {8}@next = binding\.local_variable_get\(:next\)$/mu);
	assert.match(source, /^ {8}\{ value: @value, mode: @mode, next: @next \}$/mu);
	assert.match(source, /^ {8}@value = value$/mu);
	// C keywords such as if/do are already renamed by the shared C layout before Ruby sees them.
	for(const keyword of ["begin", "end", "in", "redo", "undef", "until", "when", "then", "elsif"])
	{
		const generated = generateCopiedRubyGraphPackage(renamed(mutualCheckedRecordReview(), "next", keyword))[publicPath];
		assert.ok(generated.includes(`@${keyword} = binding.local_variable_get(:${keyword})`), keyword);
	}
	// Object methods, special values and runtime hooks stay reserved; C++ keywords such as
	// class/true are renamed by the shared layout before Ruby sees them.
	for(const name of ["self", "nil", "super", "defined", "hash", "freeze", "initialize", "send", "raise", "dup"])
		assert.throws(() => generateCopiedRubyGraphPackage(renamed(mutualCheckedRecordReview(), "next", name))
			, /reserved or duplicated/u, name);
	assert.throws(() => generateCopiedRubyGraphPackage(renamed(mutualCheckedRecordReview(), "mode", "next"))
		, /duplicate next|reserved or duplicated: next/u);
});

test("Ruby keyword fields construct, read, compare and pattern-match in Ruby 3.3", async t => {
	if(await access(ruby).then(() => false, () => true))
	{
		t.skip(`Ruby 3.3 is unavailable at ${ruby}`);
		return;
	}
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-keyword-fields-"));
	t.after(() => rm(root, { recursive: true }));
	const source = generateCopiedRubyGraphPackage(mutualCheckedRecordReview())[publicPath];
	await writeFile(join(root, "public.rb"), source);
	const program = `require "json"
src = File.read(ARGV[0]).sub(%(require_relative "mutualcheckedrecords/native"\\n), "")
eval(src)
M = LeanBridge::Mutualcheckedrecords
inner = M::Envelope.new(value: 2, mode: 1, next: nil)
outer = M::Envelope.new(value: 1, mode: 0, next: M::Some.new(value: M::Step::More.new(packet: inner)))
matched = case outer
          in { next: M::Some[value: { packet: { value: } }] } then value
          end
copy = M::Envelope.new(value: 1, mode: 0, next: M::Some.new(value: M::Step::More.new(packet: inner)))
puts JSON.generate([outer.next.value.packet.value, matched, outer == copy, outer.frozen?, outer.deconstruct_keys(nil).keys])
`;
	assert.deepEqual(JSON.parse(execFileSync(ruby, ["-e", program, join(root, "public.rb")], { encoding: "utf8" }))
		, [2, 2, true, true, ["value", "mode", "next"]]);
});
