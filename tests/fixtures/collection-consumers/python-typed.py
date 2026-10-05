"""Type-check and execute ordinary Python calls against installed stubs."""
from typing import assert_type

import lean_collections as api

D1 = tuple[int, ...]
D2 = tuple[D1, ...]
D3 = tuple[D2, ...]
D4 = tuple[D3, ...]
D5 = tuple[D4, ...]
D6 = tuple[D5, ...]
D7 = tuple[D6, ...]
D8 = tuple[D7, ...]
D9 = tuple[D8, ...]
D10 = tuple[D9, ...]
D11 = tuple[D10, ...]
D12 = tuple[D11, ...]
D13 = tuple[D12, ...]
D14 = tuple[D13, ...]
D15 = tuple[D14, ...]
D16 = tuple[D15, ...]
D17 = tuple[D16, ...]
D18 = tuple[D17, ...]
D19 = tuple[D18, ...]
D20 = tuple[D19, ...]
D21 = tuple[D20, ...]
D22 = tuple[D21, ...]
D23 = tuple[D22, ...]
D24 = tuple[D23, ...]

record = api.Primitives(None, True, 1, 2, 3, 4, -1, -2, -3, -4, 1 << 200, -(1 << 200),
                        1.5, -0.0, "A\0🌱", b"\0\xff", "🌱", 19, -19)
assert_type(record.bytes_, bytes)
assert_type(record.char_, str)
packet = api.Packet("parcel", [[record], (), [record, record]], api.Empty(), api.Single(7), api.Count(1 << 200),
                    api.Pair(11, "p"), api.Reversed("r", 13))
changed = assert_type(api.record_shuffle(packet), api.Packet)
assert changed.single.value == 8 and changed.pair.first == 12
assert_type(api.record_reverse([record]), tuple[api.Primitives, ...])
assert_type(api.array_reverse_unit([[None], ()]), tuple[tuple[None, ...], ...])
assert_type(api.array_reverse_bool([[True], (False,)]), tuple[tuple[bool, ...], ...])
assert_type(api.array_reverse_uint32([[1, 2], (3,)]), tuple[tuple[int, ...], ...])
assert_type(api.array_reverse_float32([[1.5], (-0.0,)]), tuple[tuple[float, ...], ...])
assert_type(api.array_reverse_string([["A\0🌱"], ()]), tuple[tuple[str, ...], ...])
assert_type(api.array_reverse_bytes([[b"\0\xff"], ()]), tuple[tuple[bytes, ...], ...])
assert_type(api.array_reverse_char([["🌱"], ()]), tuple[tuple[str, ...], ...])
assert_type(api.array_add(1, [[1 << 200], ()]), tuple[tuple[int, ...], ...])
assert_type(api.array_total([[1 << 200], ()]), int)
assert_type(api.generate(3), tuple[None, ...])
assert_type(api.record_duplicate(packet), tuple[api.Packet, ...])
assert_type(api.record_empty(api.Empty()), api.Empty)
assert_type(api.record_single(api.Single(7)), api.Single)
assert_type(api.record_count(api.Count(1 << 200)), api.Count)
assert_type(api.record_make(), api.Pair)

# A concrete deep value exercises exact nested input checking, not only an empty array.
deep: D24 = ((((((((((((((((((((((((42,),),),),),),),),),),),),),),),),),),),),),),),)
assert assert_type(api.deep(deep), D24) == deep
assert assert_type(api.deep([]), D24) == ()
assert assert_type(api.deep([[[[[[[[[[[[[[[[[[[[[[[[42]]]]]]]]]]]]]]]]]]]]]]]]), D24) == deep
