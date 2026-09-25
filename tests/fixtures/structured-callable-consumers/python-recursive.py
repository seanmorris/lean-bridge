"""Public recursive calls through a relocated, source-free installed wheel."""
import concurrent.futures
import copy
import dataclasses
import gc
import json
import pickle
import runpy
import weakref

import lean_structured as api

values = runpy.run_path('python-values.py')
payload, owned = values['payload'], values['owned']
checks = calls = rejected = 0

def check(condition):
    global checks
    checks += 1
    assert condition, checks

def rejects(exception, call):
    global rejected
    try:
        call()
    except exception as error:
        rejected += 1
        return error
    raise AssertionError(str(exception))

class Marker(BaseException):
    pass

for shape in values['SHAPES'] + ('recursive',):
    call, twice, make = (getattr(api, action + '_' + shape) for action in ('call', 'twice', 'make'))
    for seed in range(8):
        value = (api.TreeBranch([api.TreeLeaf((1 << (256 + seed)) + seed), api.TreeBranch([])])
                 if shape == 'recursive' else payload(shape, seed))
        expected = owned(value)
        check(call(value, lambda item: item) == expected)
        check(twice(value, lambda item: item) == expected)
        with make(value) as closure:
            check(closure(True, value) == expected)
            check(closure(False, value) == expected)
            check(call(value, lambda item: closure(True, item)) == expected)
            for operation in (copy.copy, copy.deepcopy, pickle.dumps):
                rejects(TypeError, lambda: operation(closure))
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as worker:
                check('creating thread' in str(worker.submit(lambda: rejects(RuntimeError, lambda: closure(True, value))).result()))
        check(closure.closed)
        rejects(RuntimeError, lambda: closure(True, value))
        closure.close()
        marker = Marker('failure')
        seen = []
        def failure(item):
            seen.append(item)
            raise marker
        check(rejects(Marker, lambda: twice(value, failure)) is marker)
        check(len(seen) == 1)
        check(call(value, lambda item: call(item, lambda inner: inner)) == expected)
        rejects((TypeError, ValueError), lambda: call(value, lambda item: object()))
        check(call(value, lambda item: item) == expected)
        calls += 10

for depth in range(64):
    value = api.TreeLeaf(1 << 256)
    for _ in range(depth):
        value = api.TreeBranch((value,))
    check(api.call_recursive(value, lambda item: item) == value)
    with api.make_recursive(value) as closure:
        check(closure(True, api.TreeLeaf(0)) == value)

# A branch adds the variant and its array edge. At 64 branches the leaf's
# Nat field is level 129, beyond the documented 128-level value bound.
too_deep = api.TreeBranch((value,))
rejects(ValueError, lambda: api.call_recursive(too_deep, lambda item: item))
rejects(ValueError, lambda: api.call_recursive(api.TreeLeaf(0), lambda item: too_deep))

cycle = []
value = api.TreeBranch(cycle)
cycle.append(value)
rejects(ValueError, lambda: api.call_recursive(value, lambda item: item))
with api.retain_record(lambda value: value) as escaped:
    rejects(api.LeanBridgeError, lambda: escaped(payload('record', 1)))
check(api.call_recursive(api.TreeLeaf(0), lambda item: item) == api.TreeLeaf(0))
for suffix in ('alias', 'plain'):
    seed = payload('record', 1)
    wanted = (api.Some(owned(seed)), None, api.Some(owned(seed)))
    call, make = (getattr(api, action + '_nested_' + suffix) for action in ('call', 'make'))
    check(call(seed, lambda rows: rows) == seed.text + '<none>' + seed.text)
    with make(seed) as closure:
        check(closure([]) == wanted)
print(json.dumps({'checks': checks, 'calls': calls, 'rejected': rejected}))
