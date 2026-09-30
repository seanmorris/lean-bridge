/**
 * Bounded Python conversions over the checked ownership-aware C value ABI.
 *
 * @file
 */
import { generateOwnedPythonValues } from "./owned-values.mjs";
import { ownedPythonCallbacks } from "./owned-callables.mjs";
import { ownedPythonTransfers } from "./owned-transfers.mjs";
import { ownedPythonAnchoredCall, ownedPythonAnchoredTransfers, ownedPythonValueCopies } from "./owned-borrows.mjs";

const primitive = {
	unit: "c_uint8", bool: "c_uint8", char: "c_uint32"
	, uint8: "c_uint8", uint16: "c_uint16", uint32: "c_uint32", uint64: "c_uint64"
	, int8: "c_int8", int16: "c_int16", int32: "c_int32", int64: "c_int64"
	, usize: "c_uint64", isize: "c_int64", float32: "c_float", float64: "c_double"
};

const support = (limits, transfers, anchors) => `import ctypes as _c
import builtins as _b
from . import _owned as _R
from . import __name__ as _package_name
import sys as _sys
_V = _sys.modules[_package_name]

if _c.sizeof(_c.c_void_p) != 8 or _sys.byteorder != "little":
    raise ImportError("Owned Python values require a 64-bit little-endian host")

class _OwnedInvalidNative(_R.LeanBridgeError):
    def __init__(self, message="Malformed native owned value"):
        super().__init__(9, message)

class _OwnedLimit(_R.LeanBridgeError):
    def __init__(self, message="Owned conversion limit exceeded"):
        super().__init__(2, message)

class _OwnedMpz(_c.Structure):
    _fields_ = [("allocated", _c.c_int32), ("size", _c.c_int32), ("data", _c.c_void_p)]

class _OwnedBudget:
    def __init__(self):
        self.nodes = ${limits.visits}
        self.native = ${limits.bytes}
        self.storage = ${limits.bytes}

class _OwnedScope:
    def __init__(self, state, check_only=False, budget=None):
        self.state = state
        self.check_only = check_only
        self.budget = _OwnedBudget() if budget is None else budget
        self.active = set()
        self.owners = []${transfers ? "\n        self.moves = None\n        self.move_group = None" : ""}

    @property
    def nodes(self):
        return self.budget.nodes

    @property
    def native(self):
        return self.budget.native

    def charge(self, field, count, width=1):
        remaining = getattr(self.budget, field)
        if count < 0 or width < 1 or count > remaining // width:
            raise _OwnedLimit()
        setattr(self.budget, field, remaining - count * width)

    def enter(self, key, depth, raw, output=False):
        if depth > ${limits.depth} or self.nodes == 0:
            raise _OwnedLimit("Owned value depth or node limit exceeded")
        self.budget.nodes -= 1
        self.charge("native", 1, _c.sizeof(raw))
        if key is not None:
            if key in self.active:
                if output:
                    raise _OwnedInvalidNative("Cyclic native owned value")
                raise ValueError("Cyclic Python owned value")
            self.active.add(key)

    def leave(self, key):
        if key is not None:
            self.active.remove(key)

    def value(self, raw, value=None):
        self.charge("storage", _c.sizeof(raw) + 256)
        if self.check_only:
            return None
        _R._owned_checkpoint()
        result = raw() if value is None else raw(value)
        self.owners.append(result)
        return result

    def allocate(self, raw, count):
        self.charge("storage", count, _c.sizeof(raw))
        self.charge("storage", 256)
        if self.check_only:
            return None
        _R._owned_checkpoint()
        result = (raw * count)()
        self.owners.append(result)
        return result

    def pin(self, value):
${transfers || anchors ? `        try:
            self.charge("storage", 32)
            if not self.check_only:
                _R._owned_checkpoint()
                self.owners.append(value)
        finally:
            # Retaining a traceback must not retain a private owning lease.
            value = None` : `        self.charge("storage", 32)
        if not self.check_only:
            _R._owned_checkpoint()
            self.owners.append(value)`}

    def close(self):${transfers ? "\n        self.moves = None" : ""}
        self.owners.clear()
        self.active.clear()

class _OwnedOutput:
    def __init__(self, owner, lease=None${anchors ? ", anchored=False" : ""}):
        self.owner = owner
        self.lease = lease${anchors ? "\n        self.anchored = anchored" : ""}

    def hold(self):
        if self.lease is None:
            if not self.owner.value.value:
                raise _OwnedInvalidNative("Missing native result owner")
            self.lease = self.owner.state.adopt(self.owner${anchors ? ", self.anchored" : ""})
        self.lease.require()
        return self.lease

def _owned_integer(value, minimum, maximum):
    if type(value) is not int:
        raise TypeError("Expected int without Boolean or numeric coercion")
    if minimum is not None and value < minimum or maximum is not None and value > maximum:
        raise ValueError("Integer is outside the declared Lean range")
    return value

def _owned_text_size(value, limit):
    if len(value) > limit:
        raise _OwnedLimit("UTF-8 text exceeds the conversion limit")
    if value.isascii():
        return len(value)
    size = 0
    for character in value:
        code = ord(character)
        if 0xd800 <= code <= 0xdfff:
            raise ValueError("String requires Unicode scalar values")
        size += 1 if code < 0x80 else 2 if code < 0x800 else 3 if code < 0x10000 else 4
        if size > limit:
            raise _OwnedLimit("UTF-8 text exceeds the conversion limit")
    return size

def _owned_span(pointer, count, raw):
    if not count:
        return 0
    width = _c.sizeof(raw)
    if (not pointer or pointer % _c.alignment(raw)
            or count > ((1 << 63) - 1) // width
            or pointer > (1 << 64) - 1 - count * width):
        raise _OwnedInvalidNative("Missing, misaligned or overflowing native span")
    # Verified native code supplies readable memory. Shape validation alone
    # cannot prove arbitrary foreign pointers belong to live allocations.
    return pointer

def _owned_read(pointer, raw):
    return raw.from_address(_owned_span(pointer, 1, raw))
`;

/**
 * Generate finite C views, exact Python scalars and resource-aware conversion.
 * Callback replies are snapshotted under their active argument borrows.
 * Installed wheel admission additionally requires authenticated assets.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 * @param options - Explicit C transport capabilities.
 */
export const generateOwnedPythonConversions = (ir, options = {}) => {
	const values = generateOwnedPythonValues(ir, options), { c } = values;
	const transfers = c.functions.some(fn => fn.transfers?.length);
	const anchors = Boolean(c.anchoredResults);
	const nodes = new Map(values.types.map(node => [node.id, { ...node
		, raw: node.identity || node.integer ? "_c.c_void_p" : node.scalar ? `_c.${primitive[node.name]}` : `_OwnedRaw${node.index}` }]));
	const finite = new Set(); let changed = true;
	while(changed)
	{
		changed = false;
		for(const node of nodes.values())
		{
			const all = fields => fields.every(field => finite.has(field.type));
			const inhabited = node.leaf || node.element || node.kind === "option"
				|| (node.kind === "variant" ? node.cases.some(branch => all(branch.fields))
					: node.kind === "result" ? node.fields.some(field => finite.has(field.type)) : all(node.fields));
			if(!finite.has(node.id) && inhabited)
			{ finite.add(node.id); changed = true; }
		}
	}
	const raw = [...nodes.values()].filter(node => !node.scalar && !node.integer && !node.identity)
		.map(node => `class ${node.raw}(_c.Structure):\n    pass\n`);
	const member = (field, index) => `("field${index}", ${field.pointer ? "_c.c_void_p" : nodes.get(field.type).raw})`;
	for(const node of [...nodes.values()].sort((a, b) => Number(b.leaf) - Number(a.leaf)))
	{
		if(node.scalar || node.integer || node.identity) continue;
		const i = node.index, fields = [];
		if(node.kind === "variant")
		{
			node.cases.forEach((branch, j) => raw.push(`class _OwnedCase${i}_${j}(_c.Structure):\n    _fields_ = [${branch.fields.length ? branch.fields.map(member).join(", ") : '("empty", _c.c_uint8)'}]\n`));
			raw.push(`class _OwnedUnion${i}(_c.Union):\n    _fields_ = [${node.cases.map((_, j) => `("case${j}", _OwnedCase${i}_${j})`).join(", ")}]\n`);
		}
		if(node.element || node.kind === "primitive") fields.push('( "data", _c.c_void_p)', '("length", _c.c_size_t)');
		else if(node.kind === "variant") fields.push('( "kind", _c.c_uint32)', `("cases", _OwnedUnion${i})`);
		else
		{
			if(node.kind === "option") fields.push('( "has_value", _c.c_uint8)');
			if(node.kind === "result") fields.push('( "is_ok", _c.c_uint8)');
			if(node.kind === "record" && !node.fields.length) fields.push('( "empty", _c.c_uint8)');
			fields.push(...node.fields.map(member));
		}
		raw.push(`${node.raw}._fields_ = [${fields.join(", ")}]\n`);
	}
	const conversions = [];
	for(const node of nodes.values())
	{
		const i = node.index, input = [], output = [];
		const inputField = (field, slot, destination) => {
			const child = nodes.get(field.type);
			return [`child = _owned_input${child.index}(${slot}, scope, depth + 1)`
				, "if not scope.check_only:"
				, `    ${destination} = ${field.pointer ? "_c.addressof(child)" : "child"}`];
		};
		const outputField = (field, slot) => {
			const child = nodes.get(field.type);
			return `_owned_output${child.index}(${field.pointer ? `_owned_read(${slot}, ${child.raw})` : slot}, scope, output, depth + 1)`;
		};
		if(!finite.has(node.id))
		{ input.push('raise ValueError("The declared type has no finite value")'); output.push('raise _OwnedInvalidNative("Uninhabited native value")'); }
		else if(node.identity)
		{
			input.push(`if type(value) is not _V.${node.publicType}: raise TypeError("Expected ${node.publicType}")`
				, "handle = value._raw(scope.state)", "scope.pin(value._lease)"
				, ...transfers && !anchors ? ["if scope.moves is not None and scope.move_group is not None:", "    scope.moves.add(value._lease, scope.move_group, scope)"] : []
				, "return handle");
			output.push('if not value: raise _OwnedInvalidNative("Missing native resource")'
				, 'scope.charge("storage", 256)', `return _V.${node.publicType}._from_lease(output.hold(), value)`);
		}
		else if(node.kind === "primitive")
		{
			const { name } = node;
			if(name === "unit")
			{ input.push('if value is not None: raise TypeError("Unit requires None")', "return 0"); output.push('if value != 0: raise _OwnedInvalidNative("Invalid native Unit")', "return None"); }
			else if(name === "bool")
			{ input.push('if type(value) is not bool: raise TypeError("Bool requires bool")', "return int(value)"); output.push('if value not in (0, 1): raise _OwnedInvalidNative("Invalid native Bool")', "return bool(value)"); }
			else if(name === "char")
			{
				input.push('if type(value) is not str: raise TypeError("Char requires str")', 'if len(value) != 1 or 0xd800 <= ord(value) <= 0xdfff: raise ValueError("Char requires one Unicode scalar")', "return ord(value)");
				output.push('if value > 0x10ffff or 0xd800 <= value <= 0xdfff: raise _OwnedInvalidNative("Invalid native Char")', 'scope.charge("storage", 80)', "_R._owned_checkpoint()", "return chr(value)");
			}
			else if(node.integer)
			{
				input.push(`_owned_integer(value, ${name === "nat" ? "0" : "None"}, None)`, "length = (value.bit_length() + 63) // 64"
					, 'scope.charge("native", length, 8)', 'scope.charge("storage", length, 16)'
					, 'scope.charge("native", _c.sizeof(_OwnedMpz))'
					, "out = scope.value(_OwnedMpz)", "buffer = scope.allocate(_c.c_uint64, length)", "if scope.check_only: return None"
					, 'data = abs(value).to_bytes(length * 8, "little")', "if length: _c.memmove(buffer, data, length * 8)"
					, "out.data = _c.addressof(buffer) if length else None", "out.size = -length if value < 0 else length", "return _c.addressof(out)");
				output.push('scope.charge("native", _c.sizeof(_OwnedMpz))', "value = _owned_read(value, _OwnedMpz)", "length = abs(value.size)"
					, ...name === "nat" ? ['if value.size < 0: raise _OwnedInvalidNative("Negative native Nat")'] : []
					, 'if value.allocated < 0 or value.allocated != 0 and value.allocated < length: raise _OwnedInvalidNative("Invalid native GMP capacity")'
					, 'scope.charge("native", length, 8)', 'scope.charge("storage", length, 16)'
					, "pointer = _owned_span(value.data, length, _c.c_uint64)", "_R._owned_checkpoint()"
					, 'data = _c.string_at(pointer, length * 8) if length else b""'
					, 'if length and int.from_bytes(data[-8:], "little") == 0: raise _OwnedInvalidNative("Noncanonical native GMP integer")'
					, 'magnitude = int.from_bytes(data, "little")', "return -magnitude if value.size < 0 else magnitude");
			}
			else if(name === "string" || name === "bytes")
			{
				input.push(`if type(value) is not ${name === "string" ? "str" : "bytes"}: raise TypeError("Expected ${name === "string" ? "str" : "bytes"}")`
					, `length = ${name === "string" ? "_owned_text_size(value, scope.native)" : "len(value)"}`
					, 'scope.charge("native", length)', 'scope.charge("storage", length)'
					, `out = scope.value(${node.raw})`, "buffer = scope.allocate(_c.c_uint8, length)", "if not scope.check_only:"
					, `    data = ${name === "string" ? 'value.encode("utf-8", "strict")' : "value"}`, "    if length: _c.memmove(buffer, data, length)"
					, "    out.data = _c.addressof(buffer) if length else None", "    out.length = length", "return out");
				output.push('scope.charge("native", value.length)', `scope.charge("storage", value.length, ${name === "string" ? 5 : 1})`
					, "pointer = _owned_span(value.data, value.length, _c.c_uint8)", "_R._owned_checkpoint()", 'data = _c.string_at(pointer, value.length) if value.length else b""');
				if(name === "string") output.push("try:", '    return data.decode("utf-8", "strict")', "except _b.UnicodeDecodeError as error:", '    raise _OwnedInvalidNative("Invalid native UTF-8") from error');
				else output.push("return data");
			}
			else if(name.startsWith("float"))
			{
				input.push('if type(value) is not float: raise TypeError("Float requires float without numeric coercion")', `return ${name === "float32" ? "value if scope.check_only else _c.c_float(value).value" : "value"}`);
				output.push('scope.charge("storage", 32)', "return value");
			}
			else
			{
				const signed = name.startsWith("int") || name === "isize", bits = name.endsWith("size") ? 64 : Number(name.match(/\d+/u)[0]);
				input.push(`return _owned_integer(value, ${signed ? `-(1 << ${bits - 1})` : "0"}, (1 << ${signed ? bits - 1 : bits}) - 1)`);
				output.push('scope.charge("storage", 40)', "return value");
			}
		}
		else if(node.element)
		{
			const child = nodes.get(node.element);
			input.push('if type(value) not in (list, tuple): raise TypeError("Expected list or tuple")', "length = len(value)"
				, 'if length > scope.nodes: raise _OwnedLimit("Owned value node limit exceeded")'
				, `out = scope.value(${node.raw})`, `buffer = scope.allocate(${child.raw}, length)`
				, "for index in range(length):", `    child = _owned_input${child.index}(value[index], scope, depth + 1)`
				, "    if not scope.check_only: buffer[index] = child"
				, 'if len(value) != length: raise ValueError("Do not mutate input during conversion")'
				, "if not scope.check_only:", "    out.data = _c.addressof(buffer) if length else None", "    out.length = length", "return out");
			output.push('if value.length > scope.nodes: raise _OwnedLimit("Owned value node limit exceeded")'
				, 'scope.charge("storage", value.length, 16)', 'scope.charge("storage", 128)'
				, `pointer = _owned_span(value.data, value.length, ${child.raw})`
				, `memory = (${child.raw} * value.length).from_address(pointer) if value.length else ()`
				, "_R._owned_checkpoint()", "result = []", "for child in memory:"
				, `    result.append(_owned_output${child.index}(child, scope, output, depth + 1))`, "_R._owned_checkpoint()", "return tuple(result)");
		}
		else if(node.kind === "variant")
		{
			node.cases.forEach((branch, j) => {
				input.push(`if type(value) is _V.${branch.publicName}:`, `    out = scope.value(${node.raw})`, `    if not scope.check_only: out.kind = ${j}`
					, ...branch.fields.flatMap((field, k) => inputField(field, `value.${field.publicName}`, `out.cases.case${j}.field${k}`)).map(line => `    ${line}`), "    return out");
				output.push(`if value.kind == ${j}:`, `    scope.charge("storage", ${256 + branch.fields.length * 16})`, "    _R._owned_checkpoint()"
					, `    return _V.${branch.publicName}(${branch.fields.map((field, k) => outputField(field, `value.cases.case${j}.field${k}`)).join(", ")})`);
			});
			input.push(`raise TypeError("Expected a named ${node.publicType} constructor")`);
			output.push('raise _OwnedInvalidNative("Invalid native variant constructor")');
		}
		else if(node.kind === "option" || node.kind === "result")
		{
			const option = node.kind === "option", flag = option ? "has_value" : "is_ok";
			if(option)
			{ input.push(`if value is None: return scope.value(${node.raw})`); output.push("if value.has_value == 0: return None"); }
			node.fields.forEach((field, j) => {
				const name = option ? "Some" : j ? "Err" : "Ok", tag = j ? 0 : 1;
				input.push(`if type(value) is _V.${name}:`, `    out = scope.value(${node.raw})`, `    if not scope.check_only: out.${flag} = ${tag}`
					, ...inputField(field, "value.value", `out.field${j}`).map(line => `    ${line}`), "    return out");
				output.push(`if value.${flag} == ${tag}:`, '    scope.charge("storage", 272)', "    _R._owned_checkpoint()"
					, `    return _V.${name}(${outputField(field, `value.field${j}`)})`);
			});
			input.push(`raise TypeError("Expected ${option ? "None or Some(value)" : "Ok(value) or Err(value)"}")`);
			output.push('raise _OwnedInvalidNative("Invalid native constructor flag")');
		}
		else
		{
			const tuple = node.kind === "tuple";
			input.push(tuple ? 'if type(value) is not tuple or len(value) != 2: raise TypeError("Prod requires a two-element tuple")' : `if type(value) is not _V.${node.publicType}: raise TypeError("Expected ${node.publicType}")`
				, `out = scope.value(${node.raw})`, ...node.fields.flatMap((field, j) => inputField(field, tuple ? `value[${j}]` : `value.${field.publicName}`, `out.field${j}`)), "return out");
			const items = node.fields.map((field, j) => outputField(field, `value.field${j}`)).join(", ");
			output.push(`scope.charge("storage", ${256 + node.fields.length * 16})`, "_R._owned_checkpoint()", `return ${tuple ? `(${items})` : `_V.${node.publicType}(${items})`}`);
		}
		const track = !node.leaf;
		conversions.push(`def _owned_input${i}(value, scope, depth=0):`, `    key = ${track ? "_b.id(value)" : "None"}`
			, `    scope.enter(key, depth, ${node.raw})`, "    try:", ...input.map(line => `        ${line}`), "    finally:", "        scope.leave(key)"
			, ...anchors ? ["        value = child = memory = out = None"] : [], ""
			, `def _owned_output${i}(value, scope, output, depth=0):`
			, ...node.identity || node.integer || node.scalar ? [`    if type(value) is ${node.raw}: value = value.value`] : []
			, `    key = ${track ? `(${i}, _c.addressof(value))` : "None"}`
			, `    scope.enter(key, depth, ${node.raw}, True)`, "    try:", ...output.map(line => `        ${line}`), "    finally:", "        scope.leave(key)", "");
	}
	const calls = [], models = [], bindings = [];
	const all = [...c.functions, ...c.callbacks, ...c.retains, ...c.copies];
	for(const [group, functions] of [["call", c.functions], ["invoke", c.callbacks], ["retain", c.retains], ["copy", c.copies]]) for(const [index, fn] of functions.entries())
	{
		const parameters = fn.parameters.map(id => nodes.get(id)), result = nodes.get(fn.result);
		const moving = fn.transfers ?? [];
		const host = parameters.map((_, i) => c.hostArgument(fn, i));
		const input = (node, i, checking) => host[i]
			? `_owned_host${node.index}(arg${i}, ${checking ? "checked" : "scope, frame"})`
			: `_owned_input${node.index}(arg${i}, ${checking ? "checked" : "scope"})`;
		const name = `_${group}${group === "call" ? index : nodes.get(fn.id).index}`, native = `_fn${models.length}`;
		models.push({ ...fn, group, name, native, parameters, result });
		bindings.push(`    ${native} = runtime.library[${JSON.stringify(fn.cName)}]`
			, `    ${native}.argtypes = [_c.c_void_p, ${parameters.flatMap((node, i) => [host[i] ? `_c.POINTER(_OwnedHost${node.index})` : node.leaf ? node.raw : `_c.POINTER(${node.raw})`, ...moving.includes(i) ? ["_c.POINTER(_c.c_void_p)"] : [], ...fn.anchor === i ? ["_c.c_void_p"] : []]).join(", ")}${parameters.length ? ", " : ""}_c.POINTER(${result.raw}), _c.POINTER(_c.c_void_p)]`
			, `    ${native}.restype = _c.c_uint32`);
		if(anchors) calls.push(...ownedPythonAnchoredCall(models.at(-1), all, c));
		else calls.push(`def ${name}(${parameters.map((_, i) => `arg${i}`).join(", ")}):`, "    if _runtime is None: raise RuntimeError('Build the native adapter before calling this API')"
			, "    state = _runtime.current_state()", "    checked = _OwnedScope(state, True)", "    try:"
			, ...parameters.length ? parameters.map((node, i) => `        ${input(node, i, true)}`) : ["        pass"]
			, "    finally:", "        checked.close()", "    scope = _OwnedScope(state)"
			, "    frame = _OwnedCall(state, scope)", ...moving.length ? ["    moves = None"] : [], "    try:"
			, ...moving.length ? [`        moves = _OwnedInputTransfers(state, ${moving.length}, scope)`, "        scope.moves = moves"] : []
			, ...parameters.flatMap((node, i) => [...moving.length ? [`        scope.move_group = ${moving.includes(i) ? moving.indexOf(i) : "None"}`] : [], `        input${i} = ${input(node, i, false)}`])
			, ...moving.length ? ["        scope.move_group = None"
				, ...moving.flatMap((parameter, group) => {
					const node = parameters[parameter], copyIndex = all.findIndex(root => (root.retain || root.copy) && root.id === node.id);
					if(copyIndex < 0) throw new TypeError(`Missing owned Python input snapshot for ${node.id}`);
					return [`        moved${parameter} = scope.value(${node.raw})`
						, `        _R._owned_checked(_fn${copyIndex}(state.require(), ${node.leaf ? `input${parameter}` : `_c.byref(input${parameter})`}, _c.byref(moved${parameter}), _c.byref(moves.owners[${group}].value)))`];
				})
			] : []
			, `        raw = scope.value(${result.raw})`, "        with _R._OwnedNativeOwner(state) as owner:"
			, ...moving.length ? ["            session = state.require()", "            moves.arm()", "            try:"] : []
			, `            ${moving.length ? "    " : ""}status = ${native}(${[moving.length ? "session" : "state.require()", ...parameters.flatMap((node, i) => moving.includes(i) ? [node.leaf ? `moved${i}` : `_c.byref(moved${i})`, `_c.byref(moves.owners[${moving.indexOf(i)}].value)`] : [!host[i] && node.leaf ? `input${i}` : `_c.byref(input${i})`]), "_c.byref(raw)", "_c.byref(owner.value)"].join(", ")})`
			, ...moving.length ? ["            finally:", "                moves.finish()"] : []
			, "            frame.finish(status)"
			, `            return _owned_output${result.index}(raw, scope, _OwnedOutput(owner))`
			, "    except _OwnedInvalidNative:"
			, "        _runtime.retire()", "        raise", "    finally:"
			, ...moving.length ? ["        if moves is not None: moves.close()"] : []
			, "        frame.close()", "        scope.close()", "");
	}
	const callbacks = ownedPythonCallbacks(c, nodes, models);
	const equalityNames = [];
	if(anchors) for(const node of nodes.values()) if(node.identity)
	{
		const native = `_equal_native${node.index}`; equalityNames.push(native);
		bindings.push(`    ${native} = runtime.library["${node.cName}_equal"]`
			, `    ${native}.argtypes = [_c.c_void_p, _c.c_void_p, _c.c_void_p, _c.POINTER(_c.c_bool)]`
			, `    ${native}.restype = _c.c_uint32`);
		calls.push(`def _equal${node.index}(left, right):`, "    try:"
			, `        if type(left) is not _V.${node.publicType} or type(right) is not _V.${node.publicType}: raise TypeError("Expected ${node.publicType}")`
			, "        state = _runtime.current_state()", "        _R._owned_checkpoint()"
			, "        equal = _c.c_bool()"
			, `        _R._owned_checked(${native}(state.require(), left._raw(state), right._raw(state), _c.byref(equal)))`
			, "        return equal.value", "    finally:", "        left = right = None", "");
	}
	return { ...values, types: [...nodes.values()], valuesSource: values.source
		, rawTypes: [...nodes.values()].map(node => ({ id: node.id, name: node.raw, index: node.index }))
		, rawSource: raw.join("\n"), callModels: models
		, callbackLayouts: callbacks.layouts
		, source: [support(c.native.model.limits, transfers, anchors)
			, ...transfers ? [anchors ? ownedPythonAnchoredTransfers : ownedPythonTransfers] : []
			, ...raw, ...conversions
			, callbacks.source
			, "_runtime = None", "", "def _bind(runtime):"
			, `    global _runtime${models.map(model => `, ${model.native}`).join("")}${equalityNames.map(name => `, ${name}`).join("")}`
			, "    if _runtime is not None: raise RuntimeError('Native adapter is already bound')"
			, ...bindings, "    _runtime = runtime", "", ...calls
			, ...anchors ? [ownedPythonValueCopies(values, models)] : []].join("\n") };
};
