"""Each statement must fail static checking against the installed API."""
import lean_collections as api

api.array_reverse_uint32([["wrong"]])
api.array_reverse_bytes([["text"]])
api.array_reverse_string([[b"bytes"]])
api.array_reverse_unit([[0]])
api.array_reverse_char([[65]])
api.record_count(api.Single(1))
api.record_single(api.Count(1))
api.record_reverse([api.Pair(1, "x")])
api.record_duplicate(api.Empty())
api.deep([[[[[[[[[[[[[[[[[[[[[[[["wrong"]]]]]]]]]]]]]]]]]]]]]]]])
pair = api.Pair(1, "x")
pair.first = 2
api.Pair("wrong", 1)
