"""Read the actual installed-profile archive, hashing large payloads incrementally."""
import hashlib
import json
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

jar, pom = map(Path, sys.argv[1:])
with zipfile.ZipFile(jar) as z:
    receipt = "META-INF/lean-bridge/package-receipt.json"
    r = json.loads(z.read(receipt))
    assert r["profile"] == "native-jvm-task-v1" and r["kind"] == "lean-bridge-jvm-task-package"
    names = z.namelist()
    assert len(names) == len(set(names)) and set(names) == set(r["files"]) | {receipt}
    for name, entry in r["files"].items():
        assert not name.startswith("/") and all(p not in ("", ".", "..") for p in name.split("/"))
        with z.open(name) as src:
            assert hashlib.file_digest(src, "sha256").hexdigest() == entry["sha256"]
        assert z.getinfo(name).file_size == entry["bytes"]
    assert len(r["libraries"]) == 4
    for n, h in r["libraries"].items():
        assert r["files"]["META-INF/lean-bridge/native/linux-x64/" + n]["sha256"] == h
    assert r["owner"]["library"] == "liblb_jvm_owner_" + r["runtimeIdentity"] + ".so"
    ns = r["namespace"].replace(".", "/")
    assert {f"{ns}/{n}.class" for n in ("Api", "Wire", "Delivery", "TaskReactor", "TaskPort", "kotlin/Api", "kotlin/TaskFlowKt")}.issubset(r["files"])
    sdk = json.loads(z.read("META-INF/lean-bridge/compilers.json"))
    k = sdk["kotlin"]
    assert k["standardLibraryVersion"] == "2.2.0" and "META-INF/" + k["module"] + ".kotlin_module" in names
    coro = k["compilerFiles"]["kotlinx-coroutines-core-jvm.jar"]
    assert coro == "9860906a1937490bf5f3b06d2f0e10ef451e65b95b269f22daf68a3d1f5065c5"
    group, artifact = r["name"].split(":")
    assert z.read(f"META-INF/maven/{group}/{artifact}/pom.xml") == pom.read_bytes()
    deps = ET.parse(pom).getroot().findall("{*}dependencies/{*}dependency")
    assert [(v.findtext("{*}groupId"), v.findtext("{*}artifactId"), v.findtext("{*}version")) for v in deps] == [
        ("org.jetbrains.kotlin","kotlin-stdlib","2.2.0"), ("org.jetbrains.kotlinx","kotlinx-coroutines-core-jvm","1.8.0")]
    print(json.dumps(dict(payloads=len(r["files"]), componentIdentity=r["componentIdentity"], owner=r["owner"],
                          libraries=r["libraries"], runtimeIdentity=r["runtimeIdentity"], bindingIrSha256=r["bindingIrSha256"],
                          java=sdk["compiler"], kotlin=k["version"], coroutinesSha256=coro)))
