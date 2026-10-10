import lean_finproducts as api
from lean_finproducts import Some, Ok, Err

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

wide = 10 * 2**64 + 10
# Fin 10 × Nat: only the first component is bounded.
for d in range(10):
    check(api.first((d, 1000)) == (9 - d, 1001), 'first valid')
check(rejected(lambda: api.first((10, 0)), 'arg0', '10'), 'first at bound')
check(rejected(lambda: api.first((2**70, 0)), 'arg0', '10'), 'first beyond 64 bits')
check(api.first((3, 2**200)) == (6, 2**200 + 1), 'unbounded component')
# Nat × Fin 1, and a bound wider than 64 bits beside Fin 10.
check(api.second((41, 0)) == 41, 'second valid')
check(rejected(lambda: api.second((41, 1)), 'arg0', '1'), 'second at bound')
check(api.wide((wide - 1, 9)) == wide + 8, 'wide valid')
check(rejected(lambda: api.wide((wide, 9)), 'arg0', str(wide)), 'wide at bound')
check(rejected(lambda: api.wide((wide - 1, 10)), 'arg0', '10'), 'wide second at bound')
# Option (Fin 0 × Nat): only none is valid.
check(api.absent_only(None) == 7, 'absent only none')
check(rejected(lambda: api.absent_only(Some((0, 0))), 'arg0', '0'), 'absent only some')
# Except String (Fin 10): the ok branch is bounded; an inactive branch is never read.
check(api.ok_only(Ok(9)) == 9, 'ok valid')
check(rejected(lambda: api.ok_only(Ok(10)), 'arg0', '10'), 'ok at bound')
check(api.ok_only(Err('four')) == 104, 'inactive ok')
# Except (Fin 5) Nat: the error branch is bounded; any ok Nat is valid.
check(api.error_only(Ok(2**100)) == 2**100, 'unbounded ok')
check(api.error_only(Err(4)) == 104, 'error valid')
check(rejected(lambda: api.error_only(Err(5)), 'arg0', '5'), 'error at bound')
# Except (Fin 3) (Fin 7): only the active branch is checked.
check(api.both(Ok(6)) == 6, 'both ok valid')
check(rejected(lambda: api.both(Ok(7)), 'arg0', '7'), 'both ok at bound')
check(api.both(Err(2)) == 102, 'both error valid')
check(rejected(lambda: api.both(Err(3)), 'arg0', '3'), 'both error at bound')
# List (Option (Fin 3 × Except (Fin 2) Nat)): every present element, both levels.
rows = [None, Some((2, Ok(50))), Some((1, Err(1)))]
check(api.nested(rows) == 54, 'nested valid')
check(rejected(lambda: api.nested([None, Some((2, Ok(50))), Some((1, Err(2)))]), 'arg0', '2'), 'nested branch')
check(rejected(lambda: api.nested([None, Some((3, Ok(50))), Some((1, Err(1)))]), 'arg0', '3'), 'nested component')
check(api.nested(rows) == 54, 'nested recovery')
# DigitPair := Digit × Digit through the alias.
check(api.aliased((1, 9)) == (9, 1), 'aliased valid')
check(rejected(lambda: api.aliased((1, 10)), 'arg0', '10'), 'aliased at bound')
# Results carrying bounds are produced by Lean and arrive below them.
check(api.produce(4) == Err(4) and type(api.produce(23)) is Ok, 'produce')
check(api.pair_up(23) == (3, 23), 'pair up')
for i in range(1000):
    check(api.first((i % 10, i))[0] == 9 - i % 10, 'round')
    check(rejected(lambda: api.first((10 + i, i)), 'arg0', '10'), 'rejection round')
print(f'fin-product-ok:{checks}')
