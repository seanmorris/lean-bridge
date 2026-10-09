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
    check(rejected(lambda: api.mirror_all(bad), 'arg0', '10'), 'invalid element at ' + str(position))
    check(bad[position] == 10, 'input unchanged')
check(rejected(lambda: api.mirror_all([word, 1, 2]), 'arg0', '10'), 'word element')
check(raises(ValueError, lambda: api.mirror_all([-1, 1])), 'negative is the Nat error')
check(raises(TypeError, lambda: api.mirror_all([1.5])), 'float element is TypeError')
check(raises(TypeError, lambda: api.mirror_all(3)), 'non-sequence is TypeError')
# Array (Fin 0): only the empty array has values.
check(api.count_none([]) == 0, 'Fin 0 empty')
check(rejected(lambda: api.count_none([0]), 'arg0', '0'), 'Fin 0 present')
# List Huge: a 2^70 bound compared limb by limb.
check(api.sum_huge([word, huge - 1]) == word + huge - 1, 'huge sum')
check(api.sum_huge([]) == 0, 'empty list')
check(rejected(lambda: api.sum_huge([word, huge]), 'arg0', str(huge)), 'huge bound')
# Option (Fin 1): none is valid; a present value is checked.
check(api.or_default(None) == 7 and api.or_default(Some(0)) == 0, 'option values')
check(rejected(lambda: api.or_default(Some(1)), 'arg0', '1'), 'present Fin 1')
# Array (Option Digit): only present elements are checked.
check(api.present([Some(1), None, Some(9)]) == (1, 9), 'present digits')
check(rejected(lambda: api.present([Some(1), None, Some(10)]), 'arg0', '10'), 'present invalid')
check(api.present([Some(1), None, None]) == (1,), 'absent is never read')
# List (Array Digit) -> Option (List Digit): nested rows.
check(api.flatten([[1, 2], [3]]) == Some((1, 2, 3)), 'flatten rows')
check(api.flatten([]) is None, 'no rows')
check(rejected(lambda: api.flatten([[1, 2], [10]]), 'arg0', '10'), 'nested invalid last')
# A late refined argument after an unrefined one.
names = ['a', 'b']
check(api.label(names, [1, 3]) == 'a:1,b:3', 'label')
check(rejected(lambda: api.label(names, [1, 4]), 'arg1', '4'), 'late argument')
check(names == ['a', 'b'], 'caller data unchanged')
# A result-only container refinement projects each element after Lean returns.
check(api.wrap_all([100, huge]) == (2, 2) and api.wrap_all([]) == (), 'wrapped results')
for i in range(1000):
    if not rejected(lambda: api.mirror_all([10 + i % 5]), 'arg0', '10'):
        raise AssertionError('invalid call accepted at ' + str(i))
    if api.mirror_all([i % 10]) != (9 - i % 10,):
        raise AssertionError('valid call failed at ' + str(i))
checks += 2000
print('fin-container-ok:' + str(checks))
