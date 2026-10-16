/**
 * Exact checked-refinement diagnostics through recursive Ruby graph gems.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { generateCopiedRubyGraphConversions } from "../src/backends/ruby/copied-graph-conversions.mjs";
import { generateCopiedRubyGraphPackage } from "../src/backends/ruby/copied-graph-package.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { recursiveCheckedRecordReview } from "./helpers/recursive-checked-record-fixture.mjs";
import "./helpers/ruby-graph-diagnostic-source-history-tests.mjs";

const native = "lib/lean_bridge/recursivecheckedrecords/native.rb";
const ruby = process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby";

test("Ruby graph diagnostics are explicit and leave other gems byte-identical", () => {
	for(const ir of [nativeRecursiveReviewedIr(), recursiveCheckedRecordReview()])
	{
		const before = structuredClone(ir), files = generateCopiedRubyGraphPackage(ir);
		assert.deepEqual(generateCopiedRubyGraphPackage(ir, null
			, { refinementDiagnostics: false }), files);
		assert.deepEqual(ir, before);
		for(const text of Object.values(files))
			assert.doesNotMatch(text, /_graph_error|DIAGNOSTIC|graph_checked_status/u);
	}
	for(const value of [0, 1, "true", null])
	{
		assert.throws(() => generateCopiedRubyGraphConversions(recursiveCheckedRecordReview()
			, { refinementDiagnostics: value }), /must be explicit/u);
		assert.throws(() => generateCopiedRubyGraphPackage(recursiveCheckedRecordReview(), null
			, { refinementDiagnostics: value }), /must be explicit/u);
	}
});

test("Ruby graph diagnostics bind the adapter reader once and route every call", () => {
	const ir = recursiveCheckedRecordReview();
	const off = generateCopiedRubyGraphPackage(ir);
	const on = generateCopiedRubyGraphPackage(ir, null, { refinementDiagnostics: true });
	assert.deepEqual(Object.keys(on), Object.keys(off));
	for(const path of Object.keys(off).filter(path => path !== native))
		assert.equal(on[path], off[path], path);
	const source = on[native];
	assert.equal(source.match(/^ {6}DIAGNOSTIC = ::Fiddle::Function\.new\(LIBRARY\["recursivecheckedrecords_graph_error"\], \[\], ::Fiddle::TYPE_VOIDP, need_gvl: true\)$/gmu)
		.length, 1);
	const calls = source.match(/^ {12}graph(?:_checked)?_status\(invoke\.call\(.*$/gmu);
	assert.equal(calls.length, ir.declarations.length);
	for(const call of calls) assert.match(call, /^ {12}graph_checked_status\(invoke\.call\(.*\), DIAGNOSTIC\)$/u);
	assert.equal(source.replace(/^ {6}DIAGNOSTIC = .*\n/mu, "")
		.replace(/^ {6}def graph_checked_status[^]*?\n {6}end\n/mu, "")
		.replaceAll("graph_checked_status(", "graph_status(")
		.replaceAll(", DIAGNOSTIC)", ")"), off[native]);
});

test("Ruby graph diagnostics read once, only for invalid input, and reject malformed text", async t => {
	if(await access(ruby).then(() => false, () => true))
	{
		t.skip(`Ruby 3.3 is unavailable at ${ruby}`);
		return;
	}
	const source = generateCopiedRubyGraphConversions(recursiveCheckedRecordReview()
		, { refinementDiagnostics: true }).source;
	const method = name => source.match(new RegExp(`^ {6}def ${name}\\b[^]*?\\n {6}end$`, "mu"))[0];
	const program = `require "json"
class LeanBridgeError < StandardError
  attr_reader :status
  def initialize(status, message) = (@status = status; super(message))
end
class GraphInvalidNative < LeanBridgeError
  def initialize(message = "Invalid native copied value") = super(4, message)
end
class Reader
  attr_reader :reads
  def initialize(value) = (@value = value; @reads = 0)
  def call = (@reads += 1; @value)
end
class Text
  def initialize(bytes) = @bytes = bytes
  def null? = @bytes.nil?
  def to_s = @bytes.dup.force_encoding(Encoding::ASCII_8BIT)
end
module Probe
  extend self
${method("graph_status")}
${method("graph_checked_status")}
end
text = "arg0.tail?.value was rejected by RecursiveCheckedRecords.plusOne"
reads = 0
outcomes = [[0, "stale"], [1, text], [1, nil], [1, "\\u00e9"], [1, "\\xff".b], [2, "stale"], [3, "stale"], [5, "stale"], [4, "stale"]].map do |status, bytes|
  reader = Reader.new(Text.new(bytes))
  begin
    Probe.graph_checked_status(status, reader)
    nil
  rescue LeanBridgeError => error
    [error.class.name, error.status, error.message.dup.force_encoding(Encoding::UTF_8)]
  ensure
    reads += reader.reads
  end
end
puts JSON.generate(outcomes + [reads])
`;
	const result = JSON.parse(execFileSync(ruby, ["-e", program], { encoding: "utf8" }));
	assert.deepEqual(result, [
		null
		, ["LeanBridgeError", 1, "arg0.tail?.value was rejected by RecursiveCheckedRecords.plusOne"]
		, ["LeanBridgeError", 1, "Invalid native input"]
		, ["LeanBridgeError", 1, "é"]
		, ["GraphInvalidNative", 4, "Malformed native refinement diagnostic"]
		, ["LeanBridgeError", 2, "Native graph copy limit exceeded"]
		, ["LeanBridgeError", 3, "Native allocation failed"]
		, ["LeanBridgeError", 5, "Lean runtime is unavailable"]
		, ["GraphInvalidNative", 4, "Invalid native copied value"]
		, 4
	]);
});

test("RubyGems selects Ruby graph diagnostics with the shared adapter rule", async () => {
	const rubygems = await readFile("src/release/native-rubygems.mjs", "utf8");
	assert.match(rubygems, /generate === generateCopiedRubyGraphPackage\n\t+\? \[\{ refinementDiagnostics: nativeGraphRefinementDiagnostics\(model\) \}\] : \[\]/u);
});
