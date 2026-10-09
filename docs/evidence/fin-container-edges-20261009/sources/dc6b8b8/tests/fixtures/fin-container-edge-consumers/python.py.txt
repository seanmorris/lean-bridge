# VO #1454: all old assertions above still execute unchanged.
edge_before = checks
for edge_method in [api.empty_array, api.empty_list]:
    check(edge_method([]) == (), 'Fin 0 empty round trip')
    for edge_value in [0, 1, 2**70]:
        edge_input = [edge_value]
        check(rejected(lambda: edge_method(edge_input), 'arg0', '0'), 'Fin 0 nonempty is bound error')
        check(edge_input == [edge_value], 'Fin 0 input unchanged')
check(api.empty_option(None) is None, 'Fin 0 none round trip')
for edge_value in [0, 1, 2**70]:
    edge_input = Some(edge_value)
    check(rejected(lambda: api.empty_option(edge_input), 'arg0', '0'), 'Fin 0 some is bound error')
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
    check(rejected(lambda: api.present(edge_options), 'arg0', '10'), 'nested option invalid position')
    check(edge_options == [Some(value) for value in edge_snapshot], 'nested option input unchanged')
    check(rejected(lambda: api.optional_digits(Some(edge_values)), 'arg0', '10'), 'optional list invalid position')
    check(edge_values == edge_snapshot, 'optional list input unchanged')
    # Every outer AND inner position, not just the final row.
    for edge_column in range(3):
        edge_rows = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
        edge_rows[edge_position][edge_column] = 10
        edge_copy = [row[:] for row in edge_rows]
        check(rejected(lambda: api.flatten(edge_rows), 'arg0', '10'), 'nested row and element positions')
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
    check(rejected(lambda: api.empty_array([0]), 'arg0', '0'), 'cycle invalid array')
    check(api.empty_array([]) == (), 'cycle valid array')
    check(rejected(lambda: api.empty_list([0]), 'arg0', '0'), 'cycle invalid list')
    check(api.empty_list([]) == (), 'cycle valid list')
    check(rejected(lambda: api.empty_option(Some(0)), 'arg0', '0'), 'cycle invalid option')
    check(api.empty_option(None) is None, 'cycle valid option')
    check(rejected(lambda: api.present([Some(1), Some(10), None]), 'arg0', '10'), 'cycle invalid nested option')
    check(api.present([Some(1), None, Some(9)]) == (1, 9), 'cycle valid nested option')
    check(rejected(lambda: api.flatten([[1], [10], [9]]), 'arg0', '10'), 'cycle invalid nested list')
    check(api.flatten([[1], [], [9]]) == Some((1, 9)), 'cycle valid nested list')
    check(rejected(lambda: api.optional_digits(Some([1, 10, 9])), 'arg0', '10'), 'cycle invalid optional list')
    check(api.optional_digits(Some([1, 9])) == Some((1, 9)), 'cycle valid optional list')
check(checks - edge_before == 12065, 'exact edge assertion coverage')
