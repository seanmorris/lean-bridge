"""Independent host values, not generated from the adapter's type model."""
import dataclasses

import lean_structured as api

SHAPES = ("array", "list", "option", "result", "tuple", "record", "variant", "alias")


def owned(value):
    if type(value) in (tuple, list):
        return tuple(owned(item) for item in value)
    if dataclasses.is_dataclass(value):
        return type(value)(**{field.name: owned(getattr(value, field.name))
                              for field in dataclasses.fields(value)})
    return value


def payload(shape, seed):
    text = ("", "a\0λ🌿", "\U0010ffff", "e\u0301")[seed % 4] + str(seed)
    rows = [] if seed % 5 == 0 else [None, api.Some(text), api.Some(""), api.Some("\0")]
    huge = (1 << (256 + seed)) + (1 << 64) + seed
    if shape == "array":
        return rows
    if shape == "list":
        return [] if seed % 5 == 0 else [api.Ok((2**32 - 1, text)), api.Err(text),
                                         api.Ok((seed, "")), api.Err("")]
    if shape == "option":
        return (None, api.Some(None), api.Some(api.Some(None)))[seed % 3]
    if shape == "result":
        return (api.Ok(None), api.Ok(api.Some(seed)), api.Err([text, "", "\0"]),
                api.Err([]))[seed % 4]
    if shape == "tuple":
        return (text, (b"" if seed % 2 == 0 else b"\0\xff\x80" + bytes(range(256)), huge))
    if shape in ("record", "alias"):
        nested = (None, api.Some(api.Ok((2**64 - 1, None))), api.Some(api.Err(text)))[seed % 3]
        return api.Payload(text, rows, huge, nested)
    if shape == "variant":
        return (api.PacketEmpty(), api.PacketPayload(text, rows), api.PacketCounts(huge, -huge))[seed % 3]
    raise AssertionError(shape)
