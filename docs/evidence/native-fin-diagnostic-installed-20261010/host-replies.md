# Fresh C/C++ host-reply diagnostic acceptance

Producer: `4007e0d1926a0a2206e8b49c26f82b474aca0c0f`, frozen throughout execution on 10 October 2026.

The installed ordinary-source test passed without failures or skips in 414.318 seconds. Two independent author roots reproduced the archives. The harness removed author/build roots before offline, compiler-free installation. C executed 81 checks; C++ executed 74. Both consumers recorded fork status 5 and zero host calls in the forked child.

These are uninstrumented installed packages and consumers. The reports do not establish source-entry counts, sanitizer coverage, reviewed R2 host replies, other language profiles, or hosted release-floor acceptance. The local glibc floor was 2.36. The harness removed temporary binary archives after execution; their digests and sizes remain in the original report.

| Original | SHA-256 |
| --- | --- |
| `host-replies.json` | `f9b51208677699c8fb19c2e6ee4aee2e7b30d295fc912fed39b815a5bd6b669f` |
| `host-replies.tap` | `b57ae706c5ec57e8bf78d1987825edeb65226375497193e18c993dfb8418ebe4` |

Both files are unchanged copies of `/app/build/vo1442-diagnostic-4007e0d-replies.json` and `/app/build/vo1442-diagnostic-4007e0d-replies.tap`. The archive test reconstructs the generated C macro names, authenticates both complete consumers, checks the complete report, and rejects broadened or altered claims. No previous evidence or support-table entry changes.

## Execution

From the frozen producer checkout:

```sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_FIN_REPLY_PROFILES=c,cpp \
LEAN_BRIDGE_FIN_REPLY_REPORT=/app/build/vo1442-diagnostic-4007e0d-replies.json \
taskset -c 3 node --test --test-concurrency=1 \
  --test-name-pattern='^relocated source-free C and C\+\+ packages check every host reply bound and recover$' \
  tests/native-fin-callbacks.test.mjs \
  > /app/build/vo1442-diagnostic-4007e0d-replies.tap 2>&1
```
