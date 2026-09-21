from typing import assert_never
import lean_variants as lb


def describe(value: lb.Signal) -> str:
    match value:
        case lb.SignalData(count, label):
            return str(count) + label
        case lb.SignalIdle():
            return "idle"
        case lb.SignalStopped():
            return "stopped"
        case lb.SignalMarker():
            return "marker"
    assert_never(value)


signal: lb.Signal = lb.SignalData(3, "typed")
result: lb.Signal = lb.echo(signal)
assert describe(result) == "3typed"
packet = lb.Packet(signal, [lb.SignalIdle()], lb.Some(lb.SignalMarker(None)), [lb.ModeFirst()])
nested: lb.Nested = lb.echo_nested(lb.NestedPacket(packet))
assert isinstance(nested, lb.NestedPacket)
assert isinstance(nested.value.current, lb.SignalData)
assert nested.value.current.count == 3
outcome: lb.Nested = lb.echo_nested(lb.NestedOutcome(lb.Ok((lb.SignalIdle(), lb.ModeThird()))))
assert isinstance(outcome, lb.NestedOutcome)
empty: lb.Buffers = lb.echo_buffers(lb.BuffersEmpty())
assert isinstance(empty, lb.BuffersEmpty)
single: lb.One = lb.echo_one(lb.OneOnly(9))
assert single.value == 10
anonymous: lb.Anonymous = lb.echo_anonymous(lb.AnonymousCollision(7, "text"))
assert isinstance(anonymous, lb.AnonymousCollision)
assert anonymous.arg1 == 7 and anonymous.arg1_ == "text"
