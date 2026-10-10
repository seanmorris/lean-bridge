/**
 * Render scoped ctypes input copies and independently owned Python results.
 *
 * @file
 */

/** Private allocation and error helpers; no raw pointers enter the public API. */
export const copiedPythonHelpers = `class _Scope:
    def __init__(self):
        self.remaining = 16 * 1024 * 1024
        self.owners = []
        self.failure = None

    def charge(self, count, width=1):
        if count < 0 or width < 1 or count > self.remaining // width:
            raise ValueError("16 MiB Python conversion limit exceeded")
        self.remaining -= count * width

    def allocate(self, element, count):
        self.charge(count, _c.sizeof(element))
        value = (element * count)()
        self.owners.append(value)
        return value

    def close(self):
        self.owners.clear()
        self.failure = None

def _integer(value, minimum, maximum):
    if type(value) is not int:
        raise TypeError("Expected an int, without Boolean or numeric coercion")
    if (minimum is not None and value < minimum) or (maximum is not None and value > maximum):
        raise ValueError("Integer is outside the declared Lean range")
    return value

def _text_size(value):
    if value.isascii():
        return len(value)
    return sum(1 if ord(c) < 0x80 else 2 if ord(c) < 0x800 else 3 if ord(c) < 0x10000 else 4 for c in value)

def _buffer(data, scope):
    memory = scope.allocate(_c.c_uint8, len(data))
    if data:
        _c.memmove(memory, data, len(data))
    return _c.addressof(memory) if data else None

def _read(data, length, scope, width=1):
    scope.charge(length, width)
    if length and not data:
        raise LeanBridgeError(5, "Native result has a missing buffer")
    return _c.string_at(data, length) if length else b""

class _Error(_c.Structure):
    _fields_ = [("code", _c.c_int), ("message", _c.c_void_p), ("message_length", _c.c_size_t)]

def _check(status, error, scope=None):
    if scope is not None and scope.failure is not None:
        raise scope.failure
    if status:
        message = _c.string_at(error.message, min(error.message_length, 16384)).decode("utf-8", "replace") if error.message else "Native Lean call failed"
        raise LeanBridgeError(status, message)
`;

/**
 * Describe the portable C-facing layout with ctypes, never Lean object offsets.
 *
 * @param model - Admitted copied Python model.
 */
export const copiedPythonTypes = model => model.surface.copies.filter(copy => copy.aggregate).map(copy => {
	if(copy.variant) return `${copy.cases.map((branch, index) => `class _V${copy.index}_${index}(_c.Structure):
    _fields_ = [${(branch.fields.length ? branch.fields.map(field => [field.publicName, field.type.ctype]) : [["empty", "_c.c_uint8"]]).map(([name, type]) => `(${JSON.stringify(name)}, ${type})`).join(", ")}]
`).join("\n")}
class _V${copy.index}(_c.Union):
    _fields_ = [${copy.cases.map((_, index) => `("case${index}", _V${copy.index}_${index})`).join(", ")}]

class ${copy.ctype}(_c.Structure):
    _fields_ = [("kind", _c.c_uint32), ("cases", _V${copy.index})]
`;
	const fields = copy.compound ? [...copy.compound === "tuple" ? [] : [[copy.compound === "option" ? "has_value" : "is_ok", "_c.c_uint8"]], ...copy.fields.map(field => [field.name, field.type.ctype])]
		: copy.record ? copy.fields.length ? copy.fields.map(field => [field.publicName, field.type.ctype]) : [["empty", "_c.c_uint8"]]
		: [["data", "_c.c_void_p"], ["length", "_c.c_size_t"], ["owner", "_c.c_void_p"], ["release", "_c.c_void_p"], ...(copy.scalarName === "int" ? [["negative", "_c.c_bool"]] : [])];
	return `class ${copy.ctype}(_c.Structure):\n    _fields_ = [${fields.map(([name, type]) => `(${JSON.stringify(name)}, ${type})`).join(", ")}]\n`;
}).join("\n");

/**
 * Emit one conversion pair for each closed copied type.
 *
 * @param model - Canonical native descriptions and public record names.
 */
export const copiedPythonConversions = model => model.surface.copies.map(copy => {
	const input = [], output = [], name = copy.scalarName;
	if(name === "unit")
	{
		input.push('if value is not None: raise TypeError("Unit requires None")', "return 0");
		output.push("return None");
	} else if(name === "bool")
	{
		input.push('if type(value) is not bool: raise TypeError("Bool requires bool")', "return value");
		output.push("return bool(value)");
	} else if(name === "char")
	{
		input.push('if type(value) is not str: raise TypeError("Char requires a string")', 'if len(value) != 1 or 0xd800 <= ord(value) <= 0xdfff: raise ValueError("Char requires one Unicode scalar")', "return ord(value)");
		output.push('if value > 0x10ffff or 0xd800 <= value <= 0xdfff: raise LeanBridgeError(5, "Invalid native Unicode scalar")', "return chr(value)");
	} else if(/^(?:u?int)(?:8|16|32|64)$/.test(name))
	{
		const signed = name.startsWith("int"), bits = Number(name.match(/\d+/)[0]);
		input.push(`return _integer(value, ${signed ? `-(1 << ${bits-1})` : "0"}, (1 << ${signed ? bits-1 : bits}) - 1)`);
		output.push("return value");
	} else if(name === "float32" || name === "float64")
	{
		input.push('if type(value) is not float: raise TypeError("Expected a float, without numeric coercion")', `return ${name === "float32" ? "_c.c_float(value).value" : "value"}`);
		output.push("return value");
	} else if(name === "string" || name === "bytes")
	{
		input.push(`if type(value) is not ${name === "string" ? "str" : "bytes"}: raise TypeError("Expected ${name === "string" ? "str" : "bytes"}")`);
		if(name === "string") input.push("scope.charge(_text_size(value))", 'value = value.encode("utf-8", "strict")');
		input.push(`return ${copy.ctype}(_buffer(value, scope), len(value), None, None)`);
		output.push(`return _read(value.data, value.length, scope${name === "string" ? ", 4" : ""})${name === "string" ? '.decode("utf-8", "strict")' : ""}`);
	} else if(name === "nat" || name === "int")
	{
		input.push(`_integer(value, ${name === "nat" ? "0" : "None"}, None)`, "length = (value.bit_length() + 31) // 32", "scope.charge(length, 4)", 'data = abs(value).to_bytes(length * 4, "little")', `return ${copy.ctype}(_buffer(data, scope), length, None, None${name === "int" ? ", value < 0" : ""})`);
		output.push('magnitude = int.from_bytes(_read(value.data, value.length * 4, scope, 2), "little")', `return ${name === "int" ? "-magnitude if value.negative else magnitude" : "magnitude"}`);
	} else if(copy.compound === "option")
	{
		const child = copy.fields[0].type;
		input.push(`if value is None: return ${copy.ctype}()`, 'if type(value) is not Some: raise TypeError("Option requires None or Some(value)")', `return ${copy.ctype}(1, _to${child.index}(value.value, scope))`);
		output.push('if value.has_value > 1: raise LeanBridgeError(5, "Invalid native option flag")', `return Some(_from${child.index}(value.value, scope)) if value.has_value else None`);
	} else if(copy.compound === "result")
	{
		const [ok, error] = copy.fields.map(field => field.type);
		input.push(`if type(value) is Ok: return ${copy.ctype}(is_ok=1, ok=_to${ok.index}(value.value, scope))`, `if type(value) is Err: return ${copy.ctype}(error=_to${error.index}(value.value, scope))`, 'raise TypeError("Result requires Ok(value) or Err(value)")');
		output.push('if value.is_ok > 1: raise LeanBridgeError(5, "Invalid native result flag")', `return Ok(_from${ok.index}(value.ok, scope)) if value.is_ok else Err(_from${error.index}(value.error, scope))`);
	} else if(copy.compound === "tuple")
	{
		input.push('if type(value) is not tuple: raise TypeError("Prod requires a two-element tuple")', 'if len(value) != 2: raise ValueError("Prod requires exactly two elements")', `return ${copy.ctype}(${copy.fields.map((field, index) => `_to${field.type.index}(value[${index}], scope)`).join(", ")})`);
		output.push(`return (${copy.fields.map(field => `_from${field.type.index}(value.${field.name}, scope)`).join(", ")})`);
	} else if(copy.variant)
	{
		copy.cases.forEach((branch, index) => {
			input.push(`if type(value) is ${branch.publicName}:`
				, `    return ${copy.ctype}(kind=${index}, cases=_V${copy.index}(case${index}=_V${copy.index}_${index}(${branch.fields.map(field => `${field.publicName}=_to${field.type.index}(value.${field.publicName}, scope)`).join(", ")})))`);
			output.push(`if value.kind == ${index}:`
				, `    return ${branch.publicName}(${branch.fields.map(field => `${field.publicName}=_from${field.type.index}(value.cases.case${index}.${field.publicName}, scope)`).join(", ")})`);
		});
		input.push(`raise TypeError("Expected a named ${copy.publicName} constructor")`);
		output.push(`raise LeanBridgeError(5, "Invalid native ${copy.publicName} constructor")`);
	} else if(copy.record)
	{
		input.push(`if type(value) is not ${copy.publicName}: raise TypeError("Expected ${copy.publicName}")`, `return ${copy.ctype}(${copy.fields.map(field => `_to${field.type.index}(value.${field.publicName}, scope)`).join(", ")})`);
		output.push(`return ${copy.publicName}(${copy.fields.map(field => `${field.publicName}=_from${field.type.index}(value.${field.publicName}, scope)`).join(", ")})`);
	} else
	{
		input.push('if type(value) not in (tuple, list): raise TypeError("Expected a tuple or list")', "scope.charge(len(value), 8)", "value = tuple(value)", `memory = scope.allocate(${copy.element.ctype}, len(value))`, "for index, item in enumerate(value):", `    memory[index] = _to${copy.element.index}(item, scope)`, `return ${copy.ctype}(_c.addressof(memory) if len(value) else None, len(value), None, None)`);
		output.push(`scope.charge(value.length, max(8, _c.sizeof(${copy.element.ctype})))`, 'if value.length and not value.data: raise LeanBridgeError(5, "Native array has a missing buffer")', `if value.length and value.data % _c.alignment(${copy.element.ctype}): raise LeanBridgeError(5, "Native array has a misaligned buffer")`, `memory = (${copy.element.ctype} * value.length).from_address(value.data) if value.length else ()`, `return tuple(_from${copy.element.index}(item, scope) for item in memory)`);
	}
	return `def _to${copy.index}(value, scope):
    scope.charge(1, _c.sizeof(${copy.ctype}))
${input.map(line => `    ${line}`).join("\n")}

def _from${copy.index}(value, scope):
    scope.charge(1, _c.sizeof(${copy.ctype}))
${output.map(line => `    ${line}`).join("\n")}
`;
}).join("\n");
