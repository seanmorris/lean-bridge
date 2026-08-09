# Shared Native PHP Runtime Evidence

Status: two independently compiled and loaded PHP extensions execute real Lean code through one process-owned Lean runtime shared object and one generation-safe identity registry.

## Shared object model

Every native Lean component links to `liblean_bridge_native.so`. The operating system loads that shared object once per PHP process. It owns:

- the Lean runtime and matching `Init` archive;
- one runtime state machine;
- one component initialization table;
- one task manager;
- one generation-safe identity registry; and
- process-local runtime and identity-domain identifiers used by internal conformance tests.

The Alpha and probe extensions contain their own generated Lean component code. Neither extension contains `libleanrt.a` or `libInit.a`. Their ELF dynamic sections both name the same `liblean_bridge_native.so` dependency.

The executed artifact sizes are:

| Artifact | Bytes |
|---|---:|
| shared Lean runtime and `Init` | 14,048,976 |
| generated Alpha Zend extension | 249,064 |
| independent probe extension | 54,368 |

Adding the second component costs 54,368 bytes in this fixture. It does not add another 14 MB runtime image.

## Pinned native build

The installed `libleanrt.a` uses the `local-exec` TLS model and cannot be linked into a shared object. `scripts/build-lean-native-runtime.sh` builds Lean's `leanrt_initial-exec` target with position-independent code. Lean's source describes this target as the runtime intended for shared linking.

The script rebuilds `Init` with the same generated configuration, allocator policy, compiler, and PIC flags. Mixing the installed `Init` archive with the new runtime failed at load time because the two archives used different allocator policies. The build now treats that mismatch as invalid rather than resolving the missing allocator symbol from an unrelated system package.

The native build records the Lean commit, configuration hash, compiler version, libuv version, TLS model, PIC policy, archive members, defined symbols, and artifact hashes under its content-addressed build root.

## Initialization and loading

The first generated transport call performs these steps under the runtime administration mutex:

1. initialize the Lean runtime module;
2. initialize the matching Lean `Init` graph;
3. initialize the requesting component;
4. mark Lean initialization complete;
5. start the Lean task manager; and
6. mark the runtime and component ready.

Later components initialize their own graphs against the ready runtime. Component IDs are stable and initialization is exactly once. A failed first initialization makes the runtime terminal. A failed later component stays failed without corrupting components that already initialized.

The integration test initializes Alpha and a separately compiled probe component. Both report one runtime initialization, two component initializations, two attached components, the same runtime instance ID, and the same identity-domain ID.

## Identity and ownership

The broker assigns a 64-bit token that contains a slot and generation. It keys a live entry by generated kind and private component pointer. Reprojection of the same live identity reuses the token. Final release clears the pointer and increments the generation before the slot can be reused.

The token remains inside `LeanAlpha\Internal\Identity`. Public PHP objects expose no pointer, token, or handle. The userland weak cache uses the opaque token only to recover the canonical `Box` or callable wrapper.

The real-runtime test observes the identity count while it creates a temporary `Box`, lets the Zend destructor perform fallback cleanup, and closes the remaining objects explicitly. The count changes from 2 to 3 to 2, then reaches zero after deterministic close.

## Request, callback, and shutdown rules

The POC compiles only against non-thread-safe PHP. Generated Zend source rejects ZTS builds. Runtime and identity administration use a mutex. Ordinary Lean calls and PHP callback re-entry stay synchronous on the current request thread, and the broker does not hold its mutex while application code runs.

PHP request shutdown destroys remaining wrapper objects before module shutdown. Each component's module shutdown detaches its component record. The shared runtime remains loaded and cannot restart inside the process. The shared object's process destructor finalizes the Lean task manager when no identities remain. The operating system reclaims the runtime heap at process exit.

A PHP exception thrown during a real Lean callback returns through the generated C status, becomes the cause of `CallbackThrew`, and leaves the runtime usable for the next call.

## Executed gate

`tests/php-native-runtime.test.mjs` builds the pinned PIC runtime and matching `Init`, compiles Alpha and the probe as separate Lean C outputs, builds two PHP extensions, and executes them in one PHP process. The consumer uses the generated Composer package for Alpha and calls:

- direct resource construction and methods;
- typed copied-record round trip without JSON;
- PHP callback invocation from real Lean code;
- a returned Lean closure as an invokable PHP object;
- callback exception containment and recovery;
- canonical identity;
- deterministic and destructor cleanup; and
- a function from the independently compiled probe component.

The test inspects both extension dynamic sections and requires the shared runtime dependency. It also verifies the native build facts and reports the three artifact sizes above.
