"""Embedded only in wheels that exchange explicit Lean-owned resource leases."""
def _lb_load_ledger(identity, digest):
    import ctypes
    import _ctypes
    import os
    import stat
    from lean_bridge_host_runtime import _state

    name = "liblb_task_resources_" + identity + ".so"
    path = _Path(__file__).parent / name
    if not stat.S_ISREG(path.lstat().st_mode):
        raise ImportError("Lean resource ledger is not a regular file")
    with path.open("rb") as stream:
        if _digest(stream, "sha256").hexdigest() != digest:
            raise ImportError("Lean resource ledger digest differs")
    with _state.lock:
        if name in _state.libraries:
            if _state.libraries[name] != digest:
                raise ImportError("conflicting native Lean resource ledger")
            handle = next(h for h in _state.handles if _Path(h._name).name == name)
        else:
            for candidate in (name, str(path)):
                try:
                    foreign = ctypes.CDLL(candidate, mode=os.RTLD_NOLOAD | os.RTLD_NOW)
                except OSError:
                    continue
                _ctypes.dlclose(foreign._handle)
                raise ImportError("unverified Lean resource ledger is already loaded")
            handle = ctypes.CDLL(str(path), mode=os.RTLD_NOW | os.RTLD_GLOBAL)
            _state.handles.append(handle)
            _state.libraries[name] = digest
        symbol = getattr(handle, "lb_task_resource_" + identity + "_borrow")
        return ctypes.cast(symbol, ctypes.c_void_p).value
