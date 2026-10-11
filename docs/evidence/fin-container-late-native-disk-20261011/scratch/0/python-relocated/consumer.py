import lean_fincontainers as api
from lean_fincontainers import Some

checks = 0
def check(value, label):
    global checks
    if not value:
        raise AssertionError('failed: ' + label)
    checks += 1
def rejected(call, parameter, bound):
    try:
        call()
    except api.LeanBridgeError as error:
        return error.status == 1 and str(error) == parameter + ' is not below its Fin ' + bound + ' bound'
    return False
def raises(kind, call):
    try:
        call()
    except kind:
        return True
    return False

huge, word = 2**70, 2**32
digits = list(range(10))
# Array (Fin 10): every element is checked; results stay below the bound.
check(api.mirror_all(digits) == tuple(9 - i for i in range(10)), 'mirror endpoints')
check(api.mirror_all([]) == (), 'empty array')
for position in range(3):
    bad = [1, 2, 3]
    bad[position] = 10
    check(rejected(lambda: api.mirror_all(bad), f"arg0[{position}]", '10'), 'invalid element at ' + str(position))
    check(bad[position] == 10, 'input unchanged')
check(rejected(lambda: api.mirror_all([word, 1, 2]), 'arg0[0]', '10'), 'word element')
check(raises(ValueError, lambda: api.mirror_all([-1, 1])), 'negative is the Nat error')
check(raises(TypeError, lambda: api.mirror_all([1.5])), 'float element is TypeError')
check(raises(TypeError, lambda: api.mirror_all(3)), 'non-sequence is TypeError')
# Array (Fin 0): only the empty array has values.
check(api.count_none([]) == 0, 'Fin 0 empty')
check(rejected(lambda: api.count_none([0]), 'arg0[0]', '0'), 'Fin 0 present')
# List Huge: a 2^70 bound compared limb by limb.
check(api.sum_huge([word, huge - 1]) == word + huge - 1, 'huge sum')
check(api.sum_huge([]) == 0, 'empty list')
check(rejected(lambda: api.sum_huge([word, huge]), 'arg0[1]', str(huge)), 'huge bound')
# Option (Fin 1): none is valid; a present value is checked.
check(api.or_default(None) == 7 and api.or_default(Some(0)) == 0, 'option values')
check(rejected(lambda: api.or_default(Some(1)), 'arg0?', '1'), 'present Fin 1')
# Array (Option Digit): only present elements are checked.
check(api.present([Some(1), None, Some(9)]) == (1, 9), 'present digits')
check(rejected(lambda: api.present([Some(1), None, Some(10)]), 'arg0[2]?', '10'), 'present invalid')
check(api.present([Some(1), None, None]) == (1,), 'absent is never read')
# List (Array Digit) -> Option (List Digit): nested rows.
check(api.flatten([[1, 2], [3]]) == Some((1, 2, 3)), 'flatten rows')
check(api.flatten([]) is None, 'no rows')
check(rejected(lambda: api.flatten([[1, 2], [10]]), 'arg0[1][0]', '10'), 'nested invalid last')
# A late refined argument after an unrefined one.
names = ['a', 'b']
check(api.label(names, [1, 3]) == 'a:1,b:3', 'label')
check(rejected(lambda: api.label(names, [1, 4]), 'arg1[1]', '4'), 'late argument')
check(names == ['a', 'b'], 'caller data unchanged')
# A result-only container refinement projects each element after Lean returns.
check(api.wrap_all([100, huge]) == (2, 2) and api.wrap_all([]) == (), 'wrapped results')
for i in range(1000):
    if not rejected(lambda: api.mirror_all([10 + i % 5]), 'arg0[0]', '10'):
        raise AssertionError('invalid call accepted at ' + str(i))
    if api.mirror_all([i % 10]) != (9 - i % 10,):
        raise AssertionError('valid call failed at ' + str(i))
checks += 2000
# VO #1454: all old assertions above still execute unchanged.
edge_before = checks
for edge_method in [api.empty_array, api.empty_list]:
    check(edge_method([]) == (), 'Fin 0 empty round trip')
    for edge_value in [0, 1, 2**70]:
        edge_input = [edge_value]
        check(rejected(lambda: edge_method(edge_input), 'arg0[0]', '0'), 'Fin 0 nonempty is bound error')
        check(edge_input == [edge_value], 'Fin 0 input unchanged')
check(api.empty_option(None) is None, 'Fin 0 none round trip')
for edge_value in [0, 1, 2**70]:
    edge_input = Some(edge_value)
    check(rejected(lambda: api.empty_option(edge_input), 'arg0?', '0'), 'Fin 0 some is bound error')
    check(edge_input == Some(edge_value), 'Fin 0 option unchanged')

# Some [] is not None, including after invalid calls.
check(api.optional_digits(None) is None, 'optional list none')
check(api.optional_digits(Some([])) == Some(()), 'optional list present empty')
check(api.optional_digits(Some([0, 9])) == Some((0, 9)), 'optional list endpoints')
for edge_position in range(3):
    edge_values = [1, 2, 3]
    edge_values[edge_position] = 10
    edge_snapshot = edge_values[:]
    edge_options = [Some(value) for value in edge_values]
    check(rejected(lambda: api.present(edge_options), f'arg0[{edge_position}]?', '10'), 'nested option invalid position')
    check(edge_options == [Some(value) for value in edge_snapshot], 'nested option input unchanged')
    check(rejected(lambda: api.optional_digits(Some(edge_values)), f'arg0?[{edge_position}]', '10'), 'optional list invalid position')
    check(edge_values == edge_snapshot, 'optional list input unchanged')
    # Every outer AND inner position, not just the final row.
    for edge_column in range(3):
        edge_rows = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
        edge_rows[edge_position][edge_column] = 10
        edge_copy = [row[:] for row in edge_rows]
        check(rejected(lambda: api.flatten(edge_rows), f'arg0[{edge_position}][{edge_column}]', '10'), 'nested row and element positions')
        check(edge_rows == edge_copy, 'nested rows unchanged')
check(api.present([None, None, None]) == (), 'absent options')
check(api.flatten([[], [], []]) == Some(()), 'present empty rows')

# Python type errors are distinct from structurally valid but out-of-bound Nat values.
check(raises(TypeError, lambda: api.empty_option(0)), 'unwrapped option')
check(raises(TypeError, lambda: api.empty_list(0)), 'non-list')
check(raises(TypeError, lambda: api.optional_digits(Some([1, 'x', 3]))), 'nested wrong element type')
for edge_position in range(3):
    edge_values = [1, 2, 3]
    edge_values[edge_position] = -1
    edge_snapshot = edge_values[:]
    check(raises(ValueError, lambda: api.optional_digits(Some(edge_values))), 'nested negative Nat')
    check(edge_values == edge_snapshot, 'negative nested input unchanged')

# Repeat invalid zero-bound and nested calls, then valid recovery for each shape.
for edge_cycle in range(1000):
    check(rejected(lambda: api.empty_array([0]), 'arg0[0]', '0'), 'cycle invalid array')
    check(api.empty_array([]) == (), 'cycle valid array')
    check(rejected(lambda: api.empty_list([0]), 'arg0[0]', '0'), 'cycle invalid list')
    check(api.empty_list([]) == (), 'cycle valid list')
    check(rejected(lambda: api.empty_option(Some(0)), 'arg0?', '0'), 'cycle invalid option')
    check(api.empty_option(None) is None, 'cycle valid option')
    check(rejected(lambda: api.present([Some(1), Some(10), None]), 'arg0[1]?', '10'), 'cycle invalid nested option')
    check(api.present([Some(1), None, Some(9)]) == (1, 9), 'cycle valid nested option')
    check(rejected(lambda: api.flatten([[1], [10], [9]]), 'arg0[1][0]', '10'), 'cycle invalid nested list')
    check(api.flatten([[1], [], [9]]) == Some((1, 9)), 'cycle valid nested list')
    check(rejected(lambda: api.optional_digits(Some([1, 10, 9])), 'arg0?[1]', '10'), 'cycle invalid optional list')
    check(api.optional_digits(Some([1, 9])) == Some((1, 9)), 'cycle valid optional list')
check(checks - edge_before == 12065, 'exact edge assertion coverage')

late_before = checks
late_names = ['alpha', 'mid\0dle', 'omega']
late_saved_names = late_names.copy()
late_offsets = [1, 2, 3]
late_saved_offsets = late_offsets.copy()
for late_i in range(3):
    late_names[late_i] += '!'
    check(late_names != late_saved_names, 'name snapshot detects each changed position')
    late_names[late_i] = late_saved_names[late_i]
    late_offsets[late_i] += 1
    check(late_offsets != late_saved_offsets, 'offset snapshot detects each changed position')
    late_offsets[late_i] -= 1
check(late_names == late_saved_names, 'name controls restored')
check(late_offsets == late_saved_offsets, 'offset controls restored')
# Nine position/value combinations, then 1,000 rejection/recovery pairs.
for late_cycle in range(1009):
    late_position, late_representation = late_cycle % 3, (late_cycle // 3) % 3
    late_offsets = [1, 2, 3]
    late_offsets[late_position] = [4, 5, 2**70][late_representation]
    late_saved_offsets = late_offsets.copy()
    check(rejected(lambda: api.label(late_names, late_offsets), f'arg1[{late_position}]', '4'), 'late bound diagnostic')
    check(late_names == late_saved_names and all(type(v) is str for v in late_names), 'all names unchanged after rejection')
    check(late_offsets == late_saved_offsets and all(type(v) is int for v in late_offsets), 'all offsets unchanged after rejection')
    late_offsets = [1, 2, 3]
    late_saved_offsets = late_offsets.copy()
    check(api.label(late_names, late_offsets) == 'alpha:1,mid\0dle:2,omega:3', 'late recovery output')
    check(late_names == late_saved_names and all(type(v) is str for v in late_names), 'all names unchanged after recovery')
    check(late_offsets == late_saved_offsets and all(type(v) is int for v in late_offsets), 'all offsets unchanged after recovery')
check(checks - late_before == 6062, 'complete late-input assertion count')

print('fin-container-ok:' + str(checks))
