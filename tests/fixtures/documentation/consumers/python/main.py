from lean_alpha import (
    Box, DisposedResourceError, Payload, make_adder, round_trip, with_callback,
)


def require(condition):
    if not condition:
        raise RuntimeError("Unexpected Alpha result")


with Box(42) as box:
    require(box.read() == 42 and box.identity() is box)
box.close()  # Closing an already-closed resource is safe.
try:
    box.read()
except DisposedResourceError:
    pass
else:
    raise RuntimeError("A closed Box must reject reads")

value = round_trip(Payload(True, 41, "Lean λ", b"\x00\xff", (0, 2**32 - 1)))
require(not value.enabled and value.count == 42)
require(value.label == "Lean λ" and value.bytes == b"\x00\xff")
require(value.values == (0, 2**32 - 1))
require(with_callback(40, lambda current: current + 2) == 44)
with make_adder(2) as add_two:
    require(add_two(40) == 42)

print("Box: 42; payload: 42; callback: 44; closure: 42")
