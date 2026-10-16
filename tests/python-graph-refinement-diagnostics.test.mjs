/**
 * Exact checked-refinement diagnostics through recursive Python graph wheels.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateCopiedPythonGraphConversions } from "../src/backends/python/copied-graph-conversions.mjs";
import { generateCopiedPythonGraphPackage } from "../src/backends/python/copied-graph-package.mjs";
import { auditPythonPackage } from "../src/backends/python/package-audit.mjs";
import { nativeGraphRefinementDiagnostics } from "../src/build/native-graph-sources.mjs";
import { mutualCheckedRecordReview } from "./helpers/mutual-checked-record-fixture.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { recursiveCheckedRecordReview } from "./helpers/recursive-checked-record-fixture.mjs";
import "./helpers/python-graph-diagnostic-source-history-tests.mjs";

const native = "lean_mutualcheckedrecords/_native.py";

test("Python graph diagnostics are explicit and leave other wheels byte-identical", () => {
	for(const ir of [nativeRecursiveReviewedIr(), mutualCheckedRecordReview()])
	{
		const before = structuredClone(ir), files = generateCopiedPythonGraphPackage(ir);
		assert.deepEqual(generateCopiedPythonGraphPackage(ir, null
			, { refinementDiagnostics: false }), files);
		assert.deepEqual(ir, before);
		for(const text of Object.values(files))
			assert.doesNotMatch(text, /_graph_error|_graph_diagnostic|_graph_checked_status/u);
	}
	for(const value of [0, 1, "true", null])
	{
		assert.throws(() => generateCopiedPythonGraphConversions(mutualCheckedRecordReview()
			, { refinementDiagnostics: value }), /must be explicit/u);
		assert.throws(() => generateCopiedPythonGraphPackage(mutualCheckedRecordReview(), null
			, { refinementDiagnostics: value }), /must be explicit/u);
	}
});

test("Python graph diagnostics bind the adapter reader once and route every call", () => {
	const ir = mutualCheckedRecordReview();
	const off = generateCopiedPythonGraphPackage(ir);
	const on = generateCopiedPythonGraphPackage(ir, null, { refinementDiagnostics: true });
	assert.deepEqual(Object.keys(on), Object.keys(off));
	for(const path of Object.keys(off).filter(path => path !== native))
		assert.equal(on[path], off[path], path);
	const source = on[native];
	assert.equal(source.match(/_GraphAssets\._LIBRARY\["mutualcheckedrecords_graph_error"\]/gu)
		.length, 1);
	assert.match(source, /_graph_diagnostic\.argtypes = \[\]\n_graph_diagnostic\.restype = _c\.c_char_p\n/u);
	const calls = source.match(/^ {8}_graph(?:_checked)?_status\(invoke\(.*$/gmu);
	assert.equal(calls.length, ir.declarations.length);
	for(const call of calls) assert.match(call, /^ {8}_graph_checked_status\(invoke\(.*\), _graph_diagnostic\)$/u);
	assert.equal(on[native].replace(/\n_graph_diagnostic = [^]*?c_char_p\n/u, "\n")
		.replace(/\n\ndef _graph_checked_status[^]*?raise LeanBridgeError\(status, text\)\n\n/u, "\n")
		.replaceAll("_graph_checked_status(", "_graph_status(")
		.replaceAll(", _graph_diagnostic)", ")"), off[native]);
	auditPythonPackage(ir, on);
});

test("Python graph diagnostics read once, only for invalid input, and reject malformed text", () => {
	const generated = generateCopiedPythonGraphConversions(mutualCheckedRecordReview()
		, { refinementDiagnostics: true }).source;
	const support = generated.slice(0, generated.indexOf("class _GraphValues:"));
	assert.match(support, /def _graph_checked_status\(status, diagnostic\):/u);
	const program = `
class LeanBridgeError(RuntimeError):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
${support}
import json
reads = []
def reader(value):
    def read():
        reads.append(value)
        return value
    return read
def outcome(status, value):
    try:
        _graph_checked_status(status, reader(value))
    except Exception as error:
        return [type(error).__name__, getattr(error, "status", None), str(error)]
    return None
text = "arg0.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne"
print(json.dumps([
    outcome(0, b"stale"), outcome(1, text.encode()), outcome(1, None)
    , outcome(1, "\\u00e9".encode()), outcome(1, b"\\xff"), outcome(2, b"stale")
    , outcome(3, b"stale"), outcome(5, b"stale"), outcome(4, b"stale"), len(reads)]))
`;
	const result = JSON.parse(execFileSync("python3", ["-I", "-B", "-c", program]
		, { encoding: "utf8" }));
	assert.deepEqual(result, [
		null
		, ["LeanBridgeError", 1, "arg0.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne"]
		, ["LeanBridgeError", 1, "Invalid native input"]
		, ["LeanBridgeError", 1, "é"]
		, ["_GraphInvalidNative", 4, "Malformed native refinement diagnostic"]
		, ["LeanBridgeError", 2, "Native copied graph limit exceeded"]
		, ["LeanBridgeError", 3, "Native allocation failed"]
		, ["LeanBridgeError", 5, "Lean runtime is unavailable"]
		, ["_GraphInvalidNative", 4, "Invalid native copied value"]
		, 4
	]);
});

test("native graph diagnostic selection matches the adapter refinement contract", async () => {
	const site = refinements => ({ refinements });
	const copied = { callbacks: false };
	assert.equal(nativeGraphRefinementDiagnostics({ exports: [] }), false);
	assert.equal(nativeGraphRefinementDiagnostics({ copiedGraph: null
		, exports: [site({ parameters: [{ kind: "fin" }] })] }), false);
	assert.equal(nativeGraphRefinementDiagnostics({ copiedGraph: { callbacks: true }
		, exports: [site({ parameters: [{ kind: "fin" }] })] }), false);
	assert.equal(nativeGraphRefinementDiagnostics({ copiedGraph: copied
		, exports: [{}, site({ parameters: [null], result: { kind: "fin" } })] }), false);
	assert.equal(nativeGraphRefinementDiagnostics({ copiedGraph: copied
		, exports: [{}, site({ parameters: [null, { kind: "fin" }] })] }), true);
	for(const ir of [mutualCheckedRecordReview(), recursiveCheckedRecordReview()])
		assert.ok(ir.declarations.some(item => item.source.extensions["lean-lang.org/refinements"]
			.parameters.some(Boolean)));
	const pypi = await readFile("src/release/native-pypi.mjs", "utf8");
	assert.match(pypi, /generate === generateCopiedPythonGraphPackage\n\t+\? \[\{ refinementDiagnostics: nativeGraphRefinementDiagnostics\(model\) \}\] : \[\]/u);
	const c = await readFile("src/build/native-c-projection.mjs", "utf8");
	assert.match(c, /const refinementDiagnostics = !graph\?\.callableGraph && nativeGraphRefinementDiagnostics\(model\);/u);
});
