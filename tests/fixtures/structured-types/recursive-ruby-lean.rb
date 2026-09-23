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
def check(value)
  raise "Lean graph assertion #{$checks + 1}" unless value
  $checks += 1
end
def rejects(error, status = nil)
  begin
    yield
  rescue error => caught
    check(status.nil? || caught.status == status)
    return
  end
  raise "Expected #{error}"
end
def bind(name, parameters = [], result = Fiddle::TYPE_SIZE_T)
  Fiddle::Function.new(LIB[name], parameters, result, need_gvl: true)
end
RESET = bind("ruby_native_reset", [Fiddle::TYPE_SIZE_T, Fiddle::TYPE_SIZE_T], Fiddle::TYPE_VOID)
LIVE = bind("ruby_native_live")
ATTEMPTS = bind("ruby_native_attempts")
DECODES = bind("ruby_native_decodes")
INITIALIZE = bind("ruby_native_initialize", [], Fiddle::TYPE_INT)
READY = bind("ruby_native_ready", [], Fiddle::TYPE_INT)
RETIRE = bind("ruby_native_retire", [], Fiddle::TYPE_VOID)
CLEAR = bind("ruby_native_clear", [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
HOLD = bind("ruby_native_hold", [], Fiddle::TYPE_INT)
RELEASE = bind("ruby_native_release", [], Fiddle::TYPE_VOID)
DETACH = bind("ruby_native_detach", [], Fiddle::TYPE_VOID)
LIFECYCLE = [INITIALIZE, READY, RETIRE].freeze
N.define_singleton_method(:graph_checkpoint) do
  $attempts += 1
  raise $failure, "injected conversion failure" if $attempts == $fail_at
end
N::GraphScope.prepend(Module.new do
  def allocate(size)
    pointer = super
    $buffers << pointer if pointer
    pointer
  end
end)
def clean(retained = 0)
  check($buffers.all?(&:freed?))
  $buffers.clear
  check(LIVE.call == retained)
end
def payload(**changes)
  M::Scalars.new(**{unit: M::UNIT, bool_: true, u8: 255, u16: 65535, u32: 2**32 - 1, u64: 2**64 - 1,
    i8: -128, i16: -32768, i32: -(2**31), i64: -(2**63), natural: 2**128 + 1, integer: -(2**128 + 1),
    f32: 1.5, f64: -2.25, text: "A\0\u{1f331}", bytes: "\x00\xff\x01".b,
    char_: "\u{1f331}", word: 2**32 - 1, signed_word: -(2**31)}.merge(changes))
end
def tree_value
  M::Tree::Branch.new(children: [M::Tree::Leaf.new(payload: payload), M::Tree::Branch.new(children: [])])
end
def envelope_value(**changes)
  tree = tree_value
  M::Envelope.new(**{tree: tree, alternatives: [[], [tree]], fallback: M::Some.new(tree),
    outcome: M::Ok.new([tree, tree]), marker: M::Some.new(M::Some.new(M::UNIT))}.merge(changes))
end
functions = N::ROOTS.to_h do |root|
  name = root.fetch("name").delete_prefix("recursive_")
  invoke = bind("#{root.fetch('name')}_graph", [Fiddle::TYPE_VOIDP] * (root.fetch("parameters").length + 1), Fiddle::TYPE_INT)
  [name, ->(*arguments) { N.public_send("graph_call_#{name}", invoke, *arguments, clear: CLEAR, lifecycle: LIFECYCLE) }]
end
RESET.call(0, 0)
check(READY.call == 0)
too_deep = M::Spine::Leaf.new(value: 0)
128.times { too_deep = M::Spine::Next.new(value: too_deep) }
rejects(N::GraphLimit) { functions.fetch("spine").call(too_deep) }
rejects(TypeError) { functions.fetch("join_trees").call(tree_value, M::Tree::Leaf.new(payload: payload(u32: true))) }
check(READY.call == 0 && DECODES.call == 0 && $attempts == 0)
clean
check(functions.fetch("inspect").call(payload))
check(functions.fetch("scalars").call(payload) == payload)
check(functions.fetch("word_max").call(2**64 - 1))
check(functions.fetch("signed_min").call(-(2**63)))
[payload(natural: 2**1000 + 7, integer: -(2**1000 + 7)), payload(natural: 0, integer: 0, text: "", bytes: "".b),
 payload(f32: -Float::INFINITY, f64: Float::INFINITY)].each { |value| check(functions.fetch("scalars").call(value) == value) }
special = functions.fetch("scalars").call(payload(f32: Float::NAN, f64: -0.0))
check(special.f32.nan? && 1.0 / special.f64 == -Float::INFINITY)
tree = tree_value
check(functions.fetch("tree").call(tree) == tree)
check(functions.fetch("empty").call == M::Tree::Branch.new(children: []))
check(functions.fetch("join_trees").call(tree, tree) == M::Tree::Branch.new(children: [tree, tree]))
check(functions.fetch("forest").call([tree] * 512) == [tree] * 512)
mutable = [M::Tree::Branch.new(children: [])]
copied = functions.fetch("tree").call(M::Tree::Branch.new(children: mutable))
mutable[0].children << M::Tree::Leaf.new(payload: payload)
check(copied == M::Tree::Branch.new(children: [M::Tree::Branch.new(children: [])]))
[nil, M::Some.new(nil), M::Some.new(M::Some.new(M::UNIT))].each do |marker|
  [M::Ok.new([tree, tree]), M::Err.new("error\0\u{1f331}")].each do |outcome|
    value = envelope_value(marker: marker, outcome: outcome, fallback: nil)
    check(functions.fetch("envelope").call(value) == value)
  end
end
left = M::LeftTree::Next.new(right: M::RightTree::Many.new(lefts: [M::LeftTree::Leaf.new(value: 9)]))
check(functions.fetch("left").call(left) == left)
check(functions.fetch("right").call(M::RightTree::Many.new(lefts: [left])) == M::RightTree::Many.new(lefts: [left]))
spine = M::Spine::Leaf.new(value: 41)
127.times { spine = M::Spine::Next.new(value: spine) }
copy = functions.fetch("spine").call(spine)
a, b = spine, copy
127.times do
  check(!a.equal?(b))
  a, b = a.value, b.value
end
check(a.value == 41 && b.value == 41)
rejects(M::LeanBridgeError, 2) { functions.fetch("grow").call(spine) }
check(functions.fetch("grow").call(M::Spine::Leaf.new(value: 7)) == M::Spine::Next.new(value: M::Spine::Leaf.new(value: 7)))
wide = M::Wide::Next.new(**(0...255).to_h { |index| ["field#{index}".to_sym, index] }, child: M::Wide::Leaf.new(value: 17))
check(functions.fetch("wide").call(wide) == wide)
[M::Marker::Empty.new, M::Marker::Unit.new(value: M::UNIT), M::Marker::Next.new(value: M::Marker::Empty.new)].each do |value|
  check(functions.fetch("marker").call(value) == value)
end
check(functions.fetch("empty_record").call(M::EmptyRecord.new) == M::EmptyRecord.new)
check(functions.fetch("units").call([M::UNIT] * 123) == [M::UNIT] * 123)
rejects(ArgumentError) { functions.fetch("never").call(Object.new) }
clean

envelope = envelope_value
RESET.call(0, 0)
$attempts = 0
check(functions.fetch("envelope").call(envelope) == envelope)
native_count, ruby_count = ATTEMPTS.call, $attempts
clean
(1..native_count).each do |fail_at|
  RESET.call(fail_at, 0)
  rejects(M::LeanBridgeError, 3) { functions.fetch("envelope").call(envelope) }
  clean
  check(READY.call == 1)
end
input_failures = 0
output_failures = 0
(1..ruby_count).each do |fail_at|
  [NoMemoryError, Interrupt].each do |failure|
    RESET.call(0, 0)
    $attempts = 0
    $fail_at = fail_at
    $failure = failure
    rejects(failure) { functions.fetch("envelope").call(envelope) }
    if failure == NoMemoryError
      if DECODES.call == 0
        input_failures += 1
      else
        output_failures += 1
      end
    end
    $fail_at = nil
    clean
    check(READY.call == 1)
  end
end
check(input_failures > 0 && output_failures > 0)
RESET.call(0, 0)
check(functions.fetch("envelope").call(envelope) == envelope)
clean

check(HOLD.call == 0)
retained = LIVE.call
check(retained > 0)
mode = ARGV.fetch(1)
if mode == "carrier"
  RESET.call(0, 1)
  rejects(N::GraphInvalidNative, 4) { functions.fetch("tree").call(tree) }
else
  invoke = bind("recursive_tree_graph", [Fiddle::TYPE_VOIDP, Fiddle::TYPE_VOIDP], Fiddle::TYPE_INT)
  corrupt = ->(input, output) do
    status = invoke.call(input, output)
    if mode == "raw"
      output[16, 4] = [2**32 - 1].pack("L<")
    elsif mode == "during"
      RETIRE.call
    else
      raise "Unknown retirement scenario"
    end
    status
  end
  rejects(M::LeanBridgeError, mode == "raw" ? 4 : 5) { N.graph_call_tree(corrupt, tree, clear: CLEAR, lifecycle: LIFECYCLE) }
end
check(READY.call == 0)
clean(retained)
RESET.call(0, 0)
rejects(M::LeanBridgeError, 5) { functions.fetch("envelope").call(envelope) }
check(DECODES.call == 0)
clean(retained)
RELEASE.call
RELEASE.call
DETACH.call
clean
puts JSON.generate({checks: $checks, nativeCheckpoints: native_count, rubyCheckpoints: ruby_count,
  inputFailures: input_failures, outputFailures: output_failures, ruby: RUBY_VERSION})
