import ast
import ctypes as _c
import dataclasses
import gc
import json
import math
import pathlib
import sys
import typing
import lean_owned_aggregates as api
from lean_owned_aggregates import _native as n, _owned as r

library = _c.CDLL(sys.argv[1])
runtime = r._OwnedRuntime(library)
n._bind(runtime)

def native(name, arguments, result=_c.c_size_t):
    fn = library[name]
    fn.argtypes = arguments
    fn.restype = result
    return fn

live = native("owned_test_live", [])
identities = native("owned_test_identities", [])
native_fail = native("owned_test_fail_after", [_c.c_ssize_t], None)
layout_count = native("owned_test_layout_count", [])
layout = native("owned_test_layout", [_c.c_size_t])
checks = 0

def check(value):
    global checks
    assert value
    checks += 1

def rejected(kind, action, status=None):
    try:
        action()
    except kind as error:
        check(status is None or error.status == status)
    else:
        raise AssertionError("Expected " + str(kind))

check(len(n._layout) == layout_count())
for index, size in enumerate(n._layout):
    check(size == layout(index))
ast.parse(pathlib.Path(api.__file__).with_suffix(".pyi").read_text())
for cls in [api.Bundle, api.Payload, api.Mixed, api.ChainLink, api.TreeLeaf]:
    check(bool(typing.get_type_hints(cls)))
check(typing.get_type_hints(api.Ticket.retain)["return"] is api.Ticket)
check(api.BundleAlias is api.Bundle)

huge = (1 << 521) + (1 << 255) + 19
first = api.new_ticket(huge, "a\0雪🙂")
second = api.new_ticket(27, "second")
check(api.serial(first) == huge)
check(api.label(first) == "a\0雪🙂")
payload = api.Payload(-huge, b"\0\xffpayload")
bundle = api.Bundle(first, api.Some(second), (first, second), (second, first), payload)
tree = api.TreeBranch((api.TreeLeaf(first), api.TreeBranch((api.TreeLeaf(second),))))
chain = api.ChainLink(first, api.Some(api.ChainLink(second, None)))
mixed = api.Mixed(first, (None, api.Some(None), api.Some(api.Some(False)), api.Some(api.Some(True))),
                  api.Some(None), api.Ok(bundle), -huge, huge, "🙂", -0.0, 1.5,
                  b"\xff\0bytes", (0, (1 << 64) - 1), (second, (api.Some(first), payload)), chain)
state = runtime.current_state()

if sys.argv[2] == "malformed":
    # Fail on a later constructor after the ticket field has adopted a lease.
    original = n._types["Mixed"][1]
    failures = []
    def malformed(value, scope, output, depth=0):
        ticket = n._types["Ticket"][1](value.field0, scope, output, depth + 1)
        failures.append(ticket)
        value.field1 = None
        return original(value, scope, output, depth)
    setattr(n, original.__name__, malformed)
    try:
        api.echo_mixed(mixed)
    except n._OwnedInvalidNative as error:
        failures.append(error)
        check(failures[0].is_closed)
    else:
        raise AssertionError("Malformed native result was accepted")
    rejected(r.LeanBridgeError, lambda: api.serial(first), 7)
    state.close()
    check(live() == 0)
    check(identities() == 0)
    print(json.dumps({"checks": checks, "live": live(), "identities": identities()}))
    sys.exit(0)

check(api.echo_record(bundle) == bundle)
check(api.echo_alias(bundle) == bundle)
check(api.bundle(first, api.Some(second), (first, second), (second, first), payload) == bundle)
check(api.primary(bundle) == first)
check(api.payload(bundle) == payload)
check(api.echo_array([first, second]) == (first, second))
check(api.echo_list([second, first]) == (second, first))
check(api.echo_array([]) == ())
check(api.echo_list([]) == ())
check(api.echo_option(None) is None)
check(api.echo_option(api.Some(first)) == api.Some(first))
check(api.echo_result(api.Ok(bundle)) == api.Ok(bundle))
check(api.echo_result(api.Err(second)) == api.Err(second))
check(api.echo_tuple((first, (None, payload))) == (first, (None, payload)))
for value in [api.ChoiceEmpty(), api.ChoiceOne(first), api.ChoicePair(first, second), api.ChoiceMany((first, second))]:
    check(api.echo_variant(value) == value)
check(api.echo_row((None, api.Some(first), api.Some(second))) == (None, api.Some(first), api.Some(second)))
check(api.echo_recursive(tree) == tree)
check(api.echo_chain(chain) == chain)
check(api.echo_chain(api.ChainStop()) == api.ChainStop())
check(api.echo_nested(((None, api.Some(api.Ok(bundle)), api.Some(api.Err(first))), ())) == ((None, api.Some(api.Ok(bundle)), api.Some(api.Err(first))), ()))
check(api.echo_mixed(mixed) == mixed)
check(math.copysign(1.0, api.echo_mixed(mixed).precise) == -1.0)
check(api.echo_mixed(dataclasses.replace(mixed, approximate=1.00000001)).approximate == _c.c_float(1.00000001).value)
check(math.isnan(api.echo_mixed(dataclasses.replace(mixed, precise=math.nan)).precise))
check(api.echo_mixed(dataclasses.replace(mixed, unit=None, result=api.Err(first))).result == api.Err(first))

copied = api.echo_mixed(mixed)
check(copied is not mixed and copied.product is not mixed.product)
check(copied.ticket is not first and copied.ticket == first)
copied.ticket.close()
check(api.serial(first) == huge)
copied = None
gc.collect()

closure = api.make_record(bundle)
check(closure(True, dataclasses.replace(bundle, primary=second)) == bundle)
check(closure(False, dataclasses.replace(bundle, primary=second)).primary == second)
kept = closure.retain()
closure.close()
check(kept(True, bundle) == bundle)
kept.close()
rejected(r.LeanBridgeError, lambda: kept(True, bundle), 4)
recursive = api.make_recursive(tree)
check(recursive(True, api.TreeBranch(())) == tree)
recursive.close()
identity = api.identity_closure(None)
check(identity(bundle) == bundle)
identity.close()

for action in [lambda: api.new_ticket(True, "bad"), lambda: api.new_ticket(-1, "bad"),
               lambda: api.new_ticket(1, "\ud800"), lambda: api.echo_record({}),
               lambda: api.echo_result(bundle), lambda: api.echo_option(first),
               lambda: api.echo_tuple((first,)), lambda: api.serial(closure),
               lambda: api.echo_mixed(dataclasses.replace(mixed, scalar="ab")),
               lambda: api.echo_mixed(dataclasses.replace(mixed, scalar="\ud800")),
               lambda: api.echo_mixed(dataclasses.replace(mixed, precise=1)),
               lambda: api.echo_mixed(dataclasses.replace(mixed, words=(1 << 64,)))]:
    rejected((TypeError, ValueError), action)

cyclic = api.ChainLink(first, None)
object.__setattr__(cyclic, "next", api.Some(cyclic))
rejected(ValueError, lambda: api.echo_chain(cyclic))
deep = api.ChainStop()
for _ in range(130):
    deep = api.ChainLink(first, api.Some(deep))
rejected(n._OwnedLimit, lambda: api.echo_chain(deep), 2)
rejected(n._OwnedLimit, lambda: api.echo_array([first] * 262145), 2)
rejected(n._OwnedLimit, lambda: api.new_ticket(1, "x" * (16 * 1024 * 1024 + 1)), 2)

def raw_rejection(name, value, mutate):
    scope = n._OwnedScope(state)
    try:
        convert, decode, raw = n._types[name]
        view = convert(value, scope)
        view = view if type(view) is raw else raw(view)
        mutate(view)
        rejected(n._OwnedInvalidNative, lambda: decode(view, scope, n._OwnedOutput(None)), 9)
    finally:
        scope.close()

raw_rejection("bool", False, lambda view: setattr(view, "value", 2))
raw_rejection("unit", None, lambda view: setattr(view, "value", 1))
raw_rejection("char", "a", lambda view: setattr(view, "value", 0xd800))
raw_rejection("Choice", api.ChoiceEmpty(), lambda view: setattr(view, "kind", 999))
raw_rejection("string", "x", lambda view: setattr(view, "data", None))
raw_rejection("nat", 7, lambda view: setattr(n._owned_read(view.value, n._OwnedMpz), "size", -1))
raw_rejection("int", 7, lambda view: setattr(n._owned_read(view.value, n._OwnedMpz), "allocated", -1))

# Keep the exception tracebacks alive while checking cleanup. They may retain
# partially converted resource wrappers; those wrappers must already be closed.
failures = []
gc.collect()
baseline = live(), identities()
native_faults = 0
for point in range(1024):
    native_fail(point)
    try:
        result = api.echo_mixed(mixed)
    except r.LeanBridgeError as error:
        failures.append(error)
        check(error.status == 3)
        native_faults += 1
        check((live(), identities()) == baseline)
    else:
        result = None
        break
    finally:
        native_fail(-1)
check(10 < native_faults < 1024)
gc.collect()
check((live(), identities()) == baseline)

checkpoint = r._owned_checkpoint
python_faults = 0
for point in range(1024):
    remaining = point
    def fail_python():
        global remaining
        if remaining == 0:
            raise MemoryError("injected conversion allocation failure")
        remaining -= 1
    r._owned_checkpoint = fail_python
    try:
        result = api.echo_mixed(mixed)
    except MemoryError as error:
        failures.append(error)
        python_faults += 1
        check((live(), identities()) == baseline)
    else:
        result = None
        break
    finally:
        r._owned_checkpoint = checkpoint
check(30 < python_faults < 1024)
gc.collect()
check((live(), identities()) == baseline)
check(api.echo_mixed(mixed) == mixed)

state.close()
check(first.is_closed and second.is_closed)
check(live() == 0)
check(identities() == 0)
print(json.dumps({"checks": checks, "pythonFaults": python_faults, "nativeFaults": native_faults,
                  "live": live(), "identities": identities()}))
