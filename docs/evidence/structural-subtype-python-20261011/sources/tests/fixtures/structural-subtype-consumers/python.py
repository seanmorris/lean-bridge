"""Independent installed Python checks for structural Subtypes and mixed Fin."""
import json


def check_structural_subtypes(api):
    checks = 0
    rejections = 0
    snapshot_controls = 0
    Some, Ok, Err = api.Some, api.Ok, api.Err

    def check(condition, label):
        nonlocal checks
        if not condition:
            raise AssertionError('failed: ' + label)
        checks += 1

    def snapshot(value):
        if type(value) in (list, tuple):
            return (type(value).__name__, tuple(snapshot(item) for item in value))
        if type(value) in (Some, Ok, Err):
            return (type(value).__name__, snapshot(value.value))
        if value is None or type(value) in (int, str):
            return (type(value).__name__, value)
        raise AssertionError('unsupported snapshot input: ' + repr(type(value)))

    def refused(fn, args, path, constructor=None, bound=None):
        nonlocal rejections
        before = snapshot(args)
        expected = (path + ' is not below its Fin ' + str(bound) + ' bound'
                    if bound is not None else path + ' was rejected by StructuralSubtypes.' + constructor)
        try:
            fn(*args)
        except api.LeanBridgeError as error:
            check(error.status == 1 and str(error) == expected, 'exact refusal: ' + expected + ' got ' + str(error))
        else:
            raise AssertionError('accepted: ' + expected)
        check(snapshot(args) == before, 'complete rejected inputs unchanged')
        rejections += 1

    huge, wide = 2**100, 10 * 2**64 + 10
    # The snapshot must detect changes in either argument and nested payloads.
    original = ([Some(huge), None], [Some((255, 'a\0tail'))])
    mutations = [
        ([Some(huge + 1), None], original[1]),
        ([None, None], original[1]),
        ([Some(huge), None, None], original[1]),
        (original[0], [Some((254, 'a\0tail'))]),
        (original[0], [Some((255, 'a\0changed'))]),
        (original[0], [None]),
    ]
    for changed in mutations:
        check(snapshot(changed) != snapshot(original), 'snapshot mutation control')
        snapshot_controls += 1

    check(api.scalar(huge) == huge, 'scalar wide Nat')
    refused(api.scalar, (0,), 'arg0', 'checkedPositive')
    for name in ('arrays', 'lists', 'specialized'):
        fn = getattr(api, name)
        check(fn([]) == (), name + ' empty')
        values = [1, huge, 3]
        check(fn(values) == tuple(values), name + ' wide values')
        for position in range(3):
            bad = values.copy()
            bad[position] = 0
            refused(fn, (bad,), f'arg0[{position}]', 'checkedPositive')
        check(fn(values) == tuple(values), name + ' recovery')

    check(api.options(None) is None, 'absent option')
    check(api.options(Some(huge)) == Some(huge), 'present option')
    refused(api.options, (Some(0),), 'arg0?', 'checkedPositive')
    text = 'héllo\0tail\U0001F642'
    check(api.product((huge, text)) == (huge, text), 'product preserves Unicode and NUL suffix')
    refused(api.product, ((0, text),), 'arg0.0', 'checkedPositive')
    refused(api.product, ((huge, ''),), 'arg0.1', 'checkedWord')
    check(api.branch(Ok(huge)) == Ok(huge), 'active ok branch')
    check(api.branch(Err(text)) == Err(text), 'active error branch')
    refused(api.branch, (Ok(0),), 'arg0.ok', 'checkedPositive')
    refused(api.branch, (Err(''),), 'arg0.error', 'checkedWord')

    bytes_input = [None, Some((255, huge))]
    check(api.byte_branches(bytes_input) == tuple(bytes_input), 'UInt8 and Nat carriers')
    refused(api.byte_branches, ([None, Some((0, huge))],), 'arg0[1]?.0', 'checkedByte')
    refused(api.byte_branches, ([None, Some((1, 0))],), 'arg0[1]?.1', 'checkedPositive')
    nested = [[None, Some((huge, wide - 1))], [], [Some((2, 3))]]
    check(api.nested(nested) == 3, 'nested valid')
    for row in range(3):
        for column in range(3):
            rows = [[Some((huge, wide - 1)) for _ in range(3)] for _ in range(3)]
            rows[row][column] = Some((0, wide))
            refused(api.nested, (rows,), f'arg0[{row}][{column}]?.1', bound=wide)
            rows[row][column] = Some((0, wide - 1))
            refused(api.nested, (rows,), f'arg0[{row}][{column}]?.0', 'checkedPositive')
            rows[row][column] = Some((1, wide - 1))
            check(api.nested(rows) == 3, 'nested position recovery')

    first = [Some(1), None, Some(huge)]
    second = [Some(huge), Some(3), None]
    normalized = (Some(huge + 1), Some(4), None)
    check(api.alias_pair((first, second)) == (tuple(first), normalized), 'independent alias-site constructors')
    check(api.alias_arguments(first, second) == tuple(first) + normalized, 'independent parameter constructors')
    check(api.plain_fin([None, Some(0), Some(9)]) == 3, 'Fin-only empty and endpoints')
    refused(api.plain_fin, ([Some(10)],), 'arg0[0]?', bound=10)
    for position in range(3):
        left = [Some(1), Some(huge), Some(3)]
        left[position] = Some(0)
        refused(api.alias_pair, ((left, second),), f'arg0.0[{position}]?', 'checkedPositive')
        right = [Some(huge), Some(3), Some(4)]
        right[position] = Some(0)
        refused(api.alias_pair, ((first, right),), f'arg0.1[{position}]?', 'normalizePositive')

    for round_ in range(1000):
        late = [Some(huge), Some(3), Some(4)]
        position = round_ % 3
        late[position] = Some(0)
        refused(api.alias_arguments, (first, late), f'arg1[{position}]?', 'normalizePositive')
        before = snapshot((first, second))
        check(api.alias_arguments(first, second) == tuple(first) + normalized, 'late rejection recovery')
        check(snapshot((first, second)) == before, 'successful normalization does not mutate either input')

    return {'checks': checks, 'rejections': rejections, 'snapshotControls': snapshot_controls}


if __name__ == '__main__':
    import lean_structuralsubtypes
    print(json.dumps(check_structural_subtypes(lean_structuralsubtypes), sort_keys=True))
