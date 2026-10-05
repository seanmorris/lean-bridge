import dataclasses
import gc
import json
import math
import struct
import __PACKAGE__ as api

checks = 0

def check(value):
    global checks
    assert value
    checks += 1

def rejected(action):
    try:
        action()
    except (TypeError, ValueError):
        check(True)
    else:
        raise AssertionError("Invalid scalar was accepted")

def run():
    with api.new_ticket(42, "packet") as ticket:
        large = (1 << 128) + 1
        scalars = api.Scalars(None, True, "🌱", large, -large,
                              255, 65535, (1 << 32) - 1, (1 << 64) - 1,
                              -128, -32768, -(1 << 31), -(1 << 63),
                              (1 << 64) - 1, -(1 << 63), 1.5, -2.25,
                              "A\0🌱", b"\0\xff\x01")
        packet = api.Packet(ticket, scalars, api.Some(api.Some(None)), api.Empty())
        check(api.inspect(packet))
        check(api.make_packet(ticket) == packet)
        check(api.echo(packet) == packet)
        check(len(dataclasses.fields(scalars)) == 19)
        for field in dataclasses.fields(scalars):
            check(getattr(api.make_packet(ticket).scalars, field.name) == getattr(scalars, field.name))
        for index, optional in enumerate((None, api.Some(None), api.Some(api.Some(None)))):
            changed = dataclasses.replace(packet, optional=optional)
            check(api.option_case(changed) == index)
            check(api.echo(changed) == changed)

        def with_field(name, value):
            return dataclasses.replace(packet, scalars=dataclasses.replace(scalars, **{name: value}))
        for name, minimum, maximum in (
            ("u8", 0, 255), ("u16", 0, 65535), ("u32", 0, (1 << 32) - 1),
            ("u64", 0, (1 << 64) - 1), ("i8", -128, 127), ("i16", -32768, 32767),
            ("i32", -(1 << 31), (1 << 31) - 1), ("i64", -(1 << 63), (1 << 63) - 1),
            ("word", 0, (1 << 64) - 1), ("signed_word", -(1 << 63), (1 << 63) - 1),
        ):
            for value in (minimum, maximum, 0, 1):
                changed = with_field(name, value)
                check(api.echo(changed) == changed)
            for bad in (minimum - 1, maximum + 1, True, 1.0):
                rejected(lambda: api.echo(with_field(name, bad)))
        for name in ("natural", "integer"):
            for value in (0, 1, (1 << 2048) + 3):
                check(api.echo(with_field(name, value)) == with_field(name, value))
            rejected(lambda: api.echo(with_field(name, True)))
        check(api.echo(with_field("integer", -(1 << 2048))).scalars.integer == -(1 << 2048))
        rejected(lambda: api.echo(with_field("natural", -1)))
        for name, bad in (("unit", 0), ("flag", 1), ("char", ""), ("char", "\udfff"),
                          ("text", "\ud800"), ("bytes_", bytearray(b"x")), ("f32", 1), ("f64", True)):
            rejected(lambda: api.echo(with_field(name, bad)))
        for character in ("\0", "\ud7ff", "\ue000", "\U0010ffff"):
            check(api.echo(with_field("char", character)).scalars.char == character)
        for value in (0.0, -0.0, 1.00000001, math.inf, -math.inf):
            check(api.bits32(with_field("f32", value)) == struct.unpack("<I", struct.pack("<f", value))[0])
            check(api.bits64(with_field("f64", value)) == struct.unpack("<Q", struct.pack("<d", value))[0])
        check(math.isnan(api.echo(with_field("f32", math.nan)).scalars.f32))
        check(math.isnan(api.echo(with_field("f64", math.nan)).scalars.f64))
        check(api.units([]) == ())
        check(api.units([None] * 31) == (None,) * 31)
    check(ticket.is_closed)

run()
gc.collect()
print(json.dumps({"checks": checks, "primitives": 19, "ordinaryImport": True}))
