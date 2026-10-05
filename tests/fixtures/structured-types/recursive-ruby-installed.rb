# frozen_string_literal: true
require "json"
require "lean_bridge/recursive"
M = LeanBridge::Recursive
$checks = 0
$rejected = 0
def check(value)
  raise "Installed Ruby graph assertion #{$checks + 1}" unless value
  $checks += 1
end
def rejects(error)
  begin
    yield
  rescue error
    $rejected += 1
    return
  end
  raise "Expected #{error}"
end
def payload(**changes)
  M::Scalars.new(**{unit: M::UNIT, bool_: true, u8: 255, u16: 65535, u32: 2**32 - 1, u64: 2**64 - 1,
    i8: -128, i16: -32768, i32: -(2**31), i64: -(2**63), natural: 2**128 + 1, integer: -(2**128 + 1),
    f32: 1.5, f64: -2.25, text: "A\0\u{1f331}", bytes: "\x00\xff\x01".b,
    char_: "\u{1f331}", word: 2**32 - 1, signed_word: -(2**31)}.merge(changes))
end
tree = M::Tree::Branch.new(children: [M::Tree::Leaf.new(payload: payload), M::Tree::Branch.new(children: [])])
check(M.inspect(payload))
check(M.scalars(payload) == payload)
check(M.word_max(2**64 - 1))
check(M.signed_min(-(2**63)))
[payload(natural: 2**1000 + 7, integer: -(2**1000 + 7)), payload(natural: 0, integer: 0, text: "", bytes: "".b),
 payload(f32: -Float::INFINITY, f64: Float::INFINITY)].each { |value| check(M.scalars(value) == value) }
special = M.scalars(payload(f32: Float::NAN, f64: -0.0))
check(special.f32.nan? && 1.0 / special.f64 == -Float::INFINITY)
check(M.tree(tree) == tree)
check(M.empty == M::Tree::Branch.new(children: []))
check(M.join_trees(tree, tree) == M::Tree::Branch.new(children: [tree, tree]))
check(M.forest([tree] * 512) == [tree] * 512)
mutable = [M::Tree::Branch.new(children: [])]
copied = M.tree(M::Tree::Branch.new(children: mutable))
mutable[0].children << M::Tree::Leaf.new(payload: payload)
check(copied == M::Tree::Branch.new(children: [M::Tree::Branch.new(children: [])]))
[nil, M::Some.new(nil), M::Some.new(M::Some.new(M::UNIT))].each do |marker|
  [M::Ok.new([tree, tree]), M::Err.new("error\0\u{1f331}")].each do |outcome|
    value = M::Envelope.new(tree: tree, alternatives: [[], [tree]], fallback: nil, outcome: outcome, marker: marker)
    check(M.envelope(value) == value)
  end
end
left = M::LeftTree::Next.new(right: M::RightTree::Many.new(lefts: [M::LeftTree::Leaf.new(value: 9)]))
check(M.left(left) == left)
check(M.right(M::RightTree::Many.new(lefts: [left])) == M::RightTree::Many.new(lefts: [left]))
spine = M::Spine::Leaf.new(value: 41)
127.times { spine = M::Spine::Next.new(value: spine) }
copy = M.spine(spine)
a, b = spine, copy
127.times do
  check(!a.equal?(b))
  a, b = a.value, b.value
end
check(a.value == 41 && b.value == 41)
rejects(M::LeanBridgeError) { M.grow(spine) }
check(M.grow(M::Spine::Leaf.new(value: 7)) == M::Spine::Next.new(value: M::Spine::Leaf.new(value: 7)))
wide = M::Wide::Next.new(**(0...255).to_h { |index| ["field#{index}".to_sym, index] }, child: M::Wide::Leaf.new(value: 17))
check(M.wide(wide) == wide)
[M::Marker::Empty.new, M::Marker::Unit.new(value: M::UNIT), M::Marker::Next.new(value: M::Marker::Empty.new)].each do |value|
  check(M.marker(value) == value)
end
check(M.empty_record(M::EmptyRecord.new) == M::EmptyRecord.new)
check(M.units([M::UNIT] * 123) == [M::UNIT] * 123)
rejects(ArgumentError) { M.never(Object.new) }
rejects(RangeError) { M.spine(M::Spine::Next.new(value: spine)) }
{u8: [0, 255], u16: [0, 65535], u32: [0, 2**32 - 1], u64: [0, 2**64 - 1],
 i8: [-128, 127], i16: [-32768, 32767], i32: [-(2**31), 2**31 - 1], i64: [-(2**63), 2**63 - 1],
 word: [0, 2**64 - 1], signed_word: [-(2**63), 2**63 - 1]}.each do |name, (minimum, maximum)|
  [minimum, maximum].each { |value| check(M.scalars(payload(**{name => value})).public_send(name) == value) }
  [minimum - 1, maximum + 1].each { |value| rejects(RangeError) { M.scalars(payload(**{name => value})) } }
  [nil, true, 1.0].each { |value| rejects(TypeError) { M.scalars(payload(**{name => value})) } }
end
rejects(RangeError) { M.scalars(payload(natural: -1)) }
rejects(TypeError) { M.scalars(payload(unit: nil)) }
rejects(TypeError) { M.scalars(payload(bool_: 1)) }
rejects(TypeError) { M.scalars(payload(f32: 1)) }
rejects(TypeError) { M.scalars(payload(f64: 1)) }
rejects(EncodingError) { M.scalars(payload(text: "\xff".dup.force_encoding(Encoding::UTF_8))) }
rejects(EncodingError) { M.scalars(payload(text: "hello".encode(Encoding::UTF_16LE))) }
rejects(RangeError) { M.scalars(payload(char_: "ab")) }
rejects(TypeError) { M.tree(Class.new(M::Tree::Leaf).new(payload: payload)) }
rejects(TypeError) { M.forest(Class.new(Array).new) }
rejects(TypeError) { M.join_trees(tree, M::Tree::Leaf.new(payload: payload(u32: true))) }
cycle = []
cyclic = M::Tree::Branch.new(children: cycle)
cycle << cyclic
rejects(ArgumentError) { M.tree(cyclic) }
pattern = M.grow(M::Spine::Leaf.new(value: 7))
case pattern
in M::Spine::Next[value: M::Spine::Leaf[value: 7]] then check(true)
else raise "Recursive Ruby pattern mismatch"
end
copies = 4.times.map { Thread.new { 64.times.map { M.tree(tree) } } }.flat_map(&:value)
check(copies.length == 256 && copies.all? { |value| value == tree && !value.equal?(tree) })
GC.start
GC.compact
check(M.tree(tree) == tree)
puts JSON.generate({checks: $checks, rejected: $rejected, functions: 18, threadedCalls: copies.length, ruby: RUBY_VERSION})
