"""Independently inspect both Maven archives before relying on their Java loaders."""
import hashlib
import json
import sys
import zipfile

workers = sys.argv[1:2] == ["--workers"]

def inspect(path):
    metadata = "META-INF/lean-bridge/"
    with zipfile.ZipFile(path) as jar:
        names = jar.namelist()
        assert len(names) == len(set(names))
        r = json.loads(jar.read(metadata + "package-receipt.json"))
        assert r["kind"] == "lean-bridge-jvm-host-package"
        assert r["profile"] == ("native-jvm-task-v1" if workers else "native-jvm-io-v1")
        if workers:
            generator = json.loads(jar.read(metadata + "generated/binding-manifest.json"))["generator"]
            assert generator == "jvm-host-tasks-v1"
            assert r["ledger"]["library"] == "liblb_task_resources_" + r["ledger"]["id"] + ".so"
        assert r["namespace"].replace(".", "/") + "/Api.class" in names
        assert r["namespace"].replace(".", "/") + "/kotlin/Api.class" in names
        assert any(n.endswith(".kotlin_module") for n in names)
        native = metadata + "native/linux-x64/"
        assert {n[len(native):] for n in names if n.startswith(native)} == set(r["libraries"])
        for name, digest in r["libraries"].items():
            assert r["files"][native + name]["sha256"] == digest
        jni_file = metadata + "jni/" + r["jni"]["library"]
        assert hashlib.sha256(jar.read(jni_file)).hexdigest() == r["jni"]["sha256"]
        assert r["jni"]["library"] == "liblb_jni_" + r["componentIdentity"] + ".so"
        return r

a, b = map(inspect, sys.argv[2:] if workers else sys.argv[1:])
assert a["name"] == "org.leanbridge:workshop" and b["name"] == "org.leanbridge:workshop-peer"
for field in ("runtimeIdentity", "owner", "hostDomain"):
    assert a[field] == b[field], field
for field in ("componentIdentity", "jni", "namespace"):
    assert a[field] != b[field], field
shared = set(a["libraries"]) & set(b["libraries"])
expected = {"libleanshared.so", "liblean_bridge_native.so", a["owner"]["library"], a["hostDomain"]["library"]}
if workers:
    assert a["ledger"] == b["ledger"]
    expected.add(a["ledger"]["library"])
assert shared == expected
assert all(a["libraries"][name] == b["libraries"][name] for name in shared)
print("one verified runtime, owner and host domain; independent JNI entries")
