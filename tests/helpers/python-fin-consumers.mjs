/**
 * Installed Python consumers for checked top-level Fin sites.
 *
 * @file
 */
import { nativeFinSymbol } from "./native-fin-consumers.mjs";

/** Public API cases: exact bounds, host error identity, cleanup and recovery. */
export const pythonFinConsumer = () => `import lean_native_fin as api

checks = 0

def require(condition, label):
    global checks
    if not condition:
        raise SystemExit("failed: " + label)
    checks += 1

def rejected(call, parameter, bound):
    try:
        call()
    except api.LeanBridgeError as error:
        return error.status == 1 and str(error) == parameter + " is not below its Fin " + bound + " bound"
    return False

def raises(kind, call):
    try:
        call()
    except kind:
        return True
    except Exception:
        return False
    return False

HUGE = 1 << 70
WORD = 1 << 32

# Fin 0 is uninhabited: every input is rejected by the native bound check.
require(rejected(lambda: api.impossible(0), "arg0", "0"), "Fin 0 rejects zero")
require(rejected(lambda: api.impossible(1), "arg0", "0"), "Fin 0 rejects one")

# Fin 1 admits only zero.
require(api.only(0) == 7, "Fin 1 accepts zero")
require(rejected(lambda: api.only(1), "arg0", "1"), "Fin 1 rejects its bound")

# Fin 10 with a Fin result: endpoints, exact int results and beyond-bound inputs.
require(api.mirror(0) == 9 and api.mirror(9) == 0, "Fin 10 endpoints")
require(type(api.mirror(4)) is int and api.mirror(4) == 5, "Fin results are exact int")
for value in (10, 11, WORD, HUGE):
    require(rejected(lambda: api.mirror(value), "arg0", "10"), "Fin 10 rejects " + str(value))

# Host checks keep the Nat error distinctions before any native call.
require(raises(ValueError, lambda: api.mirror(-1)), "negative input is ValueError")
for value in (True, False, 1.0, "1", None, 3j):
    require(raises(TypeError, lambda: api.mirror(value)), "non-int is TypeError: " + repr(value))

# A transparent alias keeps its exact bound.
require(api.twice(299) == 598, "alias accepts its largest value")
require(rejected(lambda: api.twice(300), "arg0", "300"), "alias rejects its bound")
require(rejected(lambda: api.twice(301), "arg0", "300"), "alias rejects beyond its bound")

# 2^70 exceeds every machine word.
require(api.succ_huge(WORD) == WORD + 1, "large Fin crosses a limb")
require(api.succ_huge(HUGE - 2) == HUGE - 1 and api.succ_huge(HUGE - 1) == HUGE - 1, "large Fin endpoints")
for value in (HUGE, HUGE + 1, 1 << 128):
    require(rejected(lambda: api.succ_huge(value), "arg0", str(HUGE)), "large Fin rejects " + str(value))

# A result-only refinement returns an exact int below its bound.
require(api.wrap(100) == 2 and api.wrap(HUGE) == 2 and api.wrap(0) == 0, "result-only Fin values")
require(type(api.wrap(100)) is int, "result-only Fin is int")

# Multiargument calls reject the Fin argument and leave caller data unchanged.
base, name = 5, "slot"
require(api.label(base, 3, name) == "slot:8", "mixed arguments")
require(rejected(lambda: api.label(base, 4, name), "arg1", "4"), "mixed arguments reject the Fin site")
require(raises(TypeError, lambda: api.label(base, True, name)), "mixed arguments reject bool")
require(raises(ValueError, lambda: api.label(base, -1, name)), "mixed arguments reject negatives")
require(base == 5 and name == "slot" and api.label(base, 0, name) == "slot:5", "caller data unchanged")

# Repeated invalid and valid calls recover without retiring the runtime.
for i in range(1000):
    if not rejected(lambda: api.mirror(10 + i), "arg0", "10"):
        raise SystemExit("invalid call accepted at " + str(i))
    if api.mirror(i % 10) != 9 - i % 10:
        raise SystemExit("valid call failed at " + str(i))
checks += 2000

print("python-fin-ok:" + str(checks))
`;

/**
 * Count source and adapter dispatch from the installed Python process; the
 * LD_PRELOAD interposer from the C acceptance provides the counters.
 */
export const pythonFinDispatchProbe = () => `import ctypes as c
import lean_native_fin as api

process = c.CDLL(None)
count = process.native_fin_dispatch_count
count.argtypes = [c.c_uint]
count.restype = c.c_ulong

def report(step, status):
    print(step, status, *[count(i) for i in range(6)])

def public(step, call):
    try:
        call()
        report(step, "ok")
    except Exception as error:
        report(step, type(error).__name__)

# An exported adapter consumes a boxed scalar and returns an owned Option.
def raw(symbol):
    adapter = getattr(process, symbol)
    adapter.argtypes = [c.c_void_p]
    adapter.restype = c.c_void_p
    return adapter

release = process.lean_dec_ref_cold
release.argtypes = [c.c_void_p]
release.restype = None

def drop(value):
    counter = c.c_int.from_address(value)
    if counter.value > 1:
        counter.value -= 1
    elif counter.value != 0:
        release(value)

def raw_rejected(adapter, value):
    result = adapter((value << 1) | 1) or 0
    return 1 if result & 1 else 0

def raw_accepted(adapter, value, expected):
    result = adapter((value << 1) | 1) or 0
    if result & 1:
        return 0
    field = c.c_void_p.from_address(result + 8).value or 0
    drop(result)
    return 1 if field == (expected << 1) | 1 else 0

report("start", "ok")
public("public-valid-mirror", lambda: api.mirror(3))
public("public-invalid-mirror", lambda: api.mirror(10))
public("public-invalid-impossible", lambda: api.impossible(0))
public("public-invalid-label", lambda: api.label(5, 4, "slot"))
public("public-bool-mirror", lambda: api.mirror(True))
public("public-negative-mirror", lambda: api.mirror(-1))
public("public-valid-label", lambda: api.label(5, 3, "slot"))
mirror = raw("${nativeFinSymbol("NativeFin.mirror")}")
impossible = raw("${nativeFinSymbol("NativeFin.impossible")}")
report("raw-invalid-mirror", raw_rejected(mirror, 10))
report("raw-invalid-impossible", raw_rejected(impossible, 0))
report("raw-valid-mirror", raw_accepted(mirror, 3, 6))
report("raw-invalid-mirror-large", raw_rejected(mirror, 1000))
`;

// Columns: source mirror, source impossible, source label, then their exported adapters.
export const pythonFinDispatchExpected = [
	["start", "ok", [0, 0, 0, 0, 0, 0]]
	, ["public-valid-mirror", "ok", [1, 0, 0, 1, 0, 0]]
	, ["public-invalid-mirror", "LeanBridgeError", [1, 0, 0, 1, 0, 0]]
	, ["public-invalid-impossible", "LeanBridgeError", [1, 0, 0, 1, 0, 0]]
	, ["public-invalid-label", "LeanBridgeError", [1, 0, 0, 1, 0, 0]]
	, ["public-bool-mirror", "TypeError", [1, 0, 0, 1, 0, 0]]
	, ["public-negative-mirror", "ValueError", [1, 0, 0, 1, 0, 0]]
	, ["public-valid-label", "ok", [1, 0, 1, 1, 0, 1]]
	, ["raw-invalid-mirror", "1", [1, 0, 1, 2, 0, 1]]
	, ["raw-invalid-impossible", "1", [1, 0, 1, 2, 1, 1]]
	, ["raw-valid-mirror", "1", [2, 0, 1, 3, 1, 1]]
	, ["raw-invalid-mirror-large", "1", [2, 0, 1, 4, 1, 1]]
];
