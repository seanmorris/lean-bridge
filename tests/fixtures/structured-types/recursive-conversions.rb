# frozen_string_literal: true
require "json"
require "fiddle"
require_relative "graph"
M = LeanBridge::Recursive
N = M.const_get(:Native, false)
LIB = Fiddle::Handle.new(ARGV.fetch(0))
$checks = 0
$buffers = []
$attempts = 0
$fail_at = nil
$failure = NoMemoryError
$async_phase = nil
def check(value)
  raise "Graph conversion assertion #{$checks + 1}" unless value
  $checks += 1
end
def rejects(*errors)
  begin
    yield
  rescue *errors => error
    $checks += 1
    return error
  end
  raise "Expected #{errors}"
end
def bind(name, arguments = [], result = Fiddle::TYPE_INT)
  Fiddle::Function.new(LIB[name], arguments, result, need_gvl: true)
end
RESET = bind("graph_fixture_reset", [Fiddle::TYPE_INT], Fiddle::TYPE_VOID)
LIVE = bind("graph_fixture_live")
CLEARS = bind("graph_fixture_clears")
CALLS = bind("graph_fixture_calls")
CLEAR = bind("graph_fixture_clear", [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
N.define_singleton_method(:graph_checkpoint) do
  $attempts += 1
  raise $failure, "injected conversion failure" if $attempts == $fail_at
  if $async_phase && CALLS.call == ($async_phase == :input ? 0 : 1)
    $async_phase = nil
    target = Thread.current
    Thread.new { target.raise(Interrupt, "asynchronous conversion interruption") }.join
  end
end
N::GraphScope.prepend(Module.new do
  def allocate(size)
    pointer = super
    $buffers << pointer if pointer
    pointer
  end
end)
def clean
  check($buffers.all?(&:freed?))
  $buffers.clear
  check(LIVE.call == 0)
end
def type(name)
  N::TYPES.find { |node| node.dig("ref", "name") == name || node.dig("ref", "kind") == "named" && node["publicType"] == name } or raise "Missing #{name}"
end
def roundtrip(name, value)
  node = type(name)
  Thread.handle_interrupt(Exception => :never) do
    scope = N::GraphScope.new
    begin
      raw = N.public_send("graph_input#{node.fetch('index')}", value, scope)
      N.public_send("graph_output#{node.fetch('index')}", raw, scope)
    ensure
      scope.close
    end
  end
end
def caller_for(name, symbol = name, lifecycle = nil)
  invoke = bind("graph_fixture_#{symbol}", [Fiddle::TYPE_VOIDP, Fiddle::TYPE_VOIDP])
  ->(value) { N.public_send("graph_call_#{name}", invoke, value, clear: CLEAR, lifecycle: lifecycle) }
end
def payload(**changes)
  fields = {unit: M::UNIT, bool_: true, u8: 255, u16: 65535, u32: 2**32 - 1, u64: 2**64 - 1,
    i8: -128, i16: -32768, i32: -(2**31), i64: -(2**63), natural: 0, integer: -1,
    f32: 1.5, f64: 2.5, text: "abc\0\u{1f33f}", bytes: "\x00\xff".b, char_: "\u{1f33f}",
    word: 2**64 - 1, signed_word: -(2**63)}
  M::Scalars.new(**fields.merge(changes))
end
def tree_value
  M::Tree::Branch.new(children: [M::Tree::Leaf.new(payload: payload), M::Tree::Branch.new(children: [])])
end
def envelope_value(**changes)
  tree = tree_value
  M::Envelope.new(**{tree: tree, alternatives: [[tree], []], fallback: M::Some.new(tree),
    outcome: M::Ok.new([tree, tree]), marker: M::Some.new(M::Some.new(M::UNIT))}.merge(changes))
end

count = bind("graph_fixture_layout_count", [], Fiddle::TYPE_SIZE_T).call
layout = bind("graph_fixture_layout", [Fiddle::TYPE_SIZE_T], Fiddle::TYPE_SIZE_T)
check(count == N::LAYOUT.length)
N::LAYOUT.each_with_index { |expected, index| check(layout.call(index) == expected) }
RESET.call(0)
echo = %w[tree spine marker envelope].to_h { |name| [name, caller_for(name)] }
echo["echo_link"] = caller_for("echo_link", "link")
echo["echo_result_link"] = caller_for("echo_result_link", "result_link")
scalars = caller_for("scalars")
out = scalars.call(payload)
check(out == payload(natural: 2**1000 + 7, integer: -(2**1000 + 7), f32: Float::INFINITY,
  f64: -0.0, text: "a\0\u{1f33f}", bytes: "\x00\xff\x80".b))
check(1.0 / out.f64 == -Float::INFINITY)
check(CLEARS.call == 1)
clean
values = {"tree" => tree_value, "spine" => M::Spine::Next.new(value: M::Spine::Leaf.new(value: 8)),
  "marker" => M::Marker::Next.new(value: M::Marker::Unit.new(value: M::UNIT)), "envelope" => envelope_value,
  "echo_link" => M::Link.new(tail: M::Some.new(M::Link.new(tail: nil))),
  "echo_result_link" => M::ResultLink.new(tail: M::Ok.new(M::ResultLink.new(tail: M::Err.new("end\0"))))}
values.each do |name, value|
  RESET.call(0)
  copied = echo.fetch(name).call(value)
  check(copied == value && !copied.equal?(value))
  check(CLEARS.call == 1)
  check(echo.fetch(name).call(value) == value)
  clean
end
copied = echo.fetch("tree").call(tree_value)
check(!copied.children.frozen?)
original = tree_value
copied = echo.fetch("tree").call(original)
copied.children[0].payload.bytes << "changed"
check(copied != original)
check(original.children[0].payload.bytes == "\x00\xff".b)
fields = (0...255).to_h { |index| ["field#{index}".to_sym, index] }
[["LeftTree", M::LeftTree::Next.new(right: M::RightTree::Many.new(lefts: [M::LeftTree::Leaf.new(value: 8)]))],
 ["RightTree", M::RightTree::Many.new(lefts: [])], ["EmptyRecord", M::EmptyRecord.new],
 ["Marker", M::Marker::Empty.new], ["Marker", M::Marker::Unit.new(value: M::UNIT)],
 ["Wide", M::Wide::Next.new(**fields, child: M::Wide::Leaf.new(value: 7))]].each do |name, value|
  check(roundtrip(name, value) == value)
end
[nil, M::Some.new(nil), M::Some.new(M::Some.new(M::UNIT))].each do |marker|
  [M::Ok.new([tree_value, tree_value]), M::Err.new("error\0")].each do |outcome|
    value = envelope_value(fallback: nil, outcome: outcome, marker: marker)
    check(echo.fetch("envelope").call(value) == value)
  end
end
[0.0, -0.0, Float::INFINITY, -Float::INFINITY, Float::NAN, 1.23456789].each do |value|
  copied = roundtrip("Scalars", payload(f32: value, f64: value))
  check(value.nan? ? copied.f32.nan? : copied.f32 == [value].pack("e").unpack1("e"))
  check(value.nan? ? copied.f64.nan? : copied.f64 == value)
end
[0, 1, 2**1000 + 7, -(2**1000 + 7), -(2**32 - 1)].each { |value| check(roundtrip("int", value) == value) }
[false, true].each do |signed|
  [8, 16, 32, 64].each do |bits|
    name = "#{signed ? 'int' : 'uint'}#{bits}"
    low, high = signed ? [-(2**(bits - 1)), 2**(bits - 1) - 1] : [0, 2**bits - 1]
    [low, 0, 1, high].each { |value| check(roundtrip(name, value) == value) }
    [low - 1, high + 1].each { |value| rejects(RangeError) { roundtrip(name, value) } }
  end
end
["\0", "a", "\u00e9", "\u{1f33f}", "\u{10ffff}"].each { |value| check(roundtrip("char", value) == value) }
[false, true].each { |value| check(roundtrip("bool", value).equal?(value)) }
check(roundtrip("unit", M::UNIT).equal?(M::UNIT))
check(roundtrip("string", "") == "")
check(roundtrip("bytes", "") == "".b)
clean

bad = [["unit", nil], ["bool", 1], ["char", ""], ["char", "ab"], ["char", "\xed\xa0\x80"],
  ["uint8", 256], ["uint16", -1], ["uint32", 1.0], ["uint64", 2**64], ["int8", -129],
  ["int16", 32768], ["int32", true], ["int64", 2**63], ["usize", -1], ["isize", 2**63],
  ["nat", -1], ["int", true], ["float32", 1], ["float64", "1"], ["string", "\xff"],
  ["bytes", []], ["Scalars", {}], ["Tree", Object.new], ["Never", Object.new]]
bad.each { |name, value| rejects(TypeError, RangeError, EncodingError, ArgumentError) { roundtrip(name, value) } }
$attempts = 0
initialized = []
reject_invoke = ->(*) { raise "Native call reached" }
lifecycle = [-> { initialized << true; 0 }, -> { 1 }, -> { raise "Unexpected retirement" }]
rejects(TypeError) do
  N.graph_call_join_trees(reject_invoke, tree_value, M::Tree::Leaf.new(payload: payload(u32: true)), clear: CLEAR, lifecycle: lifecycle)
end
check(initialized.empty? && $attempts == 0)
cycle = M::Spine::Next.allocate
cycle.instance_variable_set(:@value, cycle)
cycle.freeze
rejects(ArgumentError) { echo.fetch("spine").call(cycle) }
children = []
cycle = M::Tree::Branch.new(children: children)
children << cycle
rejects(ArgumentError) { echo.fetch("tree").call(cycle) }
deep = M::Spine::Leaf.new(value: 0)
128.times { deep = M::Spine::Next.new(value: deep) }
rejects(N::GraphLimit) { echo.fetch("spine").call(deep) }
rejects(N::GraphLimit) { echo.fetch("tree").call(M::Tree::Branch.new(children: [M::Tree::Branch.new(children: [])] * 262_144)) }
rejects(N::GraphLimit) { scalars.call(payload(text: "x" * (16 * 1024 * 1024))) }
RESET.call(0)
rejects(N::GraphLimit) { echo.fetch("tree").call(M::Tree::Leaf.new(payload: payload(bytes: "x" * (6 * 1024 * 1024)))) }
check(CALLS.call == 1 && CLEARS.call == 1)
clean

# Each budget applies to the whole conversion, including the output.
[["@storage", 1], ["@nodes", 1], ["@native", 1]].each do |field, limit|
  scope = N::GraphScope.new
  begin
    scope.instance_variable_set(field, limit)
    rejects(N::GraphLimit) { N.public_send("graph_input#{type('Tree').fetch('index')}", tree_value, scope) }
  ensure
    scope.close
  end
end
scope = N::GraphScope.new
begin
  node = type("Scalars")
  raw = N.public_send("graph_input#{node.fetch('index')}", payload, scope)
  scope.instance_variable_set(:@native, node.fetch("size"))
  rejects(N::GraphLimit) { N.public_send("graph_output#{node.fetch('index')}", raw, scope) }
  never = type("Never")
  raw_never = scope.allocate(never.fetch("size"))
  scope.instance_variable_set(:@native, 16 * 1024 * 1024)
  rejects(N::GraphInvalidNative) { N.public_send("graph_output#{never.fetch('index')}", raw_never, scope) }
ensure
  scope.close
end
clean

# Captured operations ignore hostile instance methods on otherwise exact values.
text = +"valid\0"
def text.bytesize; 0; end
def text.byteslice(*); raise "Overridden byteslice"; end
def text.valid_encoding?; false; end
check(roundtrip("string", text) == "valid\0")
array = [M::Tree::Branch.new(children: [])]
def array.length; 0; end
def array.[](*); raise "Overridden array access"; end
value = M::Tree::Branch.new(children: array)
check(echo.fetch("tree").call(value).children.length == 1)
stored = payload.dup
def stored.u32; raise "Overridden record accessor"; end
check(roundtrip("Scalars", stored).u32 == 2**32 - 1)
subclass = Class.new(M::Scalars)
rejects(TypeError) { roundtrip("Scalars", subclass.new(**payload.deconstruct_keys(nil))) }
clean

retired = 0
lifecycle = [-> { 0 }, -> { 1 }, -> { retired += 1 }]
corrupt = caller_for("scalars", "scalars", lifecycle)
[2, 3, 4, 5, 6, 7, 8].each do |mode|
  RESET.call(mode)
  error = rejects(N::GraphInvalidNative) { corrupt.call(payload) }
  check(error.status == 4 && CLEARS.call == 1)
  clean
end
check(retired == 7)
RESET.call(0)
rejects(N::GraphInvalidNative) { caller_for("tree", "bad_tree", lifecycle).call(tree_value) }
check(retired == 8 && CLEARS.call == 1)
clean
RESET.call(9)
rejects(N::GraphLimit) { corrupt.call(payload) }
check(retired == 8 && CLEARS.call == 1)
clean
[12, 13].each do |mode|
  RESET.call(mode)
  rejects(N::GraphInvalidNative) { echo.fetch("envelope").call(envelope_value) }
  check(CLEARS.call == 1)
  clean
end
[1, 2, 3, 4, 5, 99].each do |status|
  RESET.call(100 + status)
  error = rejects(M::LeanBridgeError) { corrupt.call(payload) }
  check(error.status == ([1, 2, 3, 5].include?(status) ? status : 4))
  check(CLEARS.call == 1)
  clean
end
[[0, 1, 1, 1], [1, 1, 4, 4], [2**64 - 8, 3, 4, 4], [8, 2**63, 1, 1]].each do |arguments|
  rejects(N::GraphInvalidNative) { N.graph_span(*arguments) }
end
check(N.graph_span(1, 0, 4, 4) == 0)
scope = N::GraphScope.new
begin
  node = type("Spine")
  raw = N.public_send("graph_input#{node.fetch('index')}", M::Spine::Next.new(value: M::Spine::Leaf.new(value: 3)), scope)
  offset = node.fetch("payloadOffset") + node.fetch("cases")[0].fetch("fields")[0].fetch("offset")
  raw[offset, 8] = [raw.to_i].pack("Q<")
  rejects(N::GraphInvalidNative) { N.public_send("graph_output#{node.fetch('index')}", raw, scope) }
  raw[offset, 8] = [0].pack("Q<")
  rejects(N::GraphInvalidNative) { N.public_send("graph_output#{node.fetch('index')}", raw, scope) }
ensure
  scope.close
end
clean

# Fail every explicit allocation/output checkpoint with both failure families.
checkpoints = 0
input_failures = 0
output_failures = 0
failures = values.merge("scalars" => payload)
failures.each do |name, value|
  invoke = name == "scalars" ? scalars : echo.fetch(name)
  RESET.call(0)
  $attempts = 0
  invoke.call(value)
  count_for_value = $attempts
  checkpoints += count_for_value
  clean
  [NoMemoryError, Interrupt].each do |failure|
    (1..count_for_value).each do |index|
      RESET.call(0)
      $attempts = 0
      $fail_at = index
      $failure = failure
      rejects(failure) { invoke.call(value) }
      if CALLS.call == 0
        input_failures += 1
        check(CLEARS.call == 0)
      else
        output_failures += 1
        check(CALLS.call == 1 && CLEARS.call == 1)
      end
      $fail_at = nil
      clean
    end
  end
end
[:input, :output].each do |phase|
  RESET.call(0)
  $async_phase = phase
  rejects(Interrupt) { echo.fetch("tree").call(tree_value) }
  check($async_phase.nil? && CALLS.call == 1 && CLEARS.call == 1)
  clean
end
RESET.call(0)
rejects(M::LeanBridgeError) { caller_for("tree", "tree", [-> { 0 }, -> { 0 }, -> {}]).call(tree_value) }
check(CLEARS.call == 1)
clean
puts JSON.generate({ruby: RUBY_VERSION, checks: $checks, layoutChecks: count,
  checkpoints: checkpoints, inputFailures: input_failures, outputFailures: output_failures})
