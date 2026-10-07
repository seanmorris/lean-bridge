import lean_subtypes as api

checks = 0
def check(value, label):
    global checks
    if not value:
        raise AssertionError('failed: ' + label)
    checks += 1
def rejected(call, parameter, constructor):
    try:
        call()
    except api.LeanBridgeError as error:
        return error.status == 1 and str(error) == parameter + ' was rejected by ' + constructor
    return False
def bound(call, parameter, limit):
    try:
        call()
    except api.LeanBridgeError as error:
        return error.status == 1 and str(error) == parameter + ' is not below its Fin ' + limit + ' bound'
    return False
def raises(kind, call):
    try:
        call()
    except kind:
        return True
    return False

hello = 'héllo \U0001F642'
# Nonempty String: Unicode and embedded NUL are ordinary payloads; the empty string is rejected.
check(api.shout(hello) == hello + '!' and api.shout('a\0b') == 'a\0b!', 'shout')
check(rejected(lambda: api.shout(''), 'arg0', 'Subtypes.checkedWord'), 'empty word')
check(raises(TypeError, lambda: api.shout(b'x')), 'bytes is not a str')
# Even Nat beyond 64 bits.
check(api.half(42) == 21 and api.half(2**100) == 2**99, 'half')
check(rejected(lambda: api.half(7), 'arg0', 'Subtypes.checkedEven'), 'odd')
check(raises(ValueError, lambda: api.half(-2)), 'negative is the Nat error')
# Small Int after an unchecked argument.
check(api.scale(-3, -128) == 384 and api.scale(-3, 127) == -381, 'scale')
check(rejected(lambda: api.scale(-3, 128), 'arg1', 'Subtypes.checkedSmall') and rejected(lambda: api.scale(-3, -129), 'arg1', 'Subtypes.checkedSmall'), 'late rejection')
# Nonempty ByteArray.
check(api.head(b'\0\xff') == 0, 'head')
check(rejected(lambda: api.head(b''), 'arg0', 'Subtypes.checkedPayload'), 'empty payload')
# A result-only subtype and two checked arguments.
check(api.pad(21) == 42, 'pad')
check(api.join('ab', 'cd') == 'abcd', 'join')
check(rejected(lambda: api.join('ab', ''), 'arg1', 'Subtypes.checkedWord') and rejected(lambda: api.join('', 'cd'), 'arg0', 'Subtypes.checkedWord'), 'join rejections')
# A normalizing constructor: the export sees the constructed value.
check(api.clamp(250) == 100 and api.clamp(7) == 7, 'clamp')
# A checked constructor beside a Fin bound: the Fin precheck runs first.
check(api.mix(4, 3) == 7, 'mix')
check(bound(lambda: api.mix(4, 10), 'arg1', '10') and bound(lambda: api.mix(5, 10), 'arg1', '10'), 'Fin before the constructor')
check(rejected(lambda: api.mix(5, 3), 'arg0', 'Subtypes.checkedEven'), 'odd beside a valid digit')
for i in range(1000):
    if not rejected(lambda: api.half(2 * i + 1), 'arg0', 'Subtypes.checkedEven'):
        raise AssertionError('invalid call accepted at ' + str(i))
    if api.half(2 * i) != i:
        raise AssertionError('valid call failed at ' + str(i))
checks += 2000
print('subtype-ok:' + str(checks))
