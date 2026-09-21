"""Strict type checks use only the installed public module and its stub."""
from typing import assert_type
import lean_aliases as api

assert_type(api.echo_unit(None), api.AUnit)
assert_type(api.echo_bool(True), api.ABool)
assert_type(api.echo_uint8(255), api.AU8)
assert_type(api.echo_uint16(65535), api.AU16)
assert_type(api.echo_uint32(2**32 - 1), api.AU32)
assert_type(api.echo_uint64(2**64 - 1), api.AU64)
assert_type(api.echo_int8(-128), api.AI8)
assert_type(api.echo_int16(-32768), api.AI16)
assert_type(api.echo_int32(-(2**31)), api.AI32)
assert_type(api.echo_int64(-(2**63)), api.AI64)
assert_type(api.echo_nat(2**5120), api.ANat)
assert_type(api.echo_int(-(2**5120)), api.AInt)
assert_type(api.echo_float32(1.25), api.AF32)
assert_type(api.echo_float64(-1.25), api.AF64)
assert_type(api.echo_string("a\0🌱"), api.AText)
assert_type(api.echo_bytes(b"\0\xff"), api.ABytes)
assert_type(api.echo_char("🌱"), api.AChar)
assert_type(api.echo_usize(2**64 - 1), api.AWord)
assert_type(api.echo_isize(-(2**63)), api.ASignedWord)

count: api.Count = 3
other: api.OtherCount = api.increment(count)
assert_type(other, int)
assert_type(api.make(), api.Count)
assert_type(api.label(), api.AText)
rows: api.Rows = ((1, 2), ())
assert_type(api.reverse_rows(rows), api.Rows)
assert_type(api.reverse_rows([[1, 2], []]), api.Rows)
assert_type(api.echo_maybe(api.Some(api.Some(None))), api.Maybe)
assert_type(api.echo_outcome(api.Ok((3, b"x"))), api.Outcome)
assert_type(api.echo_outcome(api.Err("error")), api.Outcome)

packet: api.PacketView = api.Packet(count, "text", [[1, 2]], api.Some(None), api.Ok((7, b"x")))
packets: api.Packets = (packet,)
assert_type(api.change_packet(packet), api.PacketView)
assert_type(api.reverse_packets(packets), api.Packets)
assert_type(api.reverse_packets([packet]), api.Packets)
assert_type(packet.count, api.Count)
assert_type(packet.text, api.AText)
assert_type(packet.maybe, api.Maybe)
assert_type(packet.outcome, api.Outcome)

scalars: api.ScalarsView = api.Scalars(None, True, 255, 65535, 2**32 - 1,
                                    2**64 - 1, -128, -32768, -(2**31), -(2**63),
                                    2**5120 + 19, -(2**5120 + 31), 1.5, -2.25,
                                    "A\0🌱", b"\0\xff\1", "🌱", 2**32 - 1, -(2**31))
assert_type(api.echo_scalars(scalars), api.ScalarsView)
assert_type(api.inspect(scalars), bool)
assert api.inspect(scalars)
