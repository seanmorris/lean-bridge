"""Load the exact shared Lean libraries for generated CPython host components."""
import ctypes
import _ctypes
from functools import lru_cache
from hashlib import file_digest, sha256
import json
import os
from pathlib import Path
import stat
import sys
from threading import RLock
from types import ModuleType


# Same interpreter registry as the prepared copied-value and owned-value wheels.
_candidate = ModuleType("_lean_bridge_copied_runtime_v1")
_candidate.lock = RLock()
_candidate.pid = os.getpid()
_candidate.identity = None
_candidate.failed = False
_candidate.components = {}
_candidate.libraries = {}
_candidate.handles = []
_state = sys.modules.setdefault(_candidate.__name__, _candidate)


@lru_cache(maxsize=1)
def _inventory(expected):
    root = Path(__file__).resolve().parent
    raw = (root / "runtime.json").read_bytes()
    if sha256(raw).hexdigest() != expected:
        raise ImportError("incompatible Lean runtime identity")
    libraries = {}
    for name, item in json.loads(raw)["files"].items():
        if name.startswith("lib/"):
            path = root / name
            if not stat.S_ISDIR(path.parent.lstat().st_mode) or not stat.S_ISREG(path.lstat().st_mode):
                raise ImportError("native library is not a regular file: " + name)
            with path.open("rb") as stream:
                if file_digest(stream, "sha256").hexdigest() != item["sha256"]:
                    raise ImportError("Lean runtime library identity differs: " + name)
            libraries[path.name] = (path, item["sha256"])
    return libraries


def _verify(expected):
    if _state.pid != os.getpid():
        raise ImportError("start a fresh Python interpreter after fork to load Lean")
    with _state.lock:
        if _state.failed or _state.identity not in (None, expected):
            raise ImportError("incompatible or failed Lean runtime in this interpreter")
        files = _inventory(expected)
        for name, (path, digest) in files.items():
            if name in _state.libraries:
                if _state.libraries[name] != digest:
                    raise ImportError("conflicting native library: " + name)
                continue
            for existing in (name, str(path)):
                try:
                    handle = ctypes.CDLL(existing, mode=os.RTLD_NOLOAD | os.RTLD_NOW)
                except OSError:
                    continue
                _ctypes.dlclose(handle._handle)
                raise ImportError("unverified native library already loaded: " + name)
        handles = {}
        try:
            for name in ("libleanshared.so", "liblean_bridge_native.so"):
                path, digest = files[name]
                if name not in _state.libraries:
                    handle = ctypes.CDLL(str(path), mode=os.RTLD_NOW | os.RTLD_GLOBAL)
                    _state.handles.append(handle)
                    _state.libraries[name] = digest
                else:
                    handle = next(h for h in _state.handles if Path(h._name).name == name)
                handles[name] = handle
            _state.identity = expected
        except BaseException:
            _state.failed = True
            raise
        return (
            ctypes.cast(handles["libleanshared.so"].lean_register_external_class, ctypes.c_void_p).value,
            ctypes.cast(handles["liblean_bridge_native.so"].lean_bridge_native_component_initialize, ctypes.c_void_p).value,
        )
