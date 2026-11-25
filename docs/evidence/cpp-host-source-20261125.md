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
They do not yet establish an installed C++ host-object package, exception
propagation from a live C++ member, or C++ worker delivery.
