"""Exercise only public APIs installed from a prepared corpus wheel."""

import dataclasses
import importlib
import json
import pathlib
import sys


def decode(value, api):
    if "integer" in value:
        return int(value["integer"])
    if "string" in value:
        return value["string"]
    if "bool" in value:
        return value["bool"]
    if "unit" in value:
        return None
    if "bytes" in value:
        return bytes(value["bytes"])
    if "array" in value:
        return [decode(item, api) for item in value["array"]]
    if "record" in value:
        return getattr(api, value["record"])(
            **{key: decode(item, api) for key, item in value["fields"].items()}
        )
    raise ValueError("Unknown corpus wire value")


def encode(value):
    if value is None:
        return {"unit": True}
    if type(value) is bool:
        return {"bool": value}
    if type(value) is int:
        return {"integer": str(value)}
    if type(value) is str:
        return {"string": value}
    if type(value) is bytes:
        return {"bytes": list(value)}
    if isinstance(value, (tuple, list)):
        return {"array": [encode(item) for item in value]}
    if dataclasses.is_dataclass(value):
        return {
            "record": type(value).__name__,
            "fields": {
                field.name: encode(getattr(value, field.name))
                for field in dataclasses.fields(value)
            },
        }
    raise ValueError("Unexpected public API result type: " + type(value).__name__)


def clear_lists(value):
    if isinstance(value, list):
        for child in value:
            clear_lists(child)
        value.clear()
    elif dataclasses.is_dataclass(value):
        for field in dataclasses.fields(value):
            clear_lists(getattr(value, field.name))


def main():
    request = json.loads(pathlib.Path(sys.argv[1]).read_text())
    api = importlib.import_module(request["module"])
    package_file = pathlib.Path(api.__file__).resolve()
    assert package_file.is_relative_to(pathlib.Path(sys.prefix).resolve())
    assert "site-packages" in package_file.parts
    operations = request["operations"]
    baseline = request["cases"][0]
    results = []
    for case in request["cases"]:
        operation = getattr(api, operations[case["operation"]])
        args = [decode(value, api) for value in case["arguments"]]
        if case["expectation"]["kind"] == "host-rejection":
            try:
                operation(*args)
            except Exception as error:
                assert type(error).__name__ == request["errors"][case["expectation"]["category"]]
                exception = type(error).__name__
            else:
                raise AssertionError("Expected host rejection: " + case["id"])
            recovered = encode(getattr(api, operations[baseline["operation"]])(
                *[decode(value, api) for value in baseline["arguments"]]
            ))
            assert recovered == request["oracle"][baseline["oracleKey"]]
            results.append({"id": case["id"], "status": "rejected-as-expected",
                            "exception": exception, "recovered": True})
            continue
        result = operation(*args)
        observed = encode(result)
        assert observed == request["oracle"][case["oracleKey"]], case["id"]
        if case["checkIndependentCopy"]:
            assert result is not args[0]
            clear_lists(args[0])
            assert encode(result) == observed
            field = dataclasses.fields(result)[0].name
            try:
                setattr(result, field, getattr(result, field))
            except dataclasses.FrozenInstanceError:
                pass
            else:
                raise AssertionError("Copied records must remain frozen")
        results.append({"id": case["id"], "status": "matched", "observed": observed,
                        "independentCopy": case["checkIndependentCopy"]})
    print(json.dumps({"schemaVersion": 1, "profile": "python", "module": request["module"],
                      "python": sys.version.split()[0], "results": results}, sort_keys=True))


if __name__ == "__main__":
    main()
