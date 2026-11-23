"""Inspect original Maven bytes independently of the generator and its loader."""
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

jar, pom, root = map(Path, sys.argv[1:4])
meta = "META-INF/lean-bridge/"
native = meta + "native/linux-x64/"
with zipfile.ZipFile(jar) as z:
    receipt = meta + "package-receipt.json"
    r = json.loads(z.read(receipt))
    assert r["profile"] == "native-jvm-io-v1"
    assert len(z.namelist()) == len(set(z.namelist())) and set(z.namelist()) == set(r["files"]) | {receipt}
    for name, info in r["files"].items():
        assert not name.startswith("/") and not set(name.split("/")) & {"", ".", ".."}
        with z.open(name) as f:
            assert hashlib.file_digest(f, "sha256").hexdigest() == info["sha256"]
        assert z.getinfo(name).file_size == info["bytes"]
    for internal, external in [("binding-ir.json", "binding-ir.json"), ("elaboration.json", "host-export-evidence.json")]:
        assert json.loads(z.read(meta + internal)) == json.loads((root / external).read_bytes())
    group, artifact = r["name"].split(":")
    assert z.read(f"META-INF/maven/{group}/{artifact}/pom.xml") == pom.read_bytes()
    libs = r["libraries"]
    owner, ledger = r["owner"]["library"], r["ledger"]["library"]
    assert owner == "liblb_jvm_owner_" + r["runtimeIdentity"] + ".so"
    assert ledger == "liblb_task_resources_" + r["ledger"]["id"] + ".so"
    [component] = [lib for lib in libs if lib.startswith("liblbc_jvm_")]
    assert set(libs) == {owner, ledger, component, "libleanshared.so", "liblean_bridge_native.so"}
    for lib, sha in libs.items():
        assert r["files"][native + lib]["sha256"] == sha
    with tempfile.TemporaryDirectory() as stage:
        def elf(name, *args):
            path = Path(stage, name)
            path.write_bytes(z.read(native + name))
            return subprocess.check_output(["readelf", *args, str(path)], text=True)
        assert "Shared library: [" + owner + "]" in elf(ledger, "-dW")
        needed = elf(component, "-dW")
        assert all("Shared library: [" + lib + "]" in needed for lib in [owner, ledger])
        symbols = elf(component, "--dyn-syms", "-W")
        assert "_jvm_invoke" in symbols and "_jvm_retire" in symbols and "lbwire_" not in symbols
    ir = json.loads(z.read(meta + "binding-ir.json"))
    nominal = {}
    for kind in ir["types"]:
        if kind["kind"] != "resource":
            continue
        name = kind["name"]
        h = kind["source"]["extensions"]["lean-bridge.dev/resource-identity"]
        stem = "org/leanbridge/resources/h" + h + "/" + name
        nominal[name] = {"identity": h, "classSha256": r["files"][stem + ".class"]["sha256"],
                         "sourceSha256": r["files"][meta + "generated/src/main/java/" + stem + ".java"]["sha256"]}
    assert set(nominal) == {"Badge", "Ticket"}
    api = r["namespace"].replace(".", "/") + "/Api"
    assert api + ".class" in r["files"] and api[:-3] + "kotlin/Api.class" in r["files"]
    src = z.read(meta + "generated/src/main/java/" + api + ".java").decode()
    match = re.search(r"\bissue\(long a0\).*?status = f\.call\((\d+)\)", src, re.S)
    assert match
    print(json.dumps(dict(ledger=r["ledger"], owner=r["owner"], libraries=libs, runtime=r["runtimeIdentity"],
                          ir=r["bindingIrSha256"], nominal=nominal, namespace=r["namespace"], issue=int(match[1]))))
