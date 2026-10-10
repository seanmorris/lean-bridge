require "lean_bridge/finproducts"
API = LeanBridge::Finproducts
Some = API::Some
Ok = API::Ok
Err = API::Err
$checks = 0
def check(value, label)
  raise "failed: #{label}" unless value
  $checks += 1
end
def rejected(parameter, bound)
  yield
  false
rescue RangeError => error
  error.message == "#{parameter} is not below its Fin #{bound} bound"
end
wide = 10 * 2**64 + 10
# Fin 10 × Nat: only the first component is bounded.
10.times { |d| check(API.first([d, 1000]) == [9 - d, 1001], "first #{d}") }
check(rejected("arg0", "10") { API.first([10, 0]) }, "first at bound")
check(rejected("arg0", "10") { API.first([2**70, 0]) }, "first beyond 64 bits")
check(API.first([3, 2**200]) == [6, 2**200 + 1], "unbounded component")
# Nat × Fin 1, and a bound wider than 64 bits beside Fin 10.
check(API.second([41, 0]) == 41, "second valid")
check(rejected("arg0", "1") { API.second([41, 1]) }, "second at bound")
check(API.wide([wide - 1, 9]) == wide + 8, "wide valid")
check(rejected("arg0", wide.to_s) { API.wide([wide, 9]) }, "wide at bound")
check(rejected("arg0", "10") { API.wide([wide - 1, 10]) }, "wide second at bound")
# Option (Fin 0 × Nat): only none is valid.
check(API.absent_only(nil) == 7, "absent only none")
check(rejected("arg0", "0") { API.absent_only(Some.new([0, 0])) }, "absent only some")
# Except String (Fin 10): the ok branch is bounded; an inactive branch is never read.
check(API.ok_only(Ok.new(9)) == 9, "ok valid")
check(rejected("arg0", "10") { API.ok_only(Ok.new(10)) }, "ok at bound")
check(API.ok_only(Err.new("four")) == 104, "inactive ok")
# Except (Fin 5) Nat: the error branch is bounded; any ok Nat is valid.
check(API.error_only(Ok.new(2**100)) == 2**100, "unbounded ok")
check(API.error_only(Err.new(4)) == 104, "error valid")
check(rejected("arg0", "5") { API.error_only(Err.new(5)) }, "error at bound")
# Except (Fin 3) (Fin 7): only the active branch is checked.
check(API.both(Ok.new(6)) == 6, "both ok valid")
check(rejected("arg0", "7") { API.both(Ok.new(7)) }, "both ok at bound")
check(API.both(Err.new(2)) == 102, "both error valid")
check(rejected("arg0", "3") { API.both(Err.new(3)) }, "both error at bound")
# List (Option (Fin 3 × Except (Fin 2) Nat)): every present element, both levels.
rows = ->(a, b) { [nil, Some.new([a, Ok.new(50)]), Some.new([1, Err.new(b)])] }
check(API.nested(rows.(2, 1)) == 54, "nested valid")
check(rejected("arg0", "2") { API.nested(rows.(2, 2)) }, "nested branch")
check(rejected("arg0", "3") { API.nested(rows.(3, 1)) }, "nested component")
check(API.nested(rows.(2, 1)) == 54, "nested recovery")
# DigitPair := Digit × Digit through the alias.
check(API.aliased([1, 9]) == [9, 1], "aliased valid")
check(rejected("arg0", "10") { API.aliased([1, 10]) }, "aliased at bound")
# Results carrying bounds are produced by Lean and arrive below them.
produced = API.produce(4)
check(produced.instance_of?(Err) && produced.value == 4, "produce error")
check(API.produce(23).instance_of?(Ok), "produce ok")
check(API.pair_up(23) == [3, 23], "pair up")
1000.times do |i|
  raise "round #{i} failed" unless API.first([i % 10, i])[0] == 9 - i % 10
  raise "rejection round #{i} failed" unless rejected("arg0", "10") { API.first([10 + i, i]) }
end
$checks += 2000
puts "fin-product-ok:#{$checks}"
