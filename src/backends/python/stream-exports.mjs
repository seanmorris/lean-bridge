/**
 * Generate typed Lean pull/close closures and their Python projection.
 * The physical cursor type never crosses the component boundary.
 *
 * @file
 */
import { nativePullEntry } from "../native/pull-entry.mjs";
export { streamEntryLean } from "../native/pull-entry.mjs";

export const streamStub = `from typing import AsyncIterator as _AsyncIterator, TypeVar as _StreamTypeVar
_Item = _StreamTypeVar("_Item", covariant=True)
class _LBStream(_AsyncIterator[_Item]):
    def __aiter__(self) -> _LBStream[_Item]: ...
    async def __anext__(self) -> _Item: ...
    async def aclose(self) -> None: ...
    async def __aenter__(self) -> _LBStream[_Item]: ...
    async def __aexit__(self, *exc: object) -> None: ...
class LeanStreamError(Exception):
    declaration: str
    payload: object
`;

/**
 * Emit the checked factory and the individual (error | end | element) pull codec.
 *
 * @param i - Local symbol index.
 * @param entry - Compiler-checked factory and protocol names.
 * @param value - Copied element codec.
 * @param startError - Optional typed factory error codec.
 * @param stepError - Optional typed pull error codec.
 */
export const streamCodec = (i, entry, value, startError, stepError) => {
	const unpack = (t, expression) => t?.decode ? t.decode(expression) : expression;
	return {
		...nativePullEntry(i, "lb_python", entry, value.lean, startError?.lean, stepError?.lean)
		, c: `static PyObject *lb_item_${i}(lean_object *v) {
    ${stepError ? `lean_object *payload = lean_ctor_get(v, 0);
    if (!lean_obj_tag(v)) return lb_cursor_value(2, ${stepError.toPython("payload")});
    v = payload;` : ""}
    if (!lean_obj_tag(v)) Py_RETURN_NONE;
    return lb_cursor_value(1, ${value.toPython("lean_ctor_get(v, 0)")});
}
static PyObject *lb_open_${i}(lean_object *v) {
    ${startError ? `int ok = lean_obj_tag(v) == 1;
    lean_object *p = lean_ctor_get(v, 0);
    PyObject *result = ok ? lb_cursor_new(p, lb_python_pull_next_${i}, lb_python_pull_close_${i}, lb_item_${i}) : ${startError.toPython("p")};
    if (!result) return NULL;
    PyObject *pair = PyTuple_Pack(2, ok ? Py_True : Py_False, result); Py_DECREF(result); return pair;`
		: `return lb_cursor_new(v, lb_python_pull_next_${i}, lb_python_pull_close_${i}, lb_item_${i});`}
}`
		, toPython: v => `lb_open_${i}(${v})`
		, body: (raw, name) => `    def _start():
        _r = ${raw}
        ${startError ? `if not _r[0]:
            raise _lb_error_type("${name}", ${unpack(startError, "_r[1]")})
        return _r[1]` : "return _r"}
    def _decode(_r):
        ${stepError ? `if _r[0] == 2:
            raise LeanStreamError("${name}", ${unpack(stepError, "_r[1]")})
        ` : ""}return ${unpack(value, "_r[1]")}
    return _LBStream(_start, _decode)
`
	};
};
