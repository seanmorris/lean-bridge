/**
 * Generate interpreter-wide synchronized loading for installed Python wheels.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";

/**
 * Bind the loader to verified native compiler artifacts.
 *
 * @param evidence - Closed compiled native library identities, or null for source generation.
 */
export const copiedPythonAssets = evidence => !evidence ? 'raise ImportError("Build a compiled PyPI release before importing this API")\n' : `import hashlib as _hashlib
import os as _os
import pathlib as _pathlib
import platform as _platform
import stat as _stat
import sys as _sys
import threading as _threading
import types as _types

if (_sys.version_info < (3, 11) or _sys.platform != "linux"
        or _platform.machine() not in ("x86_64", "AMD64")
        or _c.sizeof(_c.c_void_p) != 8 or _sys.byteorder != "little"):
    raise ImportError("This Lean package requires Python 3.11+ on Linux x86-64")
if hasattr(_sys, "_is_gil_enabled") and not _sys._is_gil_enabled():
    raise ImportError("This Lean package requires a GIL-enabled interpreter")

_PID = _os.getpid()
_root = _pathlib.Path(__file__).resolve().parent / "native" / "linux-x64"
_libraries = ${JSON.stringify(evidence.libraries)}
for _name, _expected in _libraries.items():
    _path = _root / _name
    if not _stat.S_ISREG(_path.lstat().st_mode):
        raise ImportError("Native library is not a regular file: " + _name)
    with _path.open("rb") as _stream:
        _actual = _hashlib.file_digest(_stream, "sha256").hexdigest()
    if _actual != _expected:
        raise ImportError("Native library differs from compiled evidence: " + _name)

# No shared on-disk module: uninstalling one wheel must not break another.
_candidate = _types.ModuleType("_lean_bridge_copied_runtime_v1")
_candidate.lock = _threading.RLock()
_candidate.pid = _PID
_candidate.identity = None
_candidate.failed = False
_candidate.components = {}
_candidate.libraries = {}
_candidate.handles = []
_state = _sys.modules.setdefault(_candidate.__name__, _candidate)
if _state.pid != _PID:
    raise ImportError("Start a fresh Python interpreter after fork to use Lean packages")
with _state.lock:
    if _state.failed:
        raise ImportError("Lean native loading failed earlier in this interpreter")
    if _state.identity not in (None, ${JSON.stringify(evidence.runtimeIdentity)}):
        raise ImportError("Incompatible Lean runtime identities")
    for _name, _expected in _libraries.items():
        if _state.libraries.get(_name, _expected) != _expected:
            raise ImportError("Conflicting builds of the same native library: " + _name)
    _previous = _state.components.get(${JSON.stringify(evidence.componentId)})
    if _previous is not None and _previous[0] != ${JSON.stringify(sha256(canonicalJson(evidence)))}:
        raise ImportError("Conflicting builds of the same Lean component")
    try:
        if _previous is None:
            for _name in ${JSON.stringify(["libleanshared.so", "liblean_bridge_native.so", ...Object.keys(evidence.libraries).filter(name => ![evidence.library,"libleanshared.so","liblean_bridge_native.so"].includes(name)), evidence.library])}:
                if _name not in _state.libraries:
                    _loaded = _c.CDLL(str(_root / _name), mode=_os.RTLD_NOW | _os.RTLD_GLOBAL)
                    _state.handles.append(_loaded)
                    _state.libraries[_name] = _libraries[_name]
                else:
                    _loaded = next(item for item in _state.handles if _pathlib.Path(item._name).name == _name)
            _previous = (${JSON.stringify(sha256(canonicalJson(evidence)))}, _loaded)
            _state.components[${JSON.stringify(evidence.componentId)}] = _previous
            _state.identity = ${JSON.stringify(evidence.runtimeIdentity)}
        _LIBRARY = _previous[1]
    except BaseException:
        _state.failed = True
        raise

def _ensure_process():
    if _os.getpid() != _PID:
        raise RuntimeError("Start a fresh Python interpreter after fork to use Lean packages")
`;
