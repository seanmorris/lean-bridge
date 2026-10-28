import lean_dependentfin as api

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
        return error.status == 1 and str(error) == parameter + ' is not below its dependent Fin bound ' + bound
    return False
def raises(kind, call):
    try:
        call()
    except kind:
        return True
    return False

huge, word = 2**70, 2**32
# Fin 0: the live bound zero has no values.
check(rejected(lambda: api.mirror(0, 0), 'arg1', 'arg0'), 'Fin 0 rejects zero')
check(rejected(lambda: api.mirror(0, 1), 'arg1', 'arg0'), 'Fin 0 rejects one')
# Fin 1: only zero.
check(api.mirror(1, 0) == 0, 'Fin 1 accepts zero')
check(rejected(lambda: api.mirror(1, 1), 'arg1', 'arg0'), 'Fin 1 rejects its bound')
# The exact endpoints of a small live bound.
check(api.mirror(10, 0) == 9 and api.mirror(10, 9) == 0, 'Fin 10 endpoints')
for value in (10, 11, word, huge):
    check(rejected(lambda: api.mirror(10, value), 'arg1', 'arg0'), 'Fin 10 rejects ' + str(value))
# Live bounds wider than a machine word are compared limb by limb.
check(api.mirror(word, word - 1) == 0 and api.mirror(word + 1, word) == 0, 'word bounds')
check(rejected(lambda: api.mirror(word, word), 'arg1', 'arg0'), 'word bound rejects itself')
check(api.mirror(huge, huge - 1) == 0 and api.mirror(huge, 0) == huge - 1, 'huge endpoints')
check(api.mirror(huge + 1, huge) == 0, 'one past a huge bound')
for value in (huge, huge + 1, 2**128):
    check(rejected(lambda: api.mirror(huge, value), 'arg1', 'arg0'), 'huge bound rejects ' + str(value))
# The bound is the argument of this call, never a frozen constant.
for bound in range(12):
    if bound > 5:
        check(api.mirror(bound, 5) == bound - 6, 'value 5 below live bound ' + str(bound))
    else:
        check(rejected(lambda: api.mirror(bound, 5), 'arg1', 'arg0'), 'value 5 at or above live bound ' + str(bound))
# Only the named earlier parameter bounds the value, not an unrelated earlier Nat.
check(api.label(100, 3, 2, 'slot') == 'slot:102', 'later dependency')
check(rejected(lambda: api.label(100, 3, 3, 'slot'), 'arg2', 'arg1'), 'bound is arg1, not the larger arg0')
check(rejected(lambda: api.label(100, 0, 0, 'slot'), 'arg2', 'arg1'), 'Fin 0 at a later site')
check(api.label(0, huge, huge - 1, 'x') == 'x:' + str(huge - 1), 'huge later bound')
# A negative Nat is the Nat error, not a dependent Fin rejection.
check(raises(ValueError, lambda: api.mirror(-1, 0)), 'negative bound')
check(raises(ValueError, lambda: api.mirror(5, -1)), 'negative value')
check(not rejected(lambda: api.mirror(5, -1), 'arg1', 'arg0'), 'negative value is not a Fin rejection')
check(raises(TypeError, lambda: api.mirror(5, 1.5)), 'float value is TypeError')
# Rejection leaves caller data unchanged.
start, bound, value, name = 7, 4, 4, 'slot'
check(rejected(lambda: api.label(start, bound, value, name), 'arg2', 'arg1'), 'rejected label')
check((start, bound, value, name) == (7, 4, 4, 'slot') and api.label(start, bound, 3, name) == 'slot:10', 'caller data unchanged')
# Repeated invalid and valid calls recover; the bound changes every call.
for i in range(1000):
    if not rejected(lambda: api.mirror(10, 10 + i % 5), 'arg1', 'arg0'):
        raise AssertionError('invalid call accepted at ' + str(i))
    if api.mirror(i % 7 + 1, i % 7) != 0 or api.mirror(10, i % 10) != 9 - i % 10:
        raise AssertionError('valid call failed at ' + str(i))
checks += 2000
print('dependent-fin-ok:' + str(checks))
