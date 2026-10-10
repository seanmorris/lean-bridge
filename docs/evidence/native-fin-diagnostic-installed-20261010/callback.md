# Fresh C/C++ callback diagnostic acceptance

Producer: `659fa7057892517fdbdaf4e1be7e1907455bfdfe`, frozen throughout execution on 10 October 2026.

Both installed tests passed with zero failures or skips in 776.734 seconds. Each route reproduced its archives from two independent author roots, removed author/build roots before installation, and consumed the packages offline without Lean on the consumer path.

| Route | C checks | C++ checks | Dispatch measurement |
| --- | ---: | ---: | --- |
| Ordinary source | 297 | 283 | C public lease entry, checked adapter, and source body |
| Reviewed R1 | 266 | 260 | Not measured |

C++ dispatch is not measured on either route. The ordinary C report retains separate public rejection, raw-adapter rejection, valid-call, and recovery counts. Reviewed R1 covers host arguments to returned Lean closures and Lean-produced values. These tests do not establish reviewed R2 host-produced refined replies, other host profiles, or additional container-edge coverage.

The local native glibc floor was explicitly set to 2.36. This is not hosted 2.38 release-floor acceptance. The original harness removed temporary binary archives after execution; their exact digests and sizes remain in these reports. No prior report or support-table claim changes.

## Original files

| File | SHA-256 |
| --- | --- |
| `ordinary-callback.json` | `7178d216181f368bf2bfc42c740c6e38862b482f4ef333facc3fb0b9402895cb` |
| `reviewed-callback.json` | `1fa47d2bfdc4580af5abee9c00c558de9262488036762cb7162ab44d5eea97ad` |
| `callback.tap` | `7dcfbb6d078ef3a612311356c2c98c7800070cb45ca0ec594aeb614ff36fe648` |

The corresponding originals are `/app/build/vo1442-diagnostic-659fa70-callback-ordinary.json`, `/app/build/vo1442-diagnostic-659fa70-callback-reviewed.json`, and `/app/build/vo1442-diagnostic-659fa70-callback.tap`. Archived bytes are unchanged.

## Execution

From the frozen producer checkout:

```sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_FIN_CALLBACK_PROFILES=c,cpp \
LEAN_BRIDGE_REVIEWED_CALLBACK_FIN_PROFILES=c,cpp \
LEAN_BRIDGE_FIN_CALLBACK_REPORT=/app/build/vo1442-diagnostic-659fa70-callback-ordinary.json \
LEAN_BRIDGE_REVIEWED_CALLBACK_FIN_REPORT=/app/build/vo1442-diagnostic-659fa70-callback-reviewed.json \
taskset -c 3 node --test --test-concurrency=1 \
  --test-name-pattern='^(relocated source-free C and C\+\+ packages check leased-closure arguments and keep Lean-produced bounds|independently reviewed C and C\+\+ packages install R1 callback bounds from source-free archives)$' \
  tests/native-fin-callbacks.test.mjs tests/reviewed-callback-fin.test.mjs \
  > /app/build/vo1442-diagnostic-659fa70-callback.tap 2>&1
```
