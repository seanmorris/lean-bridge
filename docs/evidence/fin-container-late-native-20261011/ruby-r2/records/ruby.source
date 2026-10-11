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
  check(rejected("arg0[#{position}]", "10") { API.mirror_all(bad) }, "invalid element at #{position}")
  check(bad[position] == 10, "input unchanged")
end
check(rejected("arg0[0]", "10") { API.mirror_all([word, 1, 2]) }, "word element")
check(raises(RangeError) { API.mirror_all([-1, 1]) } && !rejected("arg0[0]", "10") { API.mirror_all([-1, 1]) }, "negative is the Nat error")
check(raises(TypeError) { API.mirror_all([1.5]) } && raises(TypeError) { API.mirror_all(3) }, "non-Integer elements are TypeError")
# Array (Fin 0): only the empty array has values.
check(API.count_none([]) == 0, "Fin 0 empty")
check(rejected("arg0[0]", "0") { API.count_none([0]) }, "Fin 0 present")
# List Huge: a 2^70 bound compared limb by limb.
check(API.sum_huge([word, huge - 1]) == word + huge - 1 && API.sum_huge([]) == 0, "huge sums")
check(rejected("arg0[1]", huge.to_s) { API.sum_huge([word, huge]) }, "huge bound")
# Option (Fin 1): none is valid; a present value is checked.
check(API.or_default(nil) == 7 && API.or_default(Some.new(0)) == 0, "option values")
check(rejected("arg0?", "1") { API.or_default(Some.new(1)) }, "present Fin 1")
# Array (Option Digit): only present elements are checked.
check(API.present([Some.new(1), nil, Some.new(9)]) == [1, 9], "present digits")
check(rejected("arg0[2]?", "10") { API.present([Some.new(1), nil, Some.new(10)]) }, "present invalid")
check(API.present([Some.new(1), nil, nil]) == [1], "absent is never read")
# List (Array Digit) -> Option (List Digit): nested rows.
check(API.flatten([[1, 2], [3]]) == Some.new([1, 2, 3]) && API.flatten([]).nil?, "flatten rows")
check(rejected("arg0[1][0]", "10") { API.flatten([[1, 2], [10]]) }, "nested invalid last")
# A late refined argument after an unrefined one.
names = %w[a b]
check(API.label(names, [1, 3]) == "a:1,b:3", "label")
check(rejected("arg1[1]", "4") { API.label(names, [1, 4]) } && names == %w[a b], "late argument, caller data unchanged")
# A result-only container refinement projects each element after Lean returns.
check(API.wrap_all([100, huge]) == [2, 2] && API.wrap_all([]) == [], "wrapped results")
1000.times do |i|
  raise "invalid call accepted at #{i}" unless rejected("arg0[0]", "10") { API.mirror_all([10 + i % 5]) }
  raise "valid call failed at #{i}" unless API.mirror_all([i % 10]) == [9 - i % 10]
end
$checks += 2000
# VO #1454: the original consumer above remains byte-identical.
edge_before = $checks
[:empty_array, :empty_list].each do |method|
  check(API.public_send(method, []) == [], "Fin 0 empty round trip")
  [0, 1, 2**70].each do |value|
    input = [value]
    check(rejected("arg0[0]", "0") { API.public_send(method, input) }, "Fin 0 nonempty is bound error")
    check(input == [value], "Fin 0 input unchanged")
  end
end
check(API.empty_option(nil).nil?, "Fin 0 none round trip")
[0, 1, 2**70].each do |value|
  input = Some.new(value)
  check(rejected("arg0?", "0") { API.empty_option(input) }, "Fin 0 some is bound error")
  check(input == Some.new(value), "Fin 0 option unchanged")
end
check(API.optional_digits(nil).nil?, "optional list none")
check(API.optional_digits(Some.new([])) == Some.new([]), "optional list present empty")
check(API.optional_digits(Some.new([0, 9])) == Some.new([0, 9]), "optional list endpoints")
3.times do |position|
  values = [1, 2, 3]
  values[position] = 10
  snapshot = values.dup
  mixed = values.map { |value| Some.new(value) }
  check(rejected("arg0[#{position}]?", "10") { API.present(mixed) }, "nested option invalid position")
  check(mixed == snapshot.map { |value| Some.new(value) }, "nested option input unchanged")
  check(rejected("arg0?[#{position}]", "10") { API.optional_digits(Some.new(values)) }, "optional list invalid position")
  check(values == snapshot, "optional list input unchanged")
  3.times do |column|
    rows = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
    rows[position][column] = 10
    before = rows.map(&:dup)
    check(rejected("arg0[#{position}][#{column}]", "10") { API.flatten(rows) }, "nested row and element positions")
    check(rows == before, "nested rows unchanged")
  end
end
check(API.present([nil, nil, nil]) == [], "absent options")
check(API.flatten([[], [], []]) == Some.new([]), "present empty rows")
check(raises(TypeError) { API.empty_option(0) }, "unwrapped option")
check(raises(TypeError) { API.empty_list(0) }, "non-Array List")
check(raises(TypeError) { API.optional_digits(Some.new([1, 'x', 3])) }, "nested wrong element type")
edge_negative = lambda do |&call|
  begin
    call.call
    false
  rescue RangeError => error
    error.class == RangeError && error.message == "Nat cannot be negative"
  end
end
check(edge_negative.call { API.empty_array([-1]) }, "negative Fin 0 array is the Nat error")
check(edge_negative.call { API.empty_list([-1]) }, "negative Fin 0 list is the Nat error")
check(edge_negative.call { API.empty_option(Some.new(-1)) }, "negative Fin 0 option is the Nat error")
3.times do |position|
  values = [1, 2, 3]
  values[position] = -1
  before = values.dup
  check(edge_negative.call { API.optional_digits(Some.new(values)) }, "negative nested Nat")
  check(values == before, "negative nested input unchanged")
end
1000.times do
  check(rejected("arg0[0]", "0") { API.empty_array([0]) }, "cycle invalid array")
  check(API.empty_array([]) == [], "cycle valid array")
  check(rejected("arg0[0]", "0") { API.empty_list([0]) }, "cycle invalid list")
  check(API.empty_list([]) == [], "cycle valid list")
  check(rejected("arg0?", "0") { API.empty_option(Some.new(0)) }, "cycle invalid option")
  check(API.empty_option(nil).nil?, "cycle valid option")
  check(rejected("arg0[1]?", "10") { API.present([Some.new(1), Some.new(10), nil]) }, "cycle invalid nested option")
  check(API.present([Some.new(1), nil, Some.new(9)]) == [1, 9], "cycle valid nested option")
  check(rejected("arg0[1][0]", "10") { API.flatten([[1], [10], [9]]) }, "cycle invalid nested list")
  check(API.flatten([[1], [], [9]]) == Some.new([1, 9]), "cycle valid nested list")
  check(rejected("arg0?[1]", "10") { API.optional_digits(Some.new([1, 10, 9])) }, "cycle invalid optional list")
  check(API.optional_digits(Some.new([1, 9])) == Some.new([1, 9]), "cycle valid optional list")
end
check($checks - edge_before == 12068, "exact edge assertion coverage")

late_before = $checks
late_names = ['alpha', "mid\0dle", 'omega']
late_saved_names = late_names.map(&:dup)
late_offsets = [1, 2, 3]
late_saved_offsets = late_offsets.dup
3.times do |i|
  late_names[i] << '!'
  check(late_names != late_saved_names, 'name snapshot detects mutation')
  late_names[i].chop!
  late_offsets[i] += 1
  check(late_offsets != late_saved_offsets, 'offset snapshot detects mutation')
  late_offsets[i] -= 1
end
check(late_names == late_saved_names, 'name controls restored')
check(late_offsets == late_saved_offsets, 'offset controls restored')
# Nine position/value combinations, then 1,000 rejection/recovery pairs.
1009.times do |cycle|
  position, representation = cycle % 3, (cycle / 3) % 3
  late_offsets = [1, 2, 3]
  late_offsets[position] = [4, 5, 2**70][representation]
  late_saved_offsets = late_offsets.dup
  check(rejected("arg1[#{position}]", '4') { API.label(late_names, late_offsets) }, 'late bound diagnostic')
  check(late_names == late_saved_names && late_names.all? { |v| v.instance_of?(String) }, 'all names unchanged after rejection')
  check(late_offsets == late_saved_offsets && late_offsets.all? { |v| v.instance_of?(Integer) }, 'all offsets unchanged after rejection')
  late_offsets = [1, 2, 3]; late_saved_offsets = late_offsets.dup
  check(API.label(late_names, late_offsets) == "alpha:1,mid\0dle:2,omega:3", 'late recovery output')
  check(late_names == late_saved_names && late_names.all? { |v| v.instance_of?(String) }, 'all names unchanged after recovery')
  check(late_offsets == late_saved_offsets && late_offsets.all? { |v| v.instance_of?(Integer) }, 'all offsets unchanged after recovery')
end
check($checks - late_before == 6062, 'complete late-input assertion count')

puts "fin-container-ok:#{$checks}"
