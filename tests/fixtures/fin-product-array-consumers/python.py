import copy
import lean_finproductarrays as api
from lean_finproductarrays import Ok, Err

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

# (0, ok 2^100), (2, error 5), (3, ok 6): both endpoints, and ok values no bound applies to.
valid = [(0, Ok(2**100)), (2, Err(5)), (3, Ok(6))]
expected = 2**100 + 1016
# An empty array is valid, in and out.
check(api.rows([]) == 0, 'empty rows')
check(api.reversed([]) == (), 'empty reversed')
rows = list(valid)
check(api.rows(rows) == expected, 'valid rows')
# A component at its bound is rejected in the first, middle and last element, and the active error
# branch at its bound, while ok 6 in the last row passed above. Each rejected list is compared with
# a deep snapshot taken before the call.
for k in range(4):
    bad = list(valid)
    if k < 3:
        bad[k] = (4, valid[k][1])
    else:
        bad[1] = (2, Err(6))
    before = copy.deepcopy(bad)
    check(rejected(lambda: api.rows(bad), (f"arg0[{k}].0" if k < 3 else "arg0[1].1.error"), '4' if k < 3 else '6'), 'rejected case ' + str(k))
    check(bad == before, 'rejected input unchanged ' + str(k))
# A valid call recovers.
check(rows == [(0, Ok(2**100)), (2, Err(5)), (3, Ok(6))], 'caller rows unchanged')
check(api.rows(rows) == expected, 'recovery')
# Lean returns the rows reversed, each below its bounds.
check(api.reversed(rows) == tuple(reversed(valid)), 'reversed')
for i in range(1000):
    check(api.rows(rows) == expected, 'round')
    bad = [valid[0], valid[1], (4 + i, Ok(6))]
    check(rejected(lambda: api.rows(bad), 'arg0[2].0', '4') and bad[2][0] == 4 + i, 'rejection round')
print(f'fin-product-array-ok:{checks}')
