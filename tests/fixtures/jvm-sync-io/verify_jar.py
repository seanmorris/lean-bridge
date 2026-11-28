"""Independent original archive check; streams even the large native runtime."""
import hashlib, json, sys, zipfile
from pathlib import Path

jar, pom = map(Path, sys.argv[1:3])
with zipfile.ZipFile(jar) as z:
    name = "META-INF/lean-bridge/package-receipt.json"
    r = json.loads(z.read(name))
    assert r["profile"] == "native-jvm-io-v1"
    assert len(z.namelist()) == len(set(z.namelist()))
    assert set(z.namelist()) == set(r["files"]) | {name}
    for p, info in r["files"].items():
        assert not p.startswith("/") and all(s not in ("", ".", "..") for s in p.split("/"))
        with z.open(p) as stream:
            assert hashlib.file_digest(stream, "sha256").hexdigest() == info["sha256"]
        assert z.getinfo(p).file_size == info["bytes"]
    group, artifact = r["name"].split(":")
    assert z.read(f"META-INF/maven/{group}/{artifact}/pom.xml") == pom.read_bytes()
    assert len(r["libraries"]) == 4
    for lib, digest in r["libraries"].items():
        assert r["files"]["META-INF/lean-bridge/native/linux-x64/" + lib]["sha256"] == digest
    assert r["owner"]["library"] == "liblb_jvm_owner_" + r["runtimeIdentity"] + ".so"
    assert len(r["owner"]["id"]) == 64 and r["owner"]["id"] != r["runtimeIdentity"]
    ns = r["namespace"].replace(".", "/")
    assert {ns + "/Api.class", ns + "/kotlin/Api.class"}.issubset(r["files"])
    sdk = json.loads(z.read("META-INF/lean-bridge/compilers.json"))
    assert sdk["kotlin"]["standardLibraryVersion"] == "2.2.0"
    assert "META-INF/" + sdk["kotlin"]["module"] + ".kotlin_module" in r["files"]
    if len(sys.argv) == 4:
        # Store a differently identified but still loadable ELF for the compatibility test.
        with open(sys.argv[3], "xb") as out:
            out.write(z.read("META-INF/lean-bridge/native/linux-x64/" + r["owner"]["library"]))
            out.write(b"\x00alternate-owner-build\x00")
    print(json.dumps(dict(name=r["name"], namespace=r["namespace"], owner=r["owner"],
                          libraries=r["libraries"], payloads=len(r["files"]), compiler=sdk["compiler"],
                          kotlin=sdk["kotlin"]["version"], bindingIrSha256=r["bindingIrSha256"],
                          componentId=r["component"]["id"], componentIdentity=r["componentIdentity"], runtimeIdentity=r["runtimeIdentity"])))
