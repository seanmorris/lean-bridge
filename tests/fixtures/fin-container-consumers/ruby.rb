require "lean_bridge/fincontainers"
API = LeanBridge::Fincontainers
Some = API::Some
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
def raises(kind)
  yield
  false
rescue kind
  true
end
huge = 2**70
word = 2**32
digits = (0..9).to_a
# Array (Fin 10): every element is checked; results stay below the bound.
check(API.mirror_all(digits) == digits.reverse, "mirror endpoints")
check(API.mirror_all([]) == [], "empty array")
3.times do |position|
  bad = [1, 2, 3]
  bad[position] = 10
  check(rejected("arg0", "10") { API.mirror_all(bad) }, "invalid element at #{position}")
  check(bad[position] == 10, "input unchanged")
end
check(rejected("arg0", "10") { API.mirror_all([word, 1, 2]) }, "word element")
check(raises(RangeError) { API.mirror_all([-1, 1]) } && !rejected("arg0", "10") { API.mirror_all([-1, 1]) }, "negative is the Nat error")
check(raises(TypeError) { API.mirror_all([1.5]) } && raises(TypeError) { API.mirror_all(3) }, "non-Integer elements are TypeError")
# Array (Fin 0): only the empty array has values.
check(API.count_none([]) == 0, "Fin 0 empty")
check(rejected("arg0", "0") { API.count_none([0]) }, "Fin 0 present")
# List Huge: a 2^70 bound compared limb by limb.
check(API.sum_huge([word, huge - 1]) == word + huge - 1 && API.sum_huge([]) == 0, "huge sums")
check(rejected("arg0", huge.to_s) { API.sum_huge([word, huge]) }, "huge bound")
# Option (Fin 1): none is valid; a present value is checked.
check(API.or_default(nil) == 7 && API.or_default(Some.new(0)) == 0, "option values")
check(rejected("arg0", "1") { API.or_default(Some.new(1)) }, "present Fin 1")
# Array (Option Digit): only present elements are checked.
check(API.present([Some.new(1), nil, Some.new(9)]) == [1, 9], "present digits")
check(rejected("arg0", "10") { API.present([Some.new(1), nil, Some.new(10)]) }, "present invalid")
check(API.present([Some.new(1), nil, nil]) == [1], "absent is never read")
# List (Array Digit) -> Option (List Digit): nested rows.
check(API.flatten([[1, 2], [3]]) == Some.new([1, 2, 3]) && API.flatten([]).nil?, "flatten rows")
check(rejected("arg0", "10") { API.flatten([[1, 2], [10]]) }, "nested invalid last")
# A late refined argument after an unrefined one.
names = %w[a b]
check(API.label(names, [1, 3]) == "a:1,b:3", "label")
check(rejected("arg1", "4") { API.label(names, [1, 4]) } && names == %w[a b], "late argument, caller data unchanged")
# A result-only container refinement projects each element after Lean returns.
check(API.wrap_all([100, huge]) == [2, 2] && API.wrap_all([]) == [], "wrapped results")
1000.times do |i|
  raise "invalid call accepted at #{i}" unless rejected("arg0", "10") { API.mirror_all([10 + i % 5]) }
  raise "valid call failed at #{i}" unless API.mirror_all([i % 10]) == [9 - i % 10]
end
$checks += 2000
puts "fin-container-ok:#{$checks}"
