import json
import sys
import lean_recursive as lb
from lean_recursive import _native as native
import graph_checks as h

layout = json.loads(sys.argv[1])
index = layout["envelope"]["index"]
original_call = getattr(native, f"_fn{index}")
original_clear = native._graph_clear
calls = clears = 0


def invoke(*args):
    global calls
    calls += 1
    return original_call(*args)


def clear(output):
    global clears
    owned = output is not None and hasattr(output, "owner") and bool(output.owner)
    original_clear(output)
    if owned:
        h.check(not output.owner and not output.release)
        clears += 1


setattr(native, f"_fn{index}", invoke)
native._graph_clear = clear
faults = h.Faults()
h.check(native._graph_ready() == 0)
deep = lb.SpineLeaf(0)
for _ in range(128):
    deep = lb.SpineNext(deep)
h.rejects(ValueError, lambda: lb.spine(deep))
h.rejects(TypeError, lambda: lb.join_trees(h.tree_value(), lb.TreeLeaf(h.payload(u32=True))))
h.check(native._graph_ready() == 0 and calls == 0 and faults.attempts == 0)
faults.clean()
envelope = h.envelope_value()
faults.reset()
h.check(lb.envelope(envelope) == envelope)
checkpoints = faults.attempts
h.check(calls == clears == 1)
faults.clean()
input_failures = output_failures = 0
for checkpoint in range(1, checkpoints + 1):
    for error in [MemoryError, h.Interrupted]:
        before_calls, before_clears = calls, clears
        faults.reset(checkpoint, error)
        h.rejects(error, lambda: lb.envelope(envelope))
        faults.clean()
        h.check(calls - before_calls == clears - before_clears)
        h.check(native._graph_ready())
        if error is MemoryError:
            if calls == before_calls:
                input_failures += 1
            else:
                output_failures += 1
h.check(input_failures > 0 and output_failures > 0)
faults.reset()
h.check(lb.envelope(envelope) == envelope)
faults.clean()
h.check(calls == clears)
faults.restore()
native._graph_clear = original_clear
setattr(native, f"_fn{index}", original_call)
print(json.dumps({"checks": h.checks, "checkpoints": checkpoints,
                  "inputFailures": input_failures, "outputFailures": output_failures,
                  "ownedOutputs": clears, "exactlyOnceCleanup": calls == clears}))
