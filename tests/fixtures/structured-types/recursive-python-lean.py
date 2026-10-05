import ctypes as c
import dataclasses
import json
import math
import sys
import graph as lb
import graph_checks as h

native = c.CDLL(sys.argv[1])
reset = h.bind(native, "python_native_reset", [c.c_size_t, c.c_size_t], None)
live = h.bind(native, "python_native_live")
attempts = h.bind(native, "python_native_attempts")
decodes = h.bind(native, "python_native_decodes")
initialize = h.bind(native, "python_native_initialize", result=c.c_uint32)
ready = h.bind(native, "python_native_ready", result=c.c_int)
retire = h.bind(native, "python_native_retire", result=None)
hold = h.bind(native, "python_native_hold", result=c.c_uint32)
release = h.bind(native, "python_native_release", result=None)
detach = h.bind(native, "python_native_detach", result=None)
lifecycle = (initialize, ready, retire)
calls = {name: h.call_binding(native, name, "recursive_" + name + "_graph", lifecycle) for name in lb._roots}
faults = h.Faults()


def clean():
    h.check(live() == 0)
    faults.clean()


reset(0, 0)
h.check(ready() == 0)
too_deep = lb.SpineLeaf(0)
for _ in range(128):
    too_deep = lb.SpineNext(too_deep)
h.rejects(lb._GraphLimit, lambda: calls["spine"](too_deep))
h.rejects(TypeError, lambda: calls["join_trees"](h.tree_value(), lb.TreeLeaf(h.payload(u32=True))))
h.check(ready() == 0 and decodes() == 0 and faults.attempts == 0)
clean()
scalar = h.payload()
h.check(calls["inspect"](scalar))  # Lean independently checks all nineteen fields.
h.check(calls["scalars"](scalar) == scalar)
h.check(calls["word_max"]((1 << 64) - 1))
h.check(calls["signed_min"](-(1 << 63)))
for value in [h.payload(natural=(1 << 1000) + 7, integer=-((1 << 1000) + 7)),
              h.payload(natural=0, integer=0, text="", bytes_=b""),
              h.payload(f32=-math.inf, f64=math.inf)]:
    h.check(calls["scalars"](value) == value)
special = calls["scalars"](h.payload(f32=math.nan, f64=-0.0))
h.check(math.isnan(special.f32) and math.copysign(1, special.f64) == -1)
clean()
tree = h.tree_value()
h.check(calls["tree"](tree) == tree)
h.check(calls["empty"]() == lb.TreeBranch(()))
h.check(calls["join_trees"](tree, tree) == lb.TreeBranch((tree, tree)))
h.check(calls["forest"]([tree] * 512) == (tree,) * 512)
input_list = [lb.TreeBranch([])]
copied = calls["tree"](lb.TreeBranch(input_list))
input_list[0].children.append(lb.TreeLeaf(scalar))
h.check(copied == lb.TreeBranch((lb.TreeBranch(()),)))
envelope = h.envelope_value()
for marker in [None, lb.Some(None), lb.Some(lb.Some(None))]:
    for outcome in [lb.Ok((tree, tree)), lb.Err("error\0🌱")]:
        value = dataclasses.replace(envelope, marker=marker, outcome=outcome, fallback=None)
        h.check(calls["envelope"](value) == value)
left = lb.LeftTreeNext(lb.RightTreeMany((lb.LeftTreeLeaf(9),)))
h.check(calls["left"](left) == left)
h.check(calls["right"](lb.RightTreeMany((left,))) == lb.RightTreeMany((left,)))
spine = lb.SpineLeaf(41)
for _ in range(127):
    spine = lb.SpineNext(spine)
copy = calls["spine"](spine)
a, b = spine, copy
for _ in range(127):
    h.check(a is not b)
    a, b = a.value, b.value
h.check(a.value == b.value == 41)
h.rejects(lb.LeanBridgeError, lambda: calls["grow"](spine), 2)
h.check(calls["grow"](lb.SpineLeaf(7)) == lb.SpineNext(lb.SpineLeaf(7)))
wide = lb.WideNext(**{f"field{i}": i for i in range(255)}, child=lb.WideLeaf(17))
h.check(calls["wide"](wide) == wide)
for marker in [lb.MarkerEmpty(), lb.MarkerUnit(None), lb.MarkerNext(lb.MarkerEmpty())]:
    h.check(calls["marker"](marker) == marker)
h.check(calls["empty_record"](lb.EmptyRecord()) == lb.EmptyRecord())
h.check(calls["units"]([None] * 123) == (None,) * 123)
h.rejects(ValueError, lambda: calls["never"](object()))
clean()

reset(0, 0)
faults.reset()
h.check(calls["envelope"](envelope) == envelope)
native_count, python_count = attempts(), faults.attempts
clean()
for fail in range(1, native_count + 1):
    reset(fail, 0)
    faults.reset()
    h.rejects(lb.LeanBridgeError, lambda: calls["envelope"](envelope), 3)
    clean()
    h.check(ready())
input_failures = output_failures = 0
for fail in range(1, python_count + 1):
    for error in [MemoryError, h.Interrupted]:
        reset(0, 0)
        faults.reset(fail, error)
        h.rejects(error, lambda: calls["envelope"](envelope))
        if error is MemoryError:
            if decodes():
                output_failures += 1
            else:
                input_failures += 1
        clean()
        h.check(ready())
h.check(input_failures > 0 and output_failures > 0)
reset(0, 0)
faults.reset()
h.check(calls["envelope"](envelope) == envelope)
clean()

# Retirement cannot invalidate another already-owned output's release function.
h.check(hold() == 0)
retained = live()
h.check(retained > 0)
mode = sys.argv[2]
if mode == "carrier":
    reset(0, 1)
    h.rejects(lb._GraphInvalidNative, lambda: calls["tree"](tree), 4)
else:
    invoke = native.recursive_tree_graph

    def corrupt(input_value, output):
        status = invoke(input_value, output)
        if mode == "raw":
            c.cast(output, c.POINTER(h.raw_type("Tree"))).contents.kind = (1 << 32) - 1
        elif mode == "during":
            retire()
        else:
            raise AssertionError("Unknown retirement probe")
        return status

    h.rejects(lb.LeanBridgeError,
              lambda: lb._graph_call_tree(corrupt, tree, lifecycle=lifecycle),
              4 if mode == "raw" else 5)
h.check(not ready() and live() == retained)
faults.clean()
reset(0, 0)
h.rejects(lb.LeanBridgeError, lambda: calls["envelope"](envelope), 5)
h.check(decodes() == 0 and live() == retained)
faults.clean()
release()
release()
detach()
clean()
faults.restore()
print(json.dumps({"checks": h.checks, "nativeCheckpoints": native_count, "pythonCheckpoints": python_count,
                  "inputFailures": input_failures, "outputFailures": output_failures,
                  "python": sys.version.split()[0]}))
