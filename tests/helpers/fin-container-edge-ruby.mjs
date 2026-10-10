/**
 * Observe every edge call in the unchanged Ruby consumer through its normal generated API.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { finContainerEdgeColumns, finContainerEdgeEntries } from "./fin-container-edge-dispatch.mjs";
import { finContainerEdgeConsumer, insertFinContainerEdgeFragment } from "./fin-container-edges.mjs";

/** Independently enumerate the complete original and additive Ruby calls. */
export const finContainerEdgeRubyExpected = Object.freeze((() => {
	const rows = [], counts = Array(8).fill(0);
	const add = (method, status) => {
		const index = finContainerEdgeEntries.indexOf(method);
		if(status === "ok")
		{
			counts[index + 2]++;
			if(index >= 4) counts[index - 4]++;
		}
		rows.push(Object.freeze([rows.length + 1, method, status, Object.freeze([...counts])]));
	};
	for(const status of ["ok", "fin", "ok"]) add("present", status);
	for(const status of ["ok", "ok", "fin"]) add("flatten", status);
	for(const method of finContainerEdgeEntries.slice(0, 3))
	{
		add(method, "ok");
		for(let value = 0; value < 3; value++) add(method, "fin");
	}
	for(let value = 0; value < 3; value++) add("optionalDigits", "ok");
	for(let row = 0; row < 3; row++)
	{
		add("present", "fin"); add("optionalDigits", "fin");
		for(let column = 0; column < 3; column++) add("flatten", "fin");
	}
	add("present", "ok"); add("flatten", "ok");
	for(const method of ["emptyOption", "emptyList", "optionalDigits"]) add(method, "type");
	for(const method of finContainerEdgeEntries.slice(0, 3)) add(method, "value");
	for(let value = 0; value < 3; value++) add("optionalDigits", "value");
	for(let cycle = 0; cycle < 1000; cycle++)
		for(const method of ["emptyArray", "emptyList", "emptyOption", "present", "flatten", "optionalDigits"])
		{ add(method, "fin"); add(method, "ok"); }
	return rows;
})());

/**
 * Require every call and exception class, not just the aggregate totals.
 *
 * @param stdout - Actual Ruby process output.
 */
export const readFinContainerEdgeRuby = stdout => {
	assert.ok(typeof stdout === "string" && stdout.endsWith("\n"));
	const lines = stdout.slice(0, -1).split("\n");
	assert.equal(lines.pop(), "fin-container-ok:14094");
	assert.equal(lines.length, finContainerEdgeRubyExpected.length);
	return lines.map((line, index) => {
		assert.match(line, /^edge-ruby [1-9][0-9]* [A-Za-z]+ (?:ok|fin|type|value)(?: (?:0|[1-9][0-9]{0,14})){8}$/u);
		const [, step, method, status, ...counts] = line.split(" ");
		const row = [Number(step), method, status, counts.map(Number)];
		assert.deepEqual(row, finContainerEdgeRubyExpected[index], `Ruby edge call ${index + 1}`);
		return row;
	});
};

/**
 * Wrap the six public methods locally. Generated modules, native bytes and assertions remain unchanged.
 *
 * @param model - Verified native model.
 * @param component - Original component identity.
 * @param identity - Optional receipt-pinned package root checked inside the Ruby process.
 */
export const finContainerEdgeRubyProbe = async (model, component, identity = null) => {
	finContainerEdgeColumns(model, component);
	if(identity) assert.ok(typeof identity.installed === "string" && isAbsolute(identity.installed) && !identity.installed.includes("\0"));
	const prelude = `module EdgeCounter
  RECORD, NONCE, CONFIG, DEFINERS = ARGV
  EXPECTED = DEFINERS.to_s.split(",").map { |value| Integer(value, 10) }
  LAYOUT = "a8L<L<a64a32q<L<L<L<L<Q<8l<8L<8Q<8"
  @step = 0
  def self.refuse(code, message)
    $stderr.write(message + "\\n")
    exit code
  end
  def self.record
    bytes = begin
      ::File.binread(RECORD)
    rescue ::SystemCallError, ::TypeError
      nil
    end
    bytes && bytes.bytesize == 328 ? bytes.unpack(LAYOUT) : nil
  end
  def self.ours?(value)
    value && value[0] == "LBFEDGDB" && value[1] == 1 && value[2] == 8 && value[3] == CONFIG && value[4] == NONCE && value[5] == ::Process.pid && value[6] == 1
  end
  def self.initial
    value = record
    unless ARGV.size == 4 && EXPECTED.size == 8 && ours?(value) && value[7..17].all?(&:zero?) && value[18, 8].all? { |index| index == -1 } && value[26, 16].all?(&:zero?)
      refuse(2, "edge record is not attached with empty counters")
    end
  end
  def self.counts
    value = record
    unless ours?(value) && value[7] == 255 && value[8].zero? && value[9].zero? && value[10, 8].all? { |count| count == 1 } && value[18, 8] == EXPECTED && value[26, 8].all?(&:zero?)
      refuse(3, "Ruby edge definitions are not completely armed")
    end
    value[34, 8]
  end
  def self.record_call(index, name, status, before)
    after = counts
    8.times do |column|
      delta = status == "ok" && (column == index + 2 || (index >= 4 && column == index - 4)) ? 1 : 0
      refuse(5, "wrong Ruby edge dispatch count") unless after[column] == before[column] + delta
    end
    @step += 1
    puts ["edge-ruby", @step, name, status, *after].join(" ")
  end
  def self.call(index, name)
    before = counts
    begin
      value = yield
    rescue ::TypeError
      record_call(index, name, "type", before)
      raise
    rescue ::RangeError => error
      status = if error.message.match?(/\\Aarg[0-9]+(?:\\[[0-9]+\\]|\\?)* is not below its Fin [0-9]+ bound\\z/)
        "fin"
      elsif error.message == "Nat cannot be negative"
        "value"
      end
      raise unless status
      record_call(index, name, status, before)
      raise
    end
    record_call(index, name, "ok", before)
    value
  end
end
EdgeCounter.initial
`;
	const location = identity ? `expected_root = ${JSON.stringify(identity.installed).replaceAll("#", "\\#")}
["lib/lean_bridge/fincontainers.rb", "lib/lean_bridge/fincontainers/native.rb", "lib/lean_bridge/native_copied_runtime_v1.rb"].each do |relative|
  expected = ::File.join(expected_root, relative)
  actual = $LOADED_FEATURES.select { |path| path.end_with?(relative.delete_prefix("lib/")) }
  EdgeCounter.refuse(6, "unexpected Ruby module location") unless actual == [expected] && ::File.realpath(actual.fetch(0)) == expected
end
${finContainerEdgeEntries.map(method => {
	const snake = method.replace(/[A-Z]/gu, letter => `_${letter.toLowerCase()}`);
	return `EdgeCounter.refuse(6, "unexpected Ruby public method location") unless LeanBridge::Fincontainers.method(:${snake}).source_location&.first == ::File.join(expected_root, "lib/lean_bridge/fincontainers.rb")`;
}).join("\n")}
` : "";
	const wrappers = `raise "nonempty Ruby edge counters after load" unless EdgeCounter.counts.all?(&:zero?)
${location}\
module EdgeApi
  Some = LeanBridge::Fincontainers::Some
  def self.method_missing(name, *args, **keywords, &block)
    LeanBridge::Fincontainers.public_send(name, *args, **keywords, &block)
  end
${finContainerEdgeEntries.map((method, index) => {
	const snake = method.replace(/[A-Z]/gu, letter => `_${letter.toLowerCase()}`);
	return `  def self.${snake}(*args, **keywords, &block)
    EdgeCounter.call(${index}, "${method}") { LeanBridge::Fincontainers.${snake}(*args, **keywords, &block) }
  end`;
}).join("\n")}
end
`;
	let source = await finContainerEdgeConsumer("ruby");
	source = insertFinContainerEdgeFragment(source, 'require "lean_bridge/fincontainers"', prelude);
	source = insertFinContainerEdgeFragment(source, "API = LeanBridge::Fincontainers", wrappers);
	return source.replace("API = LeanBridge::Fincontainers", "API = EdgeApi");
};
