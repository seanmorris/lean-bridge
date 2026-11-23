"""Inspect a CPAN distribution as data: do not run its installer, XS or Perl."""
import hashlib
import json
import re
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path, PurePosixPath


def sha(data):
    return hashlib.sha256(data).hexdigest()


def inspect(path, role, api_bytes, evidence_bytes):
    expected_root = path.name.removesuffix(".tar.gz")
    with tarfile.open(path, "r:gz") as archive:
        files = {}
        for item in archive:
            parts = PurePosixPath(item.name).parts
            assert item.isfile() and parts[0] == expected_root and len(parts) > 1 and ".." not in parts
            name = "/".join(parts[1:])
            assert name not in files
            files[name] = archive.extractfile(item).read()
    m = json.loads(files.pop("lean-bridge-package.json"))
    assert m["files"] == {name: sha(data) for name, data in files.items()}
    assert sorted(files["MANIFEST"].decode().splitlines()) == sorted([*files, "lean-bridge-package.json"])
    assert len(m["prebuilt"]) == len({v["abiKey"] for v in m["prebuilt"]}) > 0
    lib = m.get("syncIO", {}).get("library")
    mt = json.loads(files["META.json"])
    if role == "component":
        pinned = "== " + m["runtimeVersion"]
        for stage in ("configure", "runtime"):
            assert mt["prereqs"][stage]["requires"]["LeanBridge::Runtime"] == pinned
        assert m["syncIO"] == json.loads(files["binding-manifest.json"])
        assert m["syncIO"]["profile"] == "native-perl-io-v1"
        assert files["elaboration.json"] == evidence_bytes and files["binding-ir.json"] == api_bytes
        assert sha(evidence_bytes) == m["syncIO"]["elaborationSha256"]
        api, evidence = json.loads(api_bytes), json.loads(evidence_bytes)
        declarations = {d["name"]: d for d in api["declarations"]}
        assert evidence["selection"]["synchronousIO"] and evidence["selection"]["nativeEffects"] == ["filesystem"]
        assert all(d["resultMode"] == "value" for d in declarations.values())
        for name in ("store", "read"):
            d = declarations[name]
            assert d["capabilities"] == ["capability:native.filesystem"]
            assert d["source"]["extensions"]["lean-bridge.dev/native-effects-v1"] == {"call": d["capabilities"]}
            assert d["failure"]["errors"] == ["error:IO.Error"]
        assert declarations["bump"]["capabilities"] == [] and declarations["echo"]["failure"]["errors"] == []
        choose = declarations["choose"]
        typed = next(e for e in api["errors"] if e["id"] == choose["failure"]["errors"][0])
        assert typed["payload"] == choose["result"]["type"] and typed["payload"]["constructor"] == "result"
        if m["module"] == "LeanBridge::Journal":
            scalars = "unit bool char uint8 uint16 uint32 uint64 usize int8 int16 int32 int64 isize float32 float64 string bytes nat int".split()
            for scalar in scalars:
                d = declarations["rt_" + scalar]
                assert d["parameters"][0]["type"] == d["result"]["type"] == {"kind": "primitive", "name": scalar}
            assert declarations["nested"]["result"]["type"]["constructor"] == "result"
        assert lib == "liblbc_perl_" + sha(m["module"].encode()) + ".so"
        assert sha(files["lib/" + m["module"].replace("::", "/") + "/native/" + lib]) == m["syncIO"]["librarySha256"]
        assert not any(n.endswith(("/libleanshared.so", "/liblean_bridge_native.so")) for n in files)
    else:
        assert m["module"] == "LeanBridge::Runtime" and lib is None
        assert re.fullmatch(r"0\.002[0-9]{78}1", m["version"])
        native = json.loads(files["lib/LeanBridge/Runtime/runtime.json"])
        assert sha(files["lib/LeanBridge/Runtime/runtime.json"]) == m["nativeRuntimeIdentity"]
        assert sha(files["lib/LeanBridge/Runtime/binding.json"]) == m["runtimeIdentity"]
        for n in ("libleanshared.so", "liblean_bridge_native.so"):
            assert sha(files["lib/LeanBridge/Runtime/native/" + n]) == native["files"]["lib/" + n]["sha256"]
    variants = []
    with tempfile.TemporaryDirectory() as temp:
        artifact = Path(temp) / "image.so"
        for v in m["prebuilt"]:
            key = v["abiKey"]
            assert key == sha(json.dumps(v["abi"], sort_keys=True, separators=(",", ":")).encode())
            comp = json.loads(files["prebuilt/" + key + "/receipt.json"])
            assert comp["abi"] == v["abi"] and comp["outputSha256"] == sha(files[v["path"]])
            assert comp["sourceSha256"] == sha(files[m["xs"]]) and comp["operation"] == "generated-xs-only"
            assert comp["runtimeIdentity"] == m["runtimeIdentity"]
            artifact.write_bytes(files[v["path"]])
            dynamic = subprocess.check_output(["readelf", "-d", artifact], text=True)
            symbols = subprocess.check_output(["readelf", "--dyn-syms", "--wide", artifact], text=True)
            assert "boot_" + m["module"].replace("::", "__") in symbols and "(RPATH)" not in dynamic and "(RUNPATH)" not in dynamic
            if lib:
                assert f"Shared library: [{lib}]" in dynamic and "lbwire_lbc_perl_" in symbols
            versions = subprocess.check_output(["readelf", "--version-info", artifact], text=True)
            floor = tuple(map(int, m["glibcMinimumVersion"].split("."))) + (0,)
            for major, minor, patch in re.findall(r"GLIBC_(\d+)\.(\d+)(?:\.(\d+))?", versions):
                assert (int(major), int(minor), int(patch or 0)) <= floor
            variants.append([key, comp["outputSha256"]])
    return {"module": m["module"], "bindingRuntime": m["runtimeIdentity"], "nativeRuntime": m["nativeRuntimeIdentity"],
            "version": m["version"], "runtimeVersion": m["runtimeVersion"], "entries": len(files), "variants": variants}


if __name__ == "__main__":
    role, path, binding, evidence = sys.argv[1:]
    assert role in ("runtime", "component")
    print(json.dumps(inspect(Path(path), role, Path(binding).read_bytes(), Path(evidence).read_bytes()), sort_keys=True))
