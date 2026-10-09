# Array fields and results: Array Nat inside ArrayBox, BoxRow as Array NatBox, and RowBox's Array NatBox field.
def array_raises(kind, call):
    try:
        call()
    except kind:
        return True
    except Exception:
        return False
    return False
array_wide = 2**70
pushed = api.push_count(api.ArrayBox([1, array_wide, 3], 3))
check(pushed == api.ArrayBox((1, array_wide, 3, 3), 4) and type(pushed.value) is tuple)
check(api.push_count(api.ArrayBox([], 0)) == api.ArrayBox((0,), 1))
check(api.push_count(api.ArrayBox((5,), 1)) == api.ArrayBox((5, 1), 2))
array_input = [1, array_wide, 3]
array_box = api.ArrayBox(array_input, 3)
check(api.push_count(array_box) == pushed and array_input == [1, array_wide, 3] and list(array_box.value) == array_input and array_box.count == 3)
row = [api.NatBox(2, 3), api.NatBox(array_wide, 1), api.NatBox(0, 5)]
row_expected = array_wide + 6
check(api.row_total(row) == row_expected and api.row_total([]) == 0 and api.row_total(tuple(row)) == row_expected)
check(row == [api.NatBox(2, 3), api.NatBox(array_wide, 1), api.NatBox(0, 5)])
made = api.row_of(3)
check(made == (api.NatBox(0, 3), api.NatBox(1, 3), api.NatBox(2, 3)) and api.row_of(0) == () and api.row_total(made) == 9)
check(api.row_box_sum(api.RowBox(row, 4)) == row_expected and api.row_box_sum(api.RowBox([], 9)) == 9 and api.row_box_sum(api.RowBox(made, 0)) == 3)
# Invalid members at the first, middle and last position are the generated API's exact errors; the caller's input is unchanged and the next valid call succeeds.
array_members = ((-1, ValueError), (True, TypeError), ('1', TypeError), (1.0, TypeError))
row_members = ((api.NatBox(-1, 0), ValueError), (api.NatBox(0, -1), ValueError), (api.NatBox(True, 0), TypeError)
    , (api.NatBoxAgain(1, 0), TypeError), ((1, 0), TypeError), (1, TypeError))
for position in range(3):
    for member, kind in array_members:
        values = [1, array_wide, 3]
        values[position] = member
        check(array_raises(kind, lambda: api.push_count(api.ArrayBox(values, 3))) and values[position] is member and len(values) == 3)
        check(api.push_count(api.ArrayBox([1, array_wide, 3], 3)) == pushed)
    for member, kind in row_members:
        broken = list(row)
        broken[position] = member
        check(array_raises(kind, lambda: api.row_total(broken)) and broken[position] is member and len(broken) == 3)
        check(array_raises(kind, lambda: api.row_box_sum(api.RowBox(broken, 4))) and broken[position] is member)
        check(api.row_total(row) == row_expected and api.row_box_sum(api.RowBox(row, 4)) == row_expected)
# A non-sequence Array, and a negative or non-integer count beside an Array field, are refused too.
for call, kind in ((lambda: api.push_count(api.ArrayBox(5, 1)), TypeError)
        , (lambda: api.push_count(api.ArrayBox(iter([1]), 1)), TypeError)
        , (lambda: api.row_total(api.NatBox(1, 0)), TypeError)
        , (lambda: api.row_total({api.NatBox(1, 0)}), TypeError)
        , (lambda: api.row_box_sum(api.RowBox(api.NatBox(1, 0), 1)), TypeError)
        , (lambda: api.push_count(api.ArrayBox([1], -1)), ValueError)
        , (lambda: api.row_box_sum(api.RowBox(row, -1)), ValueError)
        , (lambda: api.row_box_sum(api.RowBox(row, False)), TypeError)
        , (lambda: api.row_of(-1), ValueError)
        , (lambda: api.push_count(api.RowBox(row, 1)), TypeError)
        , (lambda: api.row_box_sum(api.ArrayBox([1], 1)), TypeError)):
    check(array_raises(kind, call))
    check(api.row_box_sum(api.RowBox(row, 4)) == row_expected)
# One thousand Array rounds: a rejected member, then valid Array input and result calls.
for round_index in range(1000):
    position, size = round_index % 3, round_index % 4
    values = [1, array_wide, 3]
    values[position] = -1
    rejected_member = array_raises(ValueError, lambda: api.push_count(api.ArrayBox(values, round_index)))
    values[position] = (1, array_wide, 3)[position]
    round_row = api.row_of(size)
    broken = list(row)
    broken[position] = api.NatBox(-1, 0)
    check(rejected_member and api.push_count(api.ArrayBox(values, round_index)) == api.ArrayBox((1, array_wide, 3, round_index), round_index + 1)
        and len(round_row) == size and api.row_total(round_row) == size * size * (size - 1) // 2
        and api.row_box_sum(api.RowBox(round_row, round_index)) == round_index + size * (size - 1) // 2
        and array_raises(ValueError, lambda: api.row_box_sum(api.RowBox(broken, round_index))))
