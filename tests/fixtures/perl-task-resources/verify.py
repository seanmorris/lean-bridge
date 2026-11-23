"""Independently inspect the small component tarball; never execute its contents."""
import hashlib
import json
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path, PurePosixPath


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode()


def inspect(archive_path, route):
    stem = archive_path.name.removesuffix(".tar.gz")
    files = {}
    with tarfile.open(archive_path, "r:gz") as archive:
        for member in archive:
            p = PurePosixPath(member.name)
            assert member.isfile() and p.parts[0] == stem and len(p.parts) > 1 and ".." not in p.parts
            name = "/".join(p.parts[1:])
            assert name not in files
            files[name] = archive.extractfile(member).read()
    m = json.loads(files.pop("lean-bridge-package.json"))
    assert m["files"] == {k: sha(v) for k, v in files.items()}
    assert set(files["MANIFEST"].decode().splitlines()) == set(files) | {"lean-bridge-package.json"}
    assert len(m["prebuilt"]) == len({v["abiKey"] for v in m["prebuilt"]}) == 4
    meta = json.loads(files["META.json"])
    for phase in ("runtime", "configure"):
        assert meta["prereqs"][phase]["requires"]["LeanBridge::Runtime"] == "== " + m["runtimeVersion"]
    result = {"bindingRuntime": m["runtimeIdentity"], "nativeRuntime": m["nativeRuntimeIdentity"], "xsSourceSha256": sha(files["Component.xs"]),
              "installedVariants": {v["abiKey"]: sha(files[v["path"]]) for v in m["prebuilt"]}}
    if route in {"peer", "foreign"}:
        assert m["module"] == ("LeanBridge::ResourcePeer" if route == "peer" else "LeanBridge::ForeignPeer")
        assert not ({"syncIO", "taskDelivery", "ownedValues"} & m.keys())
        assert not any("liblb_task_resources_" in k for k in files)
        result["sourceModules"] = {i["module"]: i["source"]["sha256"] for i in json.loads(files["model.json"])["sourceIdentity"]["modules"]}
        return result
    task = route in {"ordinary", "reviewed"}
    assert task or route == "counter"
    api, ev = (json.loads(files[name]) for name in ("binding-ir.json", "elaboration.json"))
    contract = json.loads(files["binding-manifest.json"])
    assert contract == m["taskDelivery" if task else "syncIO"]
    assert ("Future" in meta["prereqs"]["runtime"]["requires"]) == task
    assert contract["bindingIrSha256"] == sha(json.dumps(api, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode())
    assert contract["elaborationSha256"] == sha(files["elaboration.json"])
    src = {i["module"]: i["sourceSha256"] for i in ev["interfaces"]}
    assert ev["resourceImports"] == ({"Depot": ["Shared"], "Exchange": ["Depot"], "Shared": []}
                                     if task else {"Counter": ["Shared"], "Shared": []})
    nominal = {}
    for t in api["types"]:
        if t["kind"] != "resource":
            continue
        decl = t["source"]["declaration"]
        # Shared imports only Std: the pinned compiler and Shared's bytes define this type.
        key = sha(canonical({"abi": "lean-bridge/heap-resource-v1", "declaration": decl,
                             "compilerSha256": ev["compilerSha256"], "modules": [{"module": "Shared", "sourceSha256": src["Shared"]}]}))
        assert t["resource"]["kindId"] == "resource:" + decl + "/" + key
        assert t["source"]["extensions"]["lean-bridge.dev/resource-identity"] == key
        nominal[decl] = key
    assert set(nominal) == {"Shared.Badge", "Shared.Ticket"} and len(set(nominal.values())) == 2
    ledger = contract["resourceLedger"]
    libdir = "lib/" + m["module"].replace("::", "/") + "/native/"
    assert ledger["library"] == "liblb_task_resources_" + ledger["id"] + ".so"
    assert sha(files[libdir + ledger["library"]]) == ledger["sha256"]
    assert set(k for k in files if k.startswith(libdir)) == {libdir + ledger["library"], libdir + contract["library"]}
    with tempfile.TemporaryDirectory() as working:
        image = Path(working) / "image.so"
        for variant in m["prebuilt"]:
            image.write_bytes(files[variant["path"]])
            deps = subprocess.check_output(["readelf", "-d", image], text=True)
            for name in (ledger["library"], contract["library"]):
                assert "Shared library: [" + name + "]" in deps
            assert "(RPATH)" not in deps and "(RUNPATH)" not in deps
    return {**result, "nominal": nominal, "sourceModules": src, "ledger": ledger}


if __name__ == "__main__":
    print(json.dumps(inspect(Path(sys.argv[1]), sys.argv[2]), sort_keys=True))
