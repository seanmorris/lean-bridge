/**
 * Checked ctypes layouts and scoped conversions for finite native copied graphs.
 * Native loading and installed package admission remain separate policies.
 *
 * @file
 */
import { componentRecursiveLimits } from "../../abi/component-recursive.mjs";
import { generateCopiedPythonGraphValues } from "./copied-graph-values.mjs";

const primitives = {
	unit: "c_uint8", bool: "c_uint8", char: "c_uint32"
	, uint8: "c_uint8", uint16: "c_uint16", uint32: "c_uint32", uint64: "c_uint64"
	, int8: "c_int8", int16: "c_int16", int32: "c_int32", int64: "c_int64"
	, usize: "c_uint64", isize: "c_int64", float32: "c_float", float64: "c_double"
};
const support = `import ctypes as _c
import builtins as _b

if _c.sizeof(_c.c_void_p) != 8:
    raise ImportError("Native copied graphs require 64-bit pointers")

class _GraphInvalidNative(LeanBridgeError):
    def __init__(self, message="Invalid native copied value"):
        super().__init__(4, message)

class _GraphLimit(ValueError):
    pass

def _graph_checkpoint():
    pass

class _GraphScope:
    def __init__(self, check_only=False):
        self.check_only = check_only
        self.nodes = ${componentRecursiveLimits.valueNodes}
        self.native = 16 * 1024 * 1024
        self.storage = 16 * 1024 * 1024
        self.active = set()
        self.owners = []

    def charge(self, field, count, width=1):
        remaining = getattr(self, field)
        if count < 0 or width < 1 or count > remaining // width:
            raise _GraphLimit("16 MiB copied graph conversion limit exceeded")
        setattr(self, field, remaining - count * width)

    def enter(self, key, depth, raw, native_storage, output=False):
        if depth > ${componentRecursiveLimits.valueDepth} or self.nodes == 0:
            raise _GraphLimit("Copied graph depth or node limit exceeded")
        self.nodes -= 1
        if native_storage:
            self.charge("native", 1, _c.sizeof(raw))
        if key is not None:
            if key in self.active:
                if output:
                    raise _GraphInvalidNative("Cyclic native copied value")
                raise ValueError("Cyclic Python copied value")
            self.active.add(key)

    def leave(self, key):
        if key is not None:
            self.active.remove(key)

    def value(self, raw, value=None):
        self.charge("storage", 1, _c.sizeof(raw) + 256)
        if self.check_only:
            return None
        _graph_checkpoint()
        result = raw() if value is None else raw(value)
        self.owners.append(result)
        return result

    def allocate(self, raw, count):
        self.charge("storage", count, _c.sizeof(raw))
        self.charge("storage", 256)
        if self.check_only:
            return None
        _graph_checkpoint()
        result = (raw * count)()
        self.owners.append(result)
        return result

    def close(self):
        self.owners.clear()
        self.active.clear()

def _graph_integer(value, minimum, maximum):
    if type(value) is not int:
        raise TypeError("Expected an int without Boolean or numeric coercion")
    if minimum is not None and value < minimum or maximum is not None and value > maximum:
        raise ValueError("Integer is outside the declared Lean range")
    return value

def _graph_text_size(value, limit):
    if len(value) > limit:
        raise _GraphLimit("Copied graph UTF-8 limit exceeded")
    if value.isascii():
        return len(value)
    size = 0
    for character in value:
        code = ord(character)
        if 0xd800 <= code <= 0xdfff:
            raise ValueError("String requires Unicode scalar values")
        size += 1 if code < 0x80 else 2 if code < 0x800 else 3 if code < 0x10000 else 4
        if size > limit:
            raise _GraphLimit("Copied graph UTF-8 limit exceeded")
    return size

def _graph_span(pointer, count, raw):
    if not count:
        return 0
    width = _c.sizeof(raw)
    if (not pointer or pointer % _c.alignment(raw)
            or count > ((1 << 63) - 1) // width
            or pointer > (1 << 64) - 1 - count * width):
        raise _GraphInvalidNative("Missing, misaligned or overflowing native span")
    # The authenticated adapter supplies readable process memory. Address checks
    # do not make arbitrary foreign pointers safe to dereference.
    return pointer

def _graph_read(pointer, raw):
    return raw.from_address(_graph_span(pointer, 1, raw))

def _graph_status(status):
    if status == 0:
        return
    if status not in (1, 2, 3, 5):
        raise _GraphInvalidNative()
    raise LeanBridgeError(status, {1: "Invalid native input", 2: "Native copied graph limit exceeded", 3: "Native allocation failed", 5: "Lean runtime is unavailable"}[status])

_GraphRelease = _c.CFUNCTYPE(None, _c.c_void_p)

def _graph_clear(value):
    if value is None or not _b.hasattr(value, "owner"):
        return
    owner, release = value.owner, value.release
    _c.memset(_c.addressof(value), 0, _c.sizeof(value))
    if owner and release:
        _GraphRelease(release)(owner)
`;

/**
 * Emit typed C layout views and checked conversion/call functions. Public values
 * are supplied by the companion declarations, plus the public LeanBridgeError.
 *
 * @param ir - Concrete compiler-checked copied graph contract.
 */
export const generateCopiedPythonGraphConversions = ir => {
	const values = generateCopiedPythonGraphValues(ir), { layout } = values;
	const nodes = new Map(values.types.map(node => [node.id, { ...node, raw: node.aggregate ? `_Raw${node.index}` : `_c.${primitives[node.ref.name]}` }]));
	const publicNames = new Set([...nodes.values()].flatMap(node => node.kind === "record" ? [node.publicType]
		: node.kind === "variant" ? node.cases.map(branch => branch.publicName)
			: node.kind === "option" ? ["Some"] : node.kind === "result" ? ["Ok", "Err"] : []));
	// Keep public type names separate from conversion locals such as value/scope.
	const publicSource = `class _GraphValues:\n${publicNames.size ? [...publicNames].map(name => `    ${name} = ${name}`).join("\n") : "    pass"}\n`;
	const finite = new Set();
	let changed = true;
	while(changed)
	{
		changed = false;
		for(const node of nodes.values())
		{
			const all = fields => fields.every(field => finite.has(field.type));
			const inhabited = node.kind === "primitive" || node.element || node.kind === "option"
				|| (node.kind === "variant" ? node.cases.some(branch => all(branch.fields)) : node.kind === "result" ? node.fields.some(field => finite.has(field.type)) : all(node.fields));
			if(!finite.has(node.id) && inhabited)
			{
				finite.add(node.id); changed = true;
			}
		}
	}
	const raw = [...nodes.values()].filter(node => node.aggregate).map(node => `class ${node.raw}(_c.Structure):\n    pass\n`);
	const member = (field, i) => `("field${i}", ${field.storage === "pointer" ? "_c.c_void_p" : nodes.get(field.type).raw})`;
	for(const id of layout.order)
	{
		const node = nodes.get(id), i = node.index;
		if(!node.aggregate) continue;
		if(node.kind === "variant")
		{
			node.cases.forEach((branch, j) => raw.push(`class _Case${i}_${j}(_c.Structure):\n    _fields_ = [${branch.fields.length ? branch.fields.map(member).join(", ") : '("empty", _c.c_uint8)'}]\n`));
			raw.push(`class _Union${i}(_c.Union):\n    _fields_ = [${node.cases.map((_, j) => `("case${j}", _Case${i}_${j})`).join(", ")}]\n`);
		}
		const fields = ['("owner", _c.c_void_p)', '("release", _c.c_void_p)'];
		if(node.kind === "primitive" || node.element)
		{
			fields.push('("data", _c.c_void_p)', '("length", _c.c_size_t)');
			if(node.ref.name === "int") fields.push('("negative", _c.c_uint8)');
		}
		else if(node.kind === "variant") fields.push('("kind", _c.c_uint32)', `("cases", _Union${i})`);
		else
		{
			if(node.kind === "option") fields.push('("has_value", _c.c_uint8)');
			if(node.kind === "result") fields.push('("is_ok", _c.c_uint8)');
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
			return [`child = _graph_input${child.index}(${slot}, scope, depth + 1, ${field.storage === "pointer" ? "True" : "False"})`
				, "if not scope.check_only:"
				, `    ${destination} = ${field.storage === "pointer" ? "_c.addressof(child)" : "child"}`];
		};
		const outputField = (field, slot) => {
			const child = nodes.get(field.type);
			return `_graph_output${child.index}(${field.storage === "pointer" ? `_graph_read(${slot}, ${child.raw})` : slot}, scope, depth + 1, ${field.storage === "pointer" ? "True" : "False"})`;
		};
		if(!finite.has(node.id))
		{
			input.push('raise ValueError("The declared copied type has no finite value")');
			output.push('raise _GraphInvalidNative("Uninhabited native copied value")');
		}
		else if(node.kind === "primitive")
		{
			const name = node.ref.name;
			if(name === "unit")
			{
				input.push('if value is not None: raise TypeError("Unit requires None")', "return 0");
				output.push('if value != 0: raise _GraphInvalidNative("Invalid native Unit")', "return None");
			}
			else if(name === "bool")
			{
				input.push('if type(value) is not bool: raise TypeError("Bool requires bool")', "return int(value)");
				output.push('if value not in (0, 1): raise _GraphInvalidNative("Invalid native Bool")', "return bool(value)");
			}
			else if(name === "char")
			{
				input.push('if type(value) is not str: raise TypeError("Char requires str")', 'if len(value) != 1 or 0xd800 <= ord(value) <= 0xdfff: raise ValueError("Char requires one Unicode scalar")', "return ord(value)");
				output.push('if value > 0x10ffff or 0xd800 <= value <= 0xdfff: raise _GraphInvalidNative("Invalid native Char")', 'scope.charge("storage", 80)', "_graph_checkpoint()", "return chr(value)");
			}
			else if(name === "float32" || name === "float64")
			{
				input.push('if type(value) is not float: raise TypeError("Float requires float without numeric coercion")', `return ${name === "float32" ? "value if scope.check_only else _c.c_float(value).value" : "value"}`);
				output.push('scope.charge("storage", 32)', "return value");
			}
			else if(name === "nat" || name === "int" || name === "string" || name === "bytes")
			{
				const limbs = name === "nat" || name === "int", element = limbs ? "_c.c_uint32" : "_c.c_uint8", width = limbs ? 4 : 1;
				if(limbs) input.push(`_graph_integer(value, ${name === "nat" ? "0" : "None"}, None)`, "length = (value.bit_length() + 31) // 32");
				else input.push(`if type(value) is not ${name === "string" ? "str" : "bytes"}: raise TypeError("Expected ${name === "string" ? "str" : "bytes"}")`, `length = ${name === "string" ? "_graph_text_size(value, scope.native)" : "len(value)"}`);
				input.push(`scope.charge("native", length, ${width})`, `scope.charge("storage", length, ${limbs ? 8 : 1})`
					, `out = scope.value(${node.raw})`, `buffer = scope.allocate(${element}, length)`
					, "if not scope.check_only:", `    data = ${limbs ? 'abs(value).to_bytes(length * 4, "little")' : name === "string" ? 'value.encode("utf-8", "strict")' : "value"}`
					, `    if length: _c.memmove(buffer, data, length * ${width})`, "    out.data = _c.addressof(buffer) if length else None", "    out.length = length"
					, ...name === "int" ? ["    out.negative = value < 0"] : [], "return out");
				output.push(...name === "int" ? ['if value.negative > 1: raise _GraphInvalidNative("Invalid native integer sign")'] : []
					, `scope.charge("native", value.length, ${width})`, `scope.charge("storage", value.length, ${limbs ? 8 : name === "string" ? 5 : 1})`
					, `pointer = _graph_span(value.data, value.length, ${element})`, "_graph_checkpoint()", `data = _c.string_at(pointer, value.length * ${width}) if value.length else b""`);
				if(limbs) output.push('magnitude = int.from_bytes(data, "little")', `return ${name === "int" ? "-magnitude if value.negative else magnitude" : "magnitude"}`);
				else if(name === "string") output.push("try:", '    return data.decode("utf-8", "strict")', "except _b.UnicodeDecodeError as error:", '    raise _GraphInvalidNative("Invalid native UTF-8") from error');
				else output.push("return data");
			}
			else
			{
				const signed = name.startsWith("int") || name === "isize", bits = name.endsWith("size") ? 64 : Number(name.match(/\d+/)[0]);
				input.push(`return _graph_integer(value, ${signed ? `-(1 << ${bits - 1})` : "0"}, (1 << ${signed ? bits - 1 : bits}) - 1)`);
				output.push('scope.charge("storage", 40)', "return value");
			}
		}
		else if(node.element)
		{
			const child = nodes.get(node.element);
			input.push('if type(value) not in (list, tuple): raise TypeError("Expected a list or tuple")', "length = len(value)", 'if length > scope.nodes: raise _GraphLimit("Copied graph node limit exceeded")'
				, `scope.charge("native", length, _c.sizeof(${child.raw}))`, `out = scope.value(${node.raw})`, `buffer = scope.allocate(${child.raw}, length)`
				, "for index in range(length):", `    child = _graph_input${child.index}(value[index], scope, depth + 1, False)`, "    if not scope.check_only: buffer[index] = child"
				, 'if len(value) != length: raise ValueError("Do not mutate copied input during conversion")', "if not scope.check_only:", "    out.data = _c.addressof(buffer) if length else None", "    out.length = length", "return out");
			output.push('if value.length > scope.nodes: raise _GraphLimit("Copied graph node limit exceeded")'
				, `scope.charge("native", value.length, _c.sizeof(${child.raw}))`, 'scope.charge("storage", value.length, 16)', 'scope.charge("storage", 128)'
				, `pointer = _graph_span(value.data, value.length, ${child.raw})`, `memory = (${child.raw} * value.length).from_address(pointer) if value.length else ()`
				, "_graph_checkpoint()", "result = []", "for child in memory:", `    result.append(_graph_output${child.index}(child, scope, depth + 1, False))`, "_graph_checkpoint()", "return tuple(result)");
		}
		else if(node.kind === "variant")
		{
			node.cases.forEach((branch, j) => {
				input.push(`if type(value) is _GraphValues.${branch.publicName}:`, `    out = scope.value(${node.raw})`, `    if not scope.check_only: out.kind = ${j}`
					, ...branch.fields.flatMap((field, k) => inputField(field, `value.${field.publicName}`, `out.cases.case${j}.field${k}`)).map(line => `    ${line}`), "    return out");
				output.push(`if value.kind == ${j}:`, `    scope.charge("storage", ${256 + branch.fields.length * 16})`, "    _graph_checkpoint()"
					, `    return _GraphValues.${branch.publicName}(${branch.fields.map((field, k) => outputField(field, `value.cases.case${j}.field${k}`)).join(", ")})`);
			});
			input.push(`raise TypeError("Expected a named ${node.publicType} constructor")`);
			output.push(`raise _GraphInvalidNative("Invalid native ${node.publicType} constructor")`);
		}
		else if(node.kind === "option" || node.kind === "result")
		{
			const option = node.kind === "option", flag = option ? "has_value" : "is_ok";
			if(option)
			{
				input.push(`if value is None: return scope.value(${node.raw})`);
				output.push("if value.has_value == 0: return None");
			}
			node.fields.forEach((field, j) => {
				const name = option ? "Some" : j ? "Err" : "Ok", tag = j ? 0 : 1;
				input.push(`if type(value) is _GraphValues.${name}:`, `    out = scope.value(${node.raw})`, `    if not scope.check_only: out.${flag} = ${tag}`
					, ...inputField(field, "value.value", `out.field${j}`).map(line => `    ${line}`), "    return out");
				output.push(`if value.${flag} == ${tag}:`, '    scope.charge("storage", 272)', "    _graph_checkpoint()", `    return _GraphValues.${name}(${outputField(field, `value.field${j}`)})`);
			});
			input.push(`raise TypeError("Expected ${option ? "None or Some(value)" : "Ok(value) or Err(value)"}")`);
			output.push(`raise _GraphInvalidNative("Invalid native ${node.kind} flag")`);
		}
		else
		{
			const tuple = node.kind === "tuple";
			input.push(tuple ? 'if type(value) is not tuple or len(value) != 2: raise TypeError("Prod requires a two-element tuple")' : `if type(value) is not _GraphValues.${node.publicType}: raise TypeError("Expected ${node.publicType}")`, `out = scope.value(${node.raw})`
				, ...node.fields.flatMap((field, j) => inputField(field, tuple ? `value[${j}]` : `value.${field.publicName}`, `out.field${j}`)), "return out");
			const items = node.fields.map((field, j) => outputField(field, `value.field${j}`)).join(", ");
			output.push(`scope.charge("storage", ${256 + node.fields.length * 16})`, "_graph_checkpoint()", `return ${tuple ? `(${items})` : `_GraphValues.${node.publicType}(${items})`}`);
		}
		const track = node.kind !== "primitive";
		conversions.push(`def _graph_input${i}(value, scope, depth=0, native_storage=True):`
			, `    key = ${track ? "_b.id(value)" : "None"}`, `    scope.enter(key, depth, ${node.raw}, native_storage)`, "    try:", ...input.map(line => `        ${line}`), "    finally:", "        scope.leave(key)", ""
			, `def _graph_output${i}(value, scope, depth=0, native_storage=True):`
			, `    key = ${track ? `(${i}, _c.addressof(value))` : "None"}`, `    scope.enter(key, depth, ${node.raw}, native_storage, True)`, "    try:", ...output.map(line => `        ${line}`), "    finally:", "        scope.leave(key)", "");
	}
	const calls = [];
	for(const root of layout.roots)
	{
		const parameters = root.parameters.map(id => nodes.get(id)), result = nodes.get(root.result), name = root.name.slice(layout.prefix.length + 1);
		calls.push(`def _graph_call_${name}(invoke${parameters.map((_, j) => `, arg${j}`).join("")}, *, lifecycle=None):`
			, "    checked = _GraphScope(True)", "    try:", ...parameters.length ? parameters.map((node, j) => `        _graph_input${node.index}(arg${j}, checked)`) : ["        pass"]
			, "    finally:", "        checked.close()", "    scope = _GraphScope()", "    output = None", "    try:"
			, ...parameters.map((node, j) => `        input${j} = ${node.aggregate ? `_graph_input${node.index}(arg${j}, scope)` : `scope.value(${node.raw}, _graph_input${node.index}(arg${j}, scope))`}`)
			, `        output = scope.value(${result.raw})`, ...result.kind === "variant" ? ["        output.kind = (1 << 32) - 1"] : []
			, "        if lifecycle is not None: _graph_status(lifecycle[0]())"
			, `        _graph_status(invoke(${[...parameters.map((_, j) => `_c.byref(input${j})`), "_c.byref(output)"].join(", ")}))`
			, `        result = _graph_output${result.index}(${result.aggregate ? "output" : "output.value"}, scope)`
			, '        if lifecycle is not None and not lifecycle[1](): raise LeanBridgeError(5, "Lean runtime is unavailable")'
			, "        return result", "    except _GraphInvalidNative:", "        if lifecycle is not None: lifecycle[2]()", "        raise"
			, "    finally:", "        try:", "            _graph_clear(output)", "        finally:", "            scope.close()", "");
	}
	return { ...values, valuesSource: values.source
		, rawTypes: [...nodes.values()].map(node => ({ id: node.id, name: node.raw, index: node.index }))
		, rawSource: raw.join("\n")
		, source: [support, publicSource, ...raw, ...conversions, ...calls, ""].join("\n") };
};
