# Array fields and results: Array Nat inside ArrayBox, BoxRow as Array NatBox, and RowBox's Array NatBox field.
def array_raises(kind)
  yield
  false
rescue kind
  true
rescue StandardError
  false
end
array_wide = 2**70
pushed = API.push_count(API::ArrayBox.new(value: [1, array_wide, 3], count: 3))
check(pushed.instance_of?(API::ArrayBox) && pushed.value == [1, array_wide, 3, 3] && pushed.count == 4 && pushed.frozen?)
check(API.push_count(API::ArrayBox.new(value: [], count: 0)) == API::ArrayBox.new(value: [0], count: 1))
array_input = [1, array_wide, 3]
array_box = API::ArrayBox.new(value: array_input, count: 3)
check(API.push_count(array_box) == pushed && array_input == [1, array_wide, 3] && array_box.value == array_input && array_box.count == 3)
row = [nat_box(2, 3), nat_box(array_wide, 1), nat_box(0, 5)]
row_expected = array_wide + 6
check(API.row_total(row) == row_expected && API.row_total([]) == 0)
check(row == [nat_box(2, 3), nat_box(array_wide, 1), nat_box(0, 5)])
made = API.row_of(3)
check(made == [nat_box(0, 3), nat_box(1, 3), nat_box(2, 3)] && API.row_of(0) == [] && API.row_total(made) == 9)
check(API.row_box_sum(API::RowBox.new(value: row, count: 4)) == row_expected && API.row_box_sum(API::RowBox.new(value: [], count: 9)) == 9 && API.row_box_sum(API::RowBox.new(value: made, count: 0)) == 3)
# Invalid members at the first, middle and last position are the generated API's exact errors; the caller's input is unchanged and the next valid call succeeds.
array_members = [[-1, RangeError], [true, TypeError], ["1", TypeError], [1.0, TypeError]]
row_members = [[nat_box(-1, 0), RangeError], [nat_box(0, -1), RangeError], [nat_box(true, 0), TypeError], [API::NatBoxAgain.new(value: 1, count: 0), TypeError], [[1, 0], TypeError], [1, TypeError]]
3.times do |position|
  array_members.each do |member, kind|
    values = [1, array_wide, 3]
    values[position] = member
    check(array_raises(kind) { API.push_count(API::ArrayBox.new(value: values, count: 3)) } && values[position].equal?(member) && values.length == 3)
    check(API.push_count(API::ArrayBox.new(value: [1, array_wide, 3], count: 3)) == pushed)
  end
  row_members.each do |member, kind|
    broken = row.dup
    broken[position] = member
    check(array_raises(kind) { API.row_total(broken) } && broken[position].equal?(member) && broken.length == 3)
    check(array_raises(kind) { API.row_box_sum(API::RowBox.new(value: broken, count: 4)) } && broken[position].equal?(member))
    check(API.row_total(row) == row_expected && API.row_box_sum(API::RowBox.new(value: row, count: 4)) == row_expected)
  end
end
# A non-Array, and a negative or non-integer count beside an Array field, are refused too.
[
  [-> { API.push_count(API::ArrayBox.new(value: 5, count: 1)) }, TypeError],
  [-> { API.row_total(nat_box(1, 0)) }, TypeError],
  [-> { API.row_total({ 0 => nat_box(1, 0) }) }, TypeError],
  [-> { API.row_box_sum(API::RowBox.new(value: nat_box(1, 0), count: 1)) }, TypeError],
  [-> { API.push_count(API::ArrayBox.new(value: [1], count: -1)) }, RangeError],
  [-> { API.row_box_sum(API::RowBox.new(value: row, count: -1)) }, RangeError],
  [-> { API.row_box_sum(API::RowBox.new(value: row, count: false)) }, TypeError],
  [-> { API.row_of(-1) }, RangeError],
  [-> { API.push_count(API::RowBox.new(value: row, count: 1)) }, TypeError],
  [-> { API.row_box_sum(API::ArrayBox.new(value: [1], count: 1)) }, TypeError]
].each do |call, kind|
  check(array_raises(kind) { call.call })
  check(API.row_box_sum(API::RowBox.new(value: row, count: 4)) == row_expected)
end
# One thousand Array rounds: a rejected member, then valid Array input and result calls.
(0...1000).each do |round_index|
  position = round_index % 3
  size = round_index % 4
  values = [1, array_wide, 3]
  values[position] = -1
  rejected_member = array_raises(RangeError) { API.push_count(API::ArrayBox.new(value: values, count: round_index)) }
  values[position] = [1, array_wide, 3][position]
  round_row = API.row_of(size)
  broken = row.dup
  broken[position] = nat_box(-1, 0)
  triangle = size * (size - 1) / 2
  check(rejected_member && API.push_count(API::ArrayBox.new(value: values, count: round_index)) == API::ArrayBox.new(value: [1, array_wide, 3, round_index], count: round_index + 1) &&
    round_row.length == size && API.row_total(round_row) == size * triangle &&
    API.row_box_sum(API::RowBox.new(value: round_row, count: round_index)) == round_index + triangle &&
    array_raises(RangeError) { API.row_box_sum(API::RowBox.new(value: broken, count: round_index)) })
end
