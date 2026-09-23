import ctypes as c
import dataclasses
import json
import math
import sys
import graph as lb
import graph_checks as h

native = c.CDLL(sys.argv[1])
reset = h.bind(native, "graph_fixture_reset", [c.c_uint], None)
live = h.bind(native, "graph_fixture_live", result=c.c_uint)
clears = h.bind(native, "graph_fixture_clears", result=c.c_uint)
calls = h.bind(native, "graph_fixture_calls", result=c.c_uint)
layout_count = h.bind(native, "graph_fixture_layout_count")
layout_item = h.bind(native, "graph_fixture_layout", [c.c_size_t])
h.check(layout_count() == len(lb._layout_values))
for i, expected in enumerate(lb._layout_values):
    h.check(layout_item(i) == expected)

echo = {name: h.call_binding(native, name, "graph_fixture_" + symbol) for name, symbol in [
    ("scalars", "scalars"), ("tree", "tree"), ("spine", "spine"), ("marker", "marker"),
    ("envelope", "envelope"), ("echo_link", "link"), ("echo_result_link", "result_link")
]}
reset(0)
out = echo["scalars"](h.payload())
h.check(out == h.payload(natural=(1 << 1000) + 7, integer=-((1 << 1000) + 7), f32=math.inf,
                         f64=-0.0, text="a\0🌿", bytes_=b"\0\xff\x80", char_="🌿",
                         word=(1 << 64) - 1, signed_word=-(1 << 63)))
h.check(math.copysign(1, out.f64) == -1)
h.check(clears() == 1 and live() == 0)

# C owns the output arena. No Python output may retain the raw views or buffers.
values = {"tree": h.tree_value(), "spine": lb.SpineNext(lb.SpineLeaf(8)),
          "marker": lb.MarkerNext(lb.MarkerUnit(None)), "envelope": h.envelope_value(),
          "echo_link": lb.Link(lb.Some(lb.Link(None))),
          "echo_result_link": lb.ResultLink(lb.Ok(lb.ResultLink(lb.Err("end\0🌱"))))}
for name, value in values.items():
    reset(0)
    result = echo[name](value)
    h.check(result == value and result is not value)
    h.check(clears() == 1 and live() == 0)
    h.check(echo[name](value) == value)

for name, value in [("LeftTree", lb.LeftTreeNext(lb.RightTreeMany((lb.LeftTreeLeaf(8),)))),
                    ("RightTree", lb.RightTreeMany(())), ("EmptyRecord", lb.EmptyRecord()),
                    ("Marker", lb.MarkerEmpty()), ("Marker", lb.MarkerUnit(None)),
                    ("Wide", lb.WideNext(**{f"field{i}": i for i in range(255)}, child=lb.WideLeaf(7)))]:
    h.check(h.roundtrip(name, value) == value)
for marker in [None, lb.Some(None), lb.Some(lb.Some(None))]:
    for outcome in [lb.Ok((h.tree_value(), h.tree_value())), lb.Err("error\0🌱")]:
        envelope = dataclasses.replace(h.envelope_value(), fallback=None, outcome=outcome, marker=marker)
        h.check(echo["envelope"](envelope) == envelope)
for value in [0.0, -0.0, math.inf, -math.inf, math.nan, 1.23456789]:
    copy = h.roundtrip("Scalars", h.payload(f32=value, f64=value))
    h.check(math.isnan(copy.f32) if math.isnan(value) else copy.f32 == c.c_float(value).value)
    h.check(math.isnan(copy.f64) if math.isnan(value) else copy.f64 == value)
h.check(h.roundtrip("Scalars", h.payload(natural=0, integer=0, text="", bytes_=b"", char_="\0")) ==
        h.payload(natural=0, integer=0, text="", bytes_=b"", char_="\0"))
for signed in [False, True]:
    for bits in [8, 16, 32, 64]:
        name = ("int" if signed else "uint") + str(bits)
        minimum, maximum = (-(1 << (bits - 1)), (1 << (bits - 1)) - 1) if signed else (0, (1 << bits) - 1)
        for value in [minimum, 0, 1, maximum]:
            h.check(h.roundtrip(name, value) == value)
        for value in [minimum - 1, maximum + 1]:
            h.rejects(ValueError, lambda: h.roundtrip(name, value))
for value in [False, True]:
    scope = lb._GraphScope()
    h.check(h.input_value("bool", value, scope) == int(value))
    h.check(h.output_value("bool", int(value), scope) is value)
    scope.close()
for value in ["\0", "a", "é", "🌱", "\U0010ffff"]:
    h.check(h.roundtrip("char", value) == value)
scope = lb._GraphScope()
h.rejects(lb._GraphInvalidNative, lambda: h.output_value("char", 0x110000, scope))
scope.close()

class ScalarSubclass(lb.Scalars):
    pass

h.rejects(TypeError, lambda: h.roundtrip("Scalars", ScalarSubclass(*[
    getattr(h.payload(), field.name) for field in dataclasses.fields(lb.Scalars)])))

# Every argument validates before input allocation or lifecycle initialization.
faults = h.Faults()
initialized = []
bad = lb.TreeLeaf(h.payload(u32=True))
reject_invoke = lambda *args: (_ for _ in ()).throw(AssertionError("native call reached"))
lifecycle = (lambda: initialized.append(True) or 0, lambda: True, lambda: None)
h.rejects(TypeError, lambda: lb._graph_call_join_trees(reject_invoke, h.tree_value(), bad, lifecycle=lifecycle))
h.check(not initialized and faults.attempts == 0)
bad_inputs = [("unit", 0), ("bool", 1), ("char", ""), ("char", "ab"), ("char", "\ud800"),
              ("uint8", 256), ("uint16", -1), ("uint32", 1.0), ("uint64", 1 << 64),
              ("int8", -129), ("int16", 32768), ("int32", True), ("int64", 1 << 63),
              ("usize", -1), ("isize", 1 << 63), ("nat", -1), ("int", True),
              ("float32", 1), ("float64", "1"), ("string", "\udfff"), ("bytes", bytearray(b"x")),
              ("Scalars", {}), ("Tree", object()), ("Never", object())]
for name, value in bad_inputs:
    h.rejects((TypeError, ValueError), lambda: h.roundtrip(name, value))
cycle = lb.SpineNext(lb.SpineLeaf(0))
object.__setattr__(cycle, "value", cycle)
h.rejects(ValueError, lambda: echo["spine"](cycle))
children = []
cycle = lb.TreeBranch(children)
children.append(cycle)
h.rejects(ValueError, lambda: echo["tree"](cycle))
for name, value, wrapper in [("echo_link", lb.Link(None), lb.Some),
                             ("echo_result_link", lb.ResultLink(lb.Err("end")), lb.Ok)]:
    object.__setattr__(value, "next", wrapper(value))
    h.rejects(ValueError, lambda: echo[name](value))
too_deep = lb.SpineLeaf(0)
for _ in range(128):
    too_deep = lb.SpineNext(too_deep)
h.rejects(lb._GraphLimit, lambda: echo["spine"](too_deep))
h.rejects(lb._GraphLimit, lambda: echo["tree"](lb.TreeBranch([lb.TreeBranch(())] * 262144)))
h.rejects(lb._GraphLimit, lambda: echo["scalars"](h.payload(text="x" * (16 * 1024 * 1024))))
h.rejects(lb._GraphLimit, lambda: lb._graph_text_size("🌱", 3))
h.rejects(lb._GraphLimit, lambda: lb._graph_text_size("ab", 1))
h.check(lb._graph_text_size("A\0🌱", 6) == 6)
# The same scope charges inputs and outputs, not a fresh allowance per direction.
reset(0)
h.rejects(lb._GraphLimit, lambda: echo["tree"](lb.TreeLeaf(h.payload(bytes_=b"x" * (6 * 1024 * 1024)))))
h.check(calls() == 1 and clears() == 1 and live() == 0)
scope = lb._GraphScope()
scope.storage = 1
h.rejects(lb._GraphLimit, lambda: h.input_value("Tree", h.tree_value(), scope))
scope.close()
scope = lb._GraphScope()
scope.nodes = 1
h.rejects(lb._GraphLimit, lambda: h.input_value("Tree", h.tree_value(), scope))
scope.close()
scope = lb._GraphScope()
raw = h.input_value("Scalars", h.payload(), scope)
scope.native = c.sizeof(raw)
h.rejects(lb._GraphLimit, lambda: h.output_value("Scalars", raw, scope))
scope.close()
del raw
del scope
h.check(live() == 0)
faults.clean()

# Malformed fields come from known-readable C memory, never arbitrary addresses.
for mode in [2, 3, 4, 5, 6, 7, 8]:
    reset(mode)
    h.rejects(lb._GraphInvalidNative, lambda: echo["scalars"](h.payload()), 4)
    h.check(clears() == 1 and live() == 0)
reset(9)
h.rejects(lb._GraphLimit, lambda: echo["scalars"](h.payload()))
h.check(clears() == 1 and live() == 0)
for mode in [12, 13]:
    reset(mode)
    h.rejects(lb._GraphInvalidNative, lambda: echo["envelope"](h.envelope_value()), 4)
    h.check(clears() == 1 and live() == 0)
for status in [1, 2, 3, 4, 5, 99]:
    reset(100 + status)
    h.rejects(lb.LeanBridgeError, lambda: echo["scalars"](h.payload()), status if status in (1, 2, 3, 5) else 4)
    h.check(clears() == 1 and live() == 0)
for pointer, length, raw in [(0, 1, c.c_uint8), (1, 1, c.c_uint32),
                             ((1 << 64) - 8, 3, c.c_uint32), (8, 1 << 63, c.c_uint8)]:
    h.rejects(lb._GraphInvalidNative, lambda: lb._graph_span(pointer, length, raw))
h.check(lb._graph_span(1, 0, c.c_uint32) == 0)
scope = lb._GraphScope()
raw = h.input_value("Spine", lb.SpineNext(lb.SpineLeaf(3)), scope)
raw.cases.case0.field0 = c.addressof(raw)
h.rejects(lb._GraphInvalidNative, lambda: h.output_value("Spine", raw, scope))
raw.cases.case0.field0 = None
h.rejects(lb._GraphInvalidNative, lambda: h.output_value("Spine", raw, scope))
scope.close()
del scope, raw
raw = h.raw_type("Never")()
scope = lb._GraphScope()
h.rejects(lb._GraphInvalidNative, lambda: h.output_value("Never", raw, scope))
scope.close()
del scope, raw
faults.clean()

# Inject both ordinary allocation failure and a BaseException at every Python
# checkpoint. The native root must clear once, including errors after return.
reset(0)
faults.reset()
h.check(echo["envelope"](h.envelope_value()) == h.envelope_value())
count = faults.attempts
h.check(count > 20)
faults.clean()
input_failures = output_failures = 0
for fail in range(1, count + 1):
    for error in [MemoryError, h.Interrupted]:
        reset(0)
        faults.reset(fail, error)
        h.rejects(error, lambda: echo["envelope"](h.envelope_value()))
        h.check(live() == 0 and clears() == calls())
        if error is MemoryError:
            if calls():
                output_failures += 1
            else:
                input_failures += 1
        faults.clean()
h.check(input_failures > 0 and output_failures > 0)
faults.reset()
reset(0)
h.check(echo["envelope"](h.envelope_value()) == h.envelope_value())
faults.clean()
faults.restore()

# Retire corrupt results, and check readiness immediately before publication.
retired = []
lifecycle = (lambda: 0, lambda: not retired, lambda: retired.append(True))
reset(2)
guarded = h.call_binding(native, "scalars", "graph_fixture_scalars", lifecycle)
h.rejects(lb._GraphInvalidNative, lambda: guarded(h.payload()))
h.check(retired == [True] and live() == 0)
reset(0)
guarded = h.call_binding(native, "tree", "graph_fixture_tree", (lambda: 0, lambda: False, lambda: None))
h.rejects(lb.LeanBridgeError, lambda: guarded(h.tree_value()), 5)
h.check(clears() == 1 and live() == 0)
import graph_builtin_names as collision
scope = collision._GraphScope()
value = collision.idNext(collision.idLeaf(7))
put, get, raw = collision._types["id"]
h.check(get(put(value, scope), scope) == value)
scope.close()
for name, value in [("scope", collision.scope(collision.Some(collision.scope(None)))),
                    ("value", collision.value(collision.Ok(collision.value(collision.Err("done")))) )]:
    scope = collision._GraphScope()
    put, get, raw = collision._types[name]
    h.check(get(put(value, scope), scope) == value)
    scope.close()
scalar = collision.UnicodeDecodeError(*[getattr(h.payload(), field.name) for field in dataclasses.fields(lb.Scalars)])
raw = collision._types["UnicodeDecodeError"][2]
fn = h.bind(native, "graph_fixture_scalars", [c.POINTER(raw), c.POINTER(raw)], c.c_uint32)
reset(4)
h.rejects(collision._GraphInvalidNative, lambda: collision._graph_call_scalars(fn, scalar))
h.check(clears() == 1 and live() == 0)
print(json.dumps({"checks": h.checks, "layoutChecks": len(lb._layout_values), "checkpoints": count,
                  "inputFailures": input_failures, "outputFailures": output_failures,
                  "python": sys.version.split()[0]}))
