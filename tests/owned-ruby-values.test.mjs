/**
 * Check Ruby's nominal ownership declarations without claiming native transport.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedRubyValues } from "../src/backends/ruby/owned-values.mjs";
import { ownedRubyRuntime } from "../src/backends/ruby/owned-runtime.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("owned Ruby values preserve finite nominal, callback and alias declarations", () => {
	const values = generateOwnedRubyValues(ownedCppCompositionReviewedIr());
	assert.equal(values.types.length, 41); assert.equal(values.functions.length, 31);
	assert.equal(values.componentName, "OwnedAggregates");
	assert.match(values.source, /class Ticket < Owned::Resource/u);
	assert.match(values.source, /class Chain::Link < Chain/u);
	assert.match(values.source, /def initialize\(ticket:, next_:\)/u);
	assert.match(values.source, /Some = ::Data.define\(:value\)/u);
	assert.match(values.source, /BundleAlias = Bundle; Ruby: Bundle/u);
	assert.match(values.source, /TicketRow = array<option<Ticket>>; Ruby: Array/u);
	assert.deepEqual(values.aliases.map(alias => alias.name), ["BundleAlias", "TicketRow"]);
	assert.ok(values.exports.includes("WithRecovery"));
	assert.ok(values.types.filter(node => node.identity).every(node => values.exports.includes(node.publicType)));
	assert.ok(values.source.length < 25000);
	const scalars = generateOwnedRubyValues(ownedPythonScalarsReviewedIr());
	const fields = scalars.types.find(node => node.name === "Scalars").fields;
	assert.equal(fields.length, 19); assert.equal(new Set(fields.map(field => field.type)).size, 19);
	assert.ok(scalars.types.filter(node => node.kind === "primitive").every(node => typeof node.publicType === "string"));
});

test("owned Ruby names cannot replace runtime helpers or alias field spellings", () => {
	for(const name of ["Object", "Owned", "Some", "WithRecovery", "OwnedAggregates"])
	{
		const ir = ownedCppCompositionReviewedIr();
		ir.types.find(node => node.name === "Ticket").name = name;
		assert.throws(() => generateOwnedRubyValues(ir), /reserved or duplicated/u);
	}
	const ir = ownedCppCompositionReviewedIr();
	const fields = ir.types.find(node => node.name === "Payload").fields;
	fields[0].name = "next"; fields[1].name = "next_";
	assert.throws(() => generateOwnedRubyValues(ir), /invalid or duplicate field|field name is invalid or duplicated/u);
});

test("generated Ruby constructors preserve identity, nested options and field meaning", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 180000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-ruby-types-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const values = generateOwnedRubyValues(ownedCppCompositionReviewedIr());
	const callbacks = values.types.filter(node => node.kind === "callback").map(node => {
		const fn = values.c.callbacks.find(item => item.id === node.id);
		return `  check(V::${node.publicType}.instance_method(:call).arity == ${fn.parameters.length - 1})\n  check(V::${node.publicType} < V.const_get(:Owned, false)::Resource)`;
	});
	const runtime = ownedRubyRuntime(values.c.prefix);
	await saveLakeFile(directory, "values.rb", `module LeanBridge\nmodule ${values.componentName}\n${runtime}\nend\nend\n${values.source}`);
	await saveLakeFile(directory, "consumer.rb", `require_relative "values"
require "json"
module Consumer
  V = LeanBridge::OwnedAggregates
  @checks = 0
  def self.check(value)
    raise "Ruby declaration check #{@checks + 1} failed" unless value
    @checks += 1
  end
  check(V::UNIT.frozen?)
  check(V::Some.new(nil) != nil)
  check(V::Some.new(V::UNIT) != V::Some.new(nil))
  check(V::Some.new(V::Some.new(nil)) != V::Some.new(nil))
  check(V::Some.new([]) != V::Some.new(nil))
  check(V::Ok.new(nil) != V::Err.new(nil))
  check(V::Choice::Empty.new == V::Choice::Empty.new)
  check(V::Chain::Stop.new != V::Choice::Empty.new)
  check(V::Choice::Empty.new.frozen?)
  check(V::Choice::Pair.new(first: 1, second: 2) != V::Choice::Pair.new(first: 2, second: 1))
  check(V::Payload.new(count: 2, bytes: "a\\0b".b) == V::Payload.new(count: 2, bytes: "a\\0b".b))
  record = V::Payload.new(count: 2, bytes: "ab".b)
  check(record.frozen?)
  check(record.deconstruct_keys(nil) == {count: 2, bytes: "ab".b})
  check({record => 3}[V::Payload.new(count: 2, bytes: "ab".b)] == 3)
  node = V::Chain::Link.new(ticket: nil, next_: V::Chain::Stop.new)
  check(node.next_.instance_of?(V::Chain::Stop))
  check(node.deconstruct_keys(nil).keys == [:ticket, :next_])
  check(V::Tree::Branch.new(children: [V::Tree::Leaf.new(ticket: nil)]).children.length == 1)
  check(!V.const_defined?(:BundleAlias, false) && !V.const_defined?(:TicketRow, false))
  begin
    V::Ticket.new
  rescue TypeError => error
    check(error.message == "Resources are returned by Lean functions")
  else
    raise "Resource constructors must not fabricate identities"
  end
  begin
    V::Choice.new
  rescue NoMethodError
    check(true)
  else
    raise "Variants require a declared constructor"
  end
  begin
    record.instance_variable_set(:@count, 7)
  rescue FrozenError
    check(true)
  else
    raise "Value fields must be immutable"
  end
  recovery = V.with_recovery(->(value) { value }, V::UNIT)
  check(recovery.function.call(3) == 3 && recovery.recovery.equal?(V::UNIT))
  check(recovery.frozen?)
${callbacks.join("\n")}
${values.functions.map(fn => `  check(V.method(:${fn.publicName}).arity == ${fn.parameters.length})`).join("\n")}
  puts JSON.generate({checks: @checks, ruby: RUBY_DESCRIPTION})
end
`);
	const result = await runCopied(resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby"), ["--disable-gems", "consumer.rb"], directory, { PATH: "/usr/bin:/bin" });
	assert.equal(result.stderr, "");
	const observation = JSON.parse(result.stdout);
	assert.ok(observation.checks >= 60);
	await saveLakeFile(resolve("build/owned-ruby-values"), "declarations.json", canonicalJson({
		observation, executedRuby: true, compiledLean: false, installedPackage: false
		, valuesSha256: sha256(values.source), runtimeSha256: sha256(runtime)
	}));
});
