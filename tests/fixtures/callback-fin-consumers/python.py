"""Installed Python acceptance for checked Fin callbacks and Lean closures."""
import lean_reviewedcallbacks as api


checks = 0
calls = 0


def check(value, label):
    global checks
    if not value:
        raise AssertionError(label)
    checks += 1


def reject(operation, kind=Exception):
    try:
        operation()
    except kind as error:
        return error
    raise AssertionError("expected rejection")


scaler = api.scaler(3)
check(scaler(4) == 12, "bounded closure argument")
check(isinstance(reject(lambda: scaler(10), api.LeanBridgeError),
                 api.LeanBridgeError), "Fin 10 is refused")
check(scaler(9) == 27, "closure remains usable")

counter = api.counter(8)
check(counter(4) == 2, "Lean-produced Fin result")


def host(value):
    global calls
    calls += 1
    if not 0 <= value < 5:
        raise AssertionError("Lean supplied an invalid Fin")
    return value


check(api.visit(host) == 10,
      "checked host callback arguments")
check(calls == 5, "host receives every Fin 5 value")
sentinel = RuntimeError("callback Fin sentinel")
check(reject(lambda: api.visit(
    lambda _value: (_ for _ in ()).throw(sentinel))) is sentinel,
    "callback exception identity")
check(api.apply(lambda value: value + 1, 2) == 3,
      "unrefined callback stays direct")

digits = api.digits(None)
check(digits([1, 2]) == 5, "nested Fin callback argument")
check(isinstance(reject(lambda: digits([3]), api.LeanBridgeError),
                 api.LeanBridgeError), "nested bound is refused")
check(digits([]) == 0, "nested closure remains usable")

tiles = api.tiles(None)
check(tiles([api.Tile(4, 2)]) == 402, "nominal Fin callback field")
check(isinstance(reject(lambda: tiles([api.Tile(5, 2)]),
                        api.LeanBridgeError), api.LeanBridgeError),
      "nominal Fin field is refused")

tile_maker = api.tile_maker(3)
check(tile_maker(4) == api.Tile(2, 4), "Lean-produced nominal Fin field")

for closure in [scaler, counter, digits, tiles, tile_maker]:
    closure.close()
    closure.close()
    check(closure.closed, "closure closes idempotently")

print(f"callback-fin-language-ok:{checks}")
