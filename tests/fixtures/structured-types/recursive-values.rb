# frozen_string_literal: true
require "json"
require_relative "recursive"
require_relative "linked"
require_relative "deep"

M = LeanBridge::Recursive
L = LeanBridge::Linked
$checks = 0
def check(value)
  raise "Ruby recursive value assertion #{$checks + 1}" unless value
  $checks += 1
end
def rejects(error)
  begin
    yield
  rescue error
    $checks += 1
    return
  end
  raise "Expected #{error}"
end

leaf = M::Spine::Leaf.new(value: 42)
tree = M::Spine::Next.new(value: M::Spine::Next.new(value: leaf))
same = M::Spine::Next.new(value: M::Spine::Next.new(value: M::Spine::Leaf.new(value: 42)))
check(tree == same)
check(tree.eql?(same))
check(tree.hash == same.hash)
check(!tree.equal?(same))
check({tree => :found}[same] == :found)
check(tree != leaf)
check(tree != nil)
check(tree != BasicObject.new)
check(tree.frozen? && leaf.frozen?)
rejects(FrozenError) { tree.instance_variable_set(:@value, leaf) }
rejects(NoMethodError) { M::Spine.new }
rejects(ArgumentError) { M::Spine::Leaf.new }
rejects(ArgumentError) { M::Spine::Leaf.new(42) }
rejects(ArgumentError) { M::Spine::Leaf.new(value: 42, unknown: true) }
case tree
in M::Spine::Next[value: M::Spine::Next[value: M::Spine::Leaf[value: 42]]]
  check(true)
else
  raise "Recursive pattern failed"
end
check(tree.deconstruct_keys(nil) == {value: tree.value})
check(M::Spine::Leaf.new(value: 1) == M::Spine::Leaf.new(value: 1.0))
check(!M::Spine::Leaf.new(value: 1).eql?(M::Spine::Leaf.new(value: 1.0)))
check(M::Spine::Leaf.new(value: Float::NAN) != M::Spine::Leaf.new(value: Float::NAN))

subclass = Class.new(M::Spine::Leaf)
check(leaf != subclass.new(value: 42))
subclass.class_eval do
  def class; M::Spine::Leaf; end
  def instance_variable_get(_name); 42; end
end
check(leaf != subclass.new(value: 42))
check(subclass.new(value: 42) != leaf)
spoof = Object.new
def spoof.instance_of?(_type); true; end
def spoof.instance_variable_get(_name); 42; end
check(leaf != spoof)

empty = M::Marker::Empty.new
unit = M::Marker::Unit.new(value: M::UNIT)
check(empty != unit)
check(empty == M::Marker::Empty.new)
check(empty.deconstruct_keys(nil).empty?)
check(unit.deconstruct_keys(nil) == {value: M::UNIT})
check(M::UNIT.frozen?)
check(!M::UNIT.equal?(nil))
check(M::Some.new(nil) != nil)
check(M::Some.new(nil) != M::Some.new(M::UNIT))
check(M::Some.new(M::UNIT).frozen?)
check(M::Some.new(M::Some.new(nil)).value.value.nil?)
check(M::Ok.new(leaf) != M::Err.new(leaf))
check(M::Ok.new(leaf) == M::Ok.new(M::Spine::Leaf.new(value: 42)))
check(M::Err.new("failed").frozen?)
rejects(FrozenError) { M::Some.new(nil).instance_variable_set(:@value, M::UNIT) }
case M::Some.new(M::UNIT)
in M::Some[value: ^(M::UNIT)]
  check(true)
else
  raise "Unit option match failed"
end
check(M::EmptyRecord.new == M::EmptyRecord.new)
check(M::EmptyRecord.new.frozen?)
check(M::EmptyRecord.new.deconstruct_keys(nil) == {})
rejects(NoMethodError) { M::Never.new }
check(M::Never::Again < M::Never)

left = M::LeftTree::Next.new(right: M::RightTree::Many.new(lefts: [M::LeftTree::Leaf.new(value: 9)]))
check(left.right.lefts[0].value == 9)
check(left == M::LeftTree::Next.new(right: M::RightTree::Many.new(lefts: [M::LeftTree::Leaf.new(value: 9)])))
link = L::Link.new(tail: L::Some.new(L::Link.new(tail: nil, value: 2)), value: 1)
check(link.tail.value.value == 2)
check(link.frozen? && link.tail.frozen? && link.tail.value.frozen?)
check(link != L::Link.new(tail: nil, value: 1))

scalars = M::Scalars.new(unit: M::UNIT, bool_: true, u8: 255, u16: 65535, u32: 2**32 - 1,
  u64: 2**64 - 1, i8: -128, i16: -32768, i32: -(2**31), i64: -(2**63),
  natural: 2**1000, integer: -(2**1000), f32: 1.5, f64: -0.0,
  text: "lambda \u03bb\0", bytes: "\x00\xff".b, char_: "\u{1f642}", word: 2**64 - 1,
  signed_word: -(2**63))
check(scalars.deconstruct_keys(nil).length == 19)
check(scalars.natural == 2**1000 && scalars.integer == -(2**1000))
check(scalars.bytes.encoding == Encoding::BINARY)
check(scalars.text.include?("\0"))
check(scalars.char_.codepoints == [0x1f642])
check(1.0 / scalars.f64 == -Float::INFINITY)
forest = [M::Tree::Leaf.new(payload: scalars), M::Tree::Branch.new(children: [])]
envelope = M::Envelope.new(tree: forest[0], alternatives: [forest, []], fallback: M::Some.new(forest[0]),
  outcome: M::Ok.new([forest[0], forest[1]]), marker: M::Some.new(M::Some.new(M::UNIT)))
check(envelope.frozen?)
check(envelope.alternatives[0][0].payload.equal?(scalars))
check(envelope.outcome.value[1].children.empty?)
check(envelope.marker.value.value.equal?(M::UNIT))
check(!forest.frozen?)
copy = Marshal.load(Marshal.dump(tree))
check(copy == tree && !copy.equal?(tree) && !copy.value.equal?(tree.value))

fields = (0...255).to_h { |index| ["field#{index}".to_sym, index] }
wide = M::Wide::Next.new(**fields, child: M::Wide::Leaf.new(value: 42))
check(wide.field254 == 254)
check(wide.child.value == 42)
check(wide.deconstruct_keys(nil).length == 256)
check(wide == M::Wide::Next.new(**fields, child: M::Wide::Leaf.new(value: 42)))
check(wide.frozen?)
check(!M.const_defined?(:Forest, false))
check(!M.const_defined?(:TreeAlias, false))
check(LeanBridge::Deep.constants(false) == [:UNIT])
check(!M.constants(false).include?(:GraphValues))
rejects(NameError) { M::GraphValues }
puts JSON.generate({ruby: RUBY_VERSION, checks: $checks, wideFields: 256,
  aliasConstants: LeanBridge::Deep.constants(false).grep(/^Alias/).length})
