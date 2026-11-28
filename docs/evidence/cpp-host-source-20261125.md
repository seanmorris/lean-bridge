# C++ host imports and native shared ownership

The ordinary and reviewed Lake routes compiled an application that imports
`LeanBridge.Host.Cpp`. They produced the same public IR
(`52ebd26c02d760d5ba142f7869ce1ae4f38c802d5827700a661c668d95b47380`)
and generated host C input
(`656090aafc587420f332dfd7486224a246fa6d56ffc0b9cc971b4675a508a741`).
The extractor recorded the getter and setter, distinguished the C++ host
exception from a mapped Lean error, and retained the leased object in the
declared EIO payload. A C symbol substituted for a C++ setter, a missing
member dependency, a stale review, and a shadowed module were rejected.
The provider definitions also compiled in the same translation unit as Lean's
extern declarations. All five C++ member symbols were present.

The separate native registry test pins an original `std::shared_ptr`, clones
the ticket, and recovers a pointer with the same address **and control block**.
It rejects an unrelated control block at the same address, an alias with no
owner, the wrong kind, a raw C payload, a stale ticket, and access from a
worker or forked child. A destructor that tries to re-adopt the object is
rejected. Final release runs the real application deleter once.

Run `npm run test:cpp-host-source` with the pinned Lean compiler and
`npm run test:cpp-host-registry` with a Linux C11 and C++20 toolchain.
These gates establish source reconciliation and native ownership separately.

The follow-up two-component gate connected those layers. The application
used ordinary C++ methods and `shared_ptr` values; no C callbacks or raw
handles appeared in the caller. Both link orders preserved control-block
identity. The caller caught the original non-standard C++ exception (equal
`exception_ptr`), including across a nested peer call. A mapped error and
an object-valued EIO stayed typed; a returned `Except` stayed a value.
Closing during a member was refused, off-thread destruction was drained on
the owner, and destruction from inside a callback did not invalidate its
active call. A null nominal reply retired the shared runtime. Final cleanup
ran each application destructor once.

| ELF from the direct seven-export test | SHA-256 |
| --- | --- |
| Workshop | `40f047f900d943b8012728f439b7ff68c8c86a862678319b80fc79776ea8bcb4` |
| Peer | `f3a57779044f4117d0779a3f1f2316784af7c9bceec52aefd1b38047ed0e4f26` |
| Shared C++ domain | `9e5df71738d3b810393cb0ce8d7d7d9835c54801247da9dc7fbd74983747a2c7` |

The direct gate removes the producer trees before compiling the downstream
application. It is not the release-archive gate and does not exercise workers.
