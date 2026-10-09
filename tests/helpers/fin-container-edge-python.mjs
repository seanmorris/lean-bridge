/**
 * Full Python Fin edge consumer instrumentation, retaining its original assertions and exceptions.
 * Counts distinguish bound errors, wrong Python carriers and negative Nat conversions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { finContainerEdgeColumns, finContainerEdgeEntries, finContainerEdgeWireSymbols } from "./fin-container-edge-dispatch.mjs";
import { finContainerEdgeConsumer, insertFinContainerEdgeFragment } from "./fin-container-edges.mjs";

/** Independent call order for the complete Python consumer, including type/value error cases. */
export const finContainerEdgePythonExpected = Object.freeze((() => {
	const rows = [], counts = Array(8).fill(0);
	const add = (method, status) => {
		const index = finContainerEdgeEntries.indexOf(method);
		if(status === "ok")
		{
			counts[index + 2]++;
			if(index >= 4) counts[index - 4]++;
		}
		rows.push(Object.freeze([rows.length + 1, method, status, Object.freeze([...counts])]));
	};
	for(const status of ["ok", "fin", "ok"]) add("present", status);
	for(const status of ["ok", "ok", "fin"]) add("flatten", status);
	for(const method of finContainerEdgeEntries.slice(0, 3))
	{
		add(method, "ok");
		for(let value = 0; value < 3; value++) add(method, "fin");
	}
	for(let value = 0; value < 3; value++) add("optionalDigits", "ok");
	for(let row = 0; row < 3; row++)
	{
		add("present", "fin"); add("optionalDigits", "fin");
		for(let column = 0; column < 3; column++) add("flatten", "fin");
	}
	add("present", "ok"); add("flatten", "ok");
	for(const method of ["emptyOption", "emptyList", "optionalDigits"]) add(method, "type");
	for(let position = 0; position < 3; position++) add("optionalDigits", "value");
	for(let cycle = 0; cycle < 1000; cycle++)
		for(const method of ["emptyArray", "emptyList", "emptyOption", "present", "flatten", "optionalDigits"])
		{ add(method, "fin"); add(method, "ok"); }
	return rows;
})());

/**
 * Require every ordered call's actual outcome/counts and all original consumer assertions.
 *
 * @param stdout - Actual Python process output.
 */
export const readFinContainerEdgePython = stdout => {
	assert.ok(typeof stdout === "string" && stdout.endsWith("\n"));
	const lines = stdout.slice(0, -1).split("\n");
	assert.equal(lines.pop(), "fin-container-ok:14095");
	assert.equal(lines.length, finContainerEdgePythonExpected.length);
	return lines.map((line, index) => {
		assert.match(line, /^edge-python [1-9][0-9]* [A-Za-z]+ (?:ok|fin|type|value)(?: (?:0|[1-9][0-9]{0,14})){8}$/u);
		const [, step, method, status, ...counts] = line.split(" ");
		const row = [Number(step), method, status, counts.map(Number)];
		assert.deepEqual(row, finContainerEdgePythonExpected[index], `Python edge call ${index + 1}`);
		return row;
	});
};

/**
 * A caller-local proxy observes the normal generated API without modifying any installed module.
 * Package and public-wire identities are mandatory together for installed observations.
 *
 * @param model - Verified native model.
 * @param component - Receipt component identity.
 * @param identity - Optional exact installed identities; source gates may omit both.
 * @param identity.definitions - Six absolute public C wire defining-library paths.
 * @param identity.packageDirectory - Receipt-verified lean_fincontainers module directory.
 */
export const finContainerEdgePythonProbe = async (model, component, { definitions, packageDirectory } = {}) => {
	finContainerEdgeColumns(model, component);
	assert.equal(definitions === undefined, packageDirectory === undefined);
	if(definitions !== undefined)
	{
		assert.deepEqual(Object.keys(definitions).sort(), [...finContainerEdgeWireSymbols].sort());
		for(const path of [...Object.values(definitions), packageDirectory]) assert.ok(typeof path === "string" && isAbsolute(path) && !path.includes("\0"));
	}
	const methods = Object.fromEntries(finContainerEdgeEntries.map((method, index) => [method.replace(/[A-Z]/gu, letter => `_${letter.toLowerCase()}`), [method, index]]));
	const prelude = `import ctypes as _edge_ctypes
import pathlib as _edge_pathlib
import sys as _edge_sys

_edge_original = api
_edge_process = _edge_ctypes.CDLL(None)
try:
    _edge_count = _edge_process.fin_container_edge_count
except AttributeError:
    _edge_sys.stderr.write('edge interposer is not loaded\\n')
    raise SystemExit(2)
_edge_count.argtypes = [_edge_ctypes.c_uint]
_edge_count.restype = _edge_ctypes.c_ulong
if any(_edge_count(i) for i in range(8)):
    _edge_sys.stderr.write('edge counters are not initially zero\\n')
    raise SystemExit(3)
_edge_step = 0
${definitions ? `for _edge_module, _edge_name in [(_edge_original, '__init__.py'), (_edge_original._native, '_native.py')]:
    if _edge_pathlib.Path(_edge_module.__file__).resolve() != _edge_pathlib.Path(${JSON.stringify(packageDirectory)}) / _edge_name:
        _edge_sys.stderr.write('unexpected Python package location\\n')
        raise SystemExit(6)
class _EdgeDlInfo(_edge_ctypes.Structure):
    _fields_ = [('name', _edge_ctypes.c_char_p), ('base', _edge_ctypes.c_void_p), ('symbol', _edge_ctypes.c_char_p), ('address', _edge_ctypes.c_void_p)]
_edge_dladdr = _edge_process.dladdr
_edge_dladdr.argtypes = [_edge_ctypes.c_void_p, _edge_ctypes.POINTER(_EdgeDlInfo)]
_edge_dladdr.restype = _edge_ctypes.c_int
for _edge_symbol, _edge_expected in ${JSON.stringify(definitions)}.items():
    _edge_info = _EdgeDlInfo()
    _edge_address = _edge_ctypes.cast(_edge_original._native._LIBRARY[_edge_symbol], _edge_ctypes.c_void_p)
    if not _edge_dladdr(_edge_address, _edge_ctypes.byref(_edge_info)) or _edge_pathlib.Path(_edge_info.name.decode()).resolve() != _edge_pathlib.Path(_edge_expected):
        _edge_sys.stderr.write('unexpected Python wire definition: ' + _edge_symbol + '\\n')
        raise SystemExit(6)
` : ""}
def _edge_record(index, method, status, before):
    global _edge_step
    after = [_edge_count(i) for i in range(8)]
    for i in range(8):
        delta = int(status == 'ok' and (i == index + 2 or (index >= 4 and i == index - 4)))
        if after[i] != before[i] + delta:
            _edge_sys.stderr.write('wrong Python edge dispatch count\\n')
            raise SystemExit(5)
    _edge_step += 1
    print('edge-python', _edge_step, method, status, *after)

class _EdgeApi:
    def __getattr__(self, name):
        original = getattr(_edge_original, name)
        methods = ${JSON.stringify(methods)}
        if name not in methods:
            return original
        method, index = methods[name]
        def call(*args, **kwargs):
            before = [_edge_count(i) for i in range(8)]
            try:
                result = original(*args, **kwargs)
            except _edge_original.LeanBridgeError as error:
                if error.status != 1:
                    raise
                _edge_record(index, method, 'fin', before)
                raise
            except TypeError:
                _edge_record(index, method, 'type', before)
                raise
            except ValueError:
                _edge_record(index, method, 'value', before)
                raise
            _edge_record(index, method, 'ok', before)
            return result
        return call

api = _EdgeApi()
`;
	return insertFinContainerEdgeFragment(await finContainerEdgeConsumer("python"), "checks = 0", prelude);
};
