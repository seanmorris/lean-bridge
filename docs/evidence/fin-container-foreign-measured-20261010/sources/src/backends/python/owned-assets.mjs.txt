/**
 * Authenticate automatic native loading for resource-bearing Python packages.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";

/**
 * Share only verified native libraries within one interpreter and process.
 *
 * @param evidence - Closed compiler-authenticated library identities, or null.
 */
export const ownedPythonAssets = evidence => `import ctypes as _c
import _ctypes
import hashlib as _hashlib
import json as _json
import os as _os
import pathlib as _pathlib
import platform as _platform
import stat as _stat
import sys as _sys
import threading as _threading
import types as _types

_evidence = _json.loads(${JSON.stringify(canonicalJson(evidence))})
if _evidence is None:
    raise ImportError("Build a compiled PyPI release before importing this API")
if (_sys.version_info < (3, 11) or _sys.platform != "linux"
        or _platform.machine() not in ("x86_64", "AMD64")
        or _c.sizeof(_c.c_void_p) != 8 or _sys.byteorder != "little"):
    raise ImportError("This Lean package requires Python 3.11+ on Linux x86-64")
if hasattr(_sys, "_is_gil_enabled") and not _sys._is_gil_enabled():
    raise ImportError("This Lean package requires a GIL-enabled interpreter")

_PID = _os.getpid()
_root = _pathlib.Path(__file__).resolve().parent / "native" / "linux-x64"
for _directory in (_root.parent, _root):
    if not _stat.S_ISDIR(_directory.lstat().st_mode):
        raise ImportError("Native library directory is not a regular directory")
_libraries = _evidence["libraries"]
for _name, _expected in _libraries.items():
    _path = _root / _name
    if not _stat.S_ISREG(_path.lstat().st_mode):
        raise ImportError("Native library is not a regular file: " + _name)
    with _path.open("rb") as _stream:
        _actual = _hashlib.file_digest(_stream, "sha256").hexdigest()
    if _actual != _expected:
        raise ImportError("Native library differs from compiled evidence: " + _name)

# Reuse the interpreter registry used by copied-value Python packages.
# No shared on-disk module: removing one wheel cannot remove another's loader.
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

def _reject_unverified_loaded(name):
    for candidate in (name, str(_root / name)):
        try:
            probe = _c.CDLL(candidate, mode=_os.RTLD_NOW | _os.RTLD_NOLOAD)
        except OSError:
            continue
        _ctypes.dlclose(probe._handle)
        raise ImportError("Unverified native library is already loaded: " + name)

with _state.lock:
    if _state.failed:
        raise ImportError("Lean native loading failed earlier in this interpreter")
    if _state.identity not in (None, _evidence["runtimeIdentity"]):
        raise ImportError("Incompatible Lean runtime identities")
    for _name, _expected in _libraries.items():
        if _state.libraries.get(_name, _expected) != _expected:
            raise ImportError("Conflicting builds of the same native library: " + _name)
    _previous = _state.components.get(_evidence["componentId"])
    _identity = ${JSON.stringify(evidence ? sha256(canonicalJson(evidence)) : null)}
    if _previous is not None and _previous[0] != _identity:
        raise ImportError("Conflicting builds of the same Lean component")
    try:
        if _previous is None:
            # Check every unknown SONAME before loading any new library.
            for _name in _libraries:
                if _name not in _state.libraries:
                    _reject_unverified_loaded(_name)
            _order = ["libleanshared.so", "liblean_bridge_native.so"]
            _order += [name for name in _libraries
                       if name not in (*_order, _evidence["library"])]
            _order.append(_evidence["library"])
            for _name in _order:
                if _name not in _state.libraries:
                    _loaded = _c.CDLL(str(_root / _name), mode=_os.RTLD_NOW | _os.RTLD_GLOBAL)
                    _state.handles.append(_loaded)
                    _state.libraries[_name] = _libraries[_name]
                else:
                    _loaded = next(item for item in _state.handles
                                   if _pathlib.Path(item._name).name == _name)
            _previous = (_identity, _loaded)
            _state.components[_evidence["componentId"]] = _previous
            _state.identity = _evidence["runtimeIdentity"]
        _LIBRARY = _previous[1]
    except BaseException:
        _state.failed = True
        raise

def _ensure_process():
    if _os.getpid() != _PID:
        raise RuntimeError("Start a fresh Python interpreter after fork to use Lean packages")
`;
