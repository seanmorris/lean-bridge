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
