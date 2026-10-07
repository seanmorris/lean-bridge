require "lean_bridge/genericrecords"
API = LeanBridge::Genericrecords
$checks = 0
def check(value)
  raise "Generic record mismatch at #{caller(1, 1).first}" unless value
  $checks += 1
end
def rejected
  yield
  false
rescue TypeError, RangeError, ArgumentError
  true
end
def nat_box(value, count) = API::NatBox.new(value: value, count: count)
# Each alias is its own frozen class with the structure's fields instantiated; Nat fields are exact integers.
box = nat_box(4, 1)
bumped = API.bump(box)
check(bumped.instance_of?(API::NatBox) && bumped.value == 5 && bumped.count == 2 && box.value == 4 && bumped.frozen?)
again = API.again(API::NatBoxAgain.new(value: 4, count: 1))
check(again.instance_of?(API::NatBoxAgain) && again.value == 8 && again.count == 1)
# Two aliases of one application are two distinct classes with the same layout; each call checks the exact class.
check(API::NatBox != API::NatBoxAgain)
check(rejected { API.bump(API::NatBoxAgain.new(value: 1, count: 2)) })
check(rejected { API.again(nat_box(1, 2)) })
greeting = "héllo \u{1F642}"
shouted = API.shout(API::TextBox.new(value: greeting, count: 3))
check(shouted.value == "#{greeting}!" && shouted.count == 3)
swapped = API.swap_named(API::WordPair.new(first: "a", second: 1))
check(swapped.first == "a!" && swapped.second == 2)
# A parameter instantiated with Option Nat and a List of a named instantiation.
check(API.or_zero(API::MaybeBox.new(value: API::Some.new(5), count: 2)) == 7)
check(API.or_zero(API::MaybeBox.new(value: nil, count: 2)) == 2)
boxes = [nat_box(1, 0), nat_box(2, 0), nat_box(2**70, 0)]
check(API.total(boxes) == 2**70 + 3 && API.total([]) == 0)
first = API.first_boxes(2)
check(first.instance_of?(API::Some) && first.value.length == 2 && first.value[1].value == 1 && first.value[1].count == 2)
check(API.first_boxes(0).nil?)
# A pair of two named instantiations.
check(API.unpair(API::BoxPair.new(first: nat_box(3, 0), second: API::TextBox.new(value: "abcd", count: 0))) == 7)
# A universe-polymorphic structure instantiated at Type.
retagged = API.retag(API::TaggedNat.new(tag: "t", payload: 1))
check(retagged.tag == "t#" && retagged.payload == 2)
# A phantom argument: the instantiation names Marker, which no field carries.
check(API.relabel(API::MarkerTag.new(label: "m")).label == "m?")
# Field and shape checks stay exact: wrong field types, wrong records and missing fields are refused.
check(rejected { API.bump(nat_box("4", 1)) })
check(rejected { API.bump(nat_box(-1, 1)) })
check(rejected { API.bump({ value: 4, count: 1 }) })
check(rejected { API.unpair(API::BoxPair.new(first: nat_box(3, 0), second: nat_box(4, 0))) })
check(rejected { API.total([nat_box(1, 0), [1, 0]]) })
check(rejected { API::NatBox.new(value: 1) })
1000.times do |i|
  round = API.bump(nat_box(i, i))
  raise "round #{i} failed" unless round.value == i + 1 && round.count == i + 1
end
$checks += 1000
puts "generic-records-ok:#{$checks}"
