/**
 * Generate strict PHP checks and scoped FFI conversions for the public C ABI.
 *
 * @file
 */
import { phpValue, phpCallableDefinitions } from "./callables.mjs";

/**
 * Declare C layouts and calls without preprocessing or Lean layout assumptions.
 *
 * @param model - Admitted copied PHP projection.
 */
export const copiedPhpDefinitions = model => {
	const { surface } = model;
	return ["typedef struct { int code; void *message; size_t message_length; } BridgeError;"
		, ...surface.copies.filter(copy => copy.aggregate).map(copy => `typedef struct { ${copy.compound === "option" ? "uint8_t has_value; " : copy.compound === "result" ? "uint8_t is_ok; " : ""}${copy.record || copy.compound ? copy.fields.length ? copy.fields.map(field => `${field.type.ctype} ${field.name};`).join(" ") : "uint8_t empty;" : `void *data; size_t length; void *owner; void (*release)(void *);${copy.scalarName === "int" ? " bool negative;" : ""}`} } ${copy.ctype};\nvoid ${copy.name}_clear(${copy.ctype} *);`)
		, ...surface.callbacks.size ? [phpCallableDefinitions(model)] : []
		, ...surface.functions.map(fn => { const result = phpValue(model, fn.declaration.result.type); return `int ${fn.name}(${fn.declaration.parameters.map(site => { const copy = phpValue(model, site.type); return copy.ctype + (copy.aggregate || copy.type?.callable ? " *" : ""); }).concat(fn.resultType === "void" ? [] : [result.type?.callable ? `${result.ownedType} **` : `${result.ctype} *`]).concat("BridgeError *").join(", ")});`; })
	].join("\n");
};

/**
 * Validate exact PHP values even when an application has strict_types disabled.
 *
 * @param model - Admitted public type names and copied shapes.
 */
export const copiedPhpChecks = model => model.surface.copies.map(copy => {
	const lines = [], name = copy.scalarName, publicType = copy.publicType.startsWith("\\") ? copy.publicType : `\\${model.namespace}\\${copy.publicType}`;
	if(name === "unit") lines.push("if ($value !== null) throw new \\TypeError('Unit requires null');");
	else if(name === "bool") lines.push("if (!is_bool($value)) throw new \\TypeError('Bool requires bool');");
	else if(/^(?:u?int)(?:8|16|32|64)$/.test(name) && copy.publicType !== "\\Brick\\Math\\BigInteger")
	{
		const bits = Number(name.match(/\d+/)[0]), signed = name.startsWith("int");
		lines.push("if (!is_int($value)) throw new \\TypeError('Expected an int without numeric coercion');");
		if(bits !== 64) lines.push(`if ($value < ${signed ? -(2 ** (bits-1)) : 0} || $value > ${2 ** (signed ? bits-1 : bits) - 1}) throw new \\ValueError('Integer is outside the declared Lean range');`);
	} else if(copy.publicType === "\\Brick\\Math\\BigInteger")
	{
		lines.push(`if (!$value instanceof ${publicType}) throw new \\TypeError('Expected Brick Math BigInteger');`, "$decimal = (string) $value;", "if (strlen($decimal) > 16385 || strlen(ltrim($decimal, '-')) > 16384 || preg_match('/^(?:0|-?[1-9][0-9]*)$/D', $decimal) !== 1) throw new \\ValueError('BigInteger requires canonical decimal text of at most 16384 digits');", "$budget->charge(strlen($decimal));");
		if(name !== "int" && name !== "int64") lines.push("if ($decimal[0] === '-') throw new \\ValueError('Expected an unsigned integer');");
		if(name === "uint64") lines.push("if (strlen($decimal) > 20 || (strlen($decimal) === 20 && strcmp($decimal, '18446744073709551615') > 0)) throw new \\ValueError('Integer is outside the UInt64 range');");
		if(name === "uint32") lines.push("if (strlen($decimal) > 10 || (strlen($decimal) === 10 && strcmp($decimal, '4294967295') > 0)) throw new \\ValueError('Integer is outside the UInt32 range');");
		if(name === "int64") lines.push("$magnitude = ltrim($decimal, '-');", "$limit = $decimal[0] === '-' ? '9223372036854775808' : '9223372036854775807';", "if (strlen($magnitude) > 19 || (strlen($magnitude) === 19 && strcmp($magnitude, $limit) > 0)) throw new \\ValueError('Integer is outside the Int64 range');");
	} else if(name === "float32" || name === "float64") lines.push("if (!is_float($value)) throw new \\TypeError('Expected a float without numeric coercion');");
	else if(name === "char") lines.push("if (!is_string($value)) throw new \\TypeError('Char requires a string');", "if (strlen($value) < 1 || strlen($value) > 4 || preg_match('/\\\\A.\\\\z/us', $value) !== 1) throw new \\ValueError('Char requires one Unicode scalar');");
	else if(name === "string") lines.push("if (!is_string($value)) throw new \\TypeError('Expected a UTF-8 string');", "$budget->charge(strlen($value));", "if (preg_match('//u', $value) !== 1) throw new \\ValueError('String requires valid UTF-8');");
	else if(name === "bytes") lines.push(`if (!$value instanceof ${publicType}) throw new \\TypeError('Expected Bytes');`, "$budget->charge(strlen($value->toString()));");
	else if(copy.compound === "option" || copy.compound === "result")
	{
		if(copy.compound === "option") lines.push("if ($value === null) return null;");
		const branches = copy.compound === "option" ? ["Some"] : ["Ok", "Err"];
		branches.forEach((branch, i) => lines.push(`if ($value instanceof \\${model.namespace}\\${branch}) {`
			, `    if (array_keys(get_object_vars($value)) !== ['value']) throw new \\TypeError('${branch} requires one initialized value field');`
			, `    return new \\${model.namespace}\\${branch}(self::check${copy.fields[i].type.index}($value->value, $budget));`, "}"));
		lines.push(`throw new \\TypeError('Expected ${branches.join(" or ")}');`);
	} else if(copy.compound === "tuple")
	{
		lines.push("if (!is_array($value) || !array_is_list($value) || count($value) !== 2) throw new \\TypeError('Prod requires a two-element list');"
			, "$budget->charge(2, 32);"
			, `return [${copy.fields.map((field, i) => `self::check${field.type.index}($value[${i}], $budget)`).join(", ")}];`);
	}
	else if(copy.record) lines.push(`if (!$value instanceof ${publicType}) throw new \\TypeError('Expected ${copy.publicType}');`, ...copy.fields.map(field => `self::check${field.type.index}($value->${field.name}, $budget);`));
	else lines.push("if (!is_array($value) || !array_is_list($value)) throw new \\TypeError('Expected a list with consecutive integer keys');", "$budget->charge(count($value), 32);", "$result = [];", `foreach ($value as $item) $result[] = self::check${copy.element.index}($item, $budget);`, "return $result;");
	if(!copy.element && !copy.compound) lines.push("return $value;");
	return `    public static function check${copy.index}(mixed $value, Budget $budget): mixed {\n        $budget->charge(1, 16);\n${lines.map(line => `        ${line}`).join("\n")}\n    }`;
}).join("\n");

/**
 * Copy inputs into retained scratch and outputs into independent PHP values.
 *
 * @param model - Admitted C and PHP types.
 */
export const copiedPhpConversions = model => model.surface.copies.map(copy => {
	const input = [], output = [], name = copy.scalarName, ns = `\\${model.namespace}\\`;
	input.push(`$out = $scope->allocate('${copy.ctype}');`);
	if(name === "unit")
	{ input.push("$out->cdata = 0;"); output.push("return null;"); }
	else if(name === "char")
	{ input.push("$out->cdata = ScalarCodec::point($value);"); output.push("return ScalarCodec::text($value);"); }
	else if(name === "uint64")
	{
		input.push("$words = IntegerCodec::limbs((string) $value);", "\\FFI::memcpy(\\FFI::addr($out), pack('V2', $words[0] ?? 0, $words[1] ?? 0), 8);");
		output.push("return \\Brick\\Math\\BigInteger::of(IntegerCodec::decimal(array_values(unpack('V2', pack('q', $value))), false));");
	} else if(["string", "bytes", "nat", "int"].includes(name))
	{
		if(name === "nat" || name === "int")
		{
			input.push("$decimal = (string) $value;", "$words = IntegerCodec::limbs($decimal);", "$scope->budget->charge(count($words), 32);", "$bytes = $words ? pack('V*', ...$words) : '';", "$out->length = count($words);");
			if(name === "int") input.push("$out->negative = $decimal[0] === '-';");
			output.push("if ($value->length > 1701) throw new \\ValueError('BigInteger decimal conversion limit exceeded');", "$bytes = $scope->read($value->data, $value->length * 4, 8);", `return \\Brick\\Math\\BigInteger::of(IntegerCodec::decimal($bytes === '' ? [] : array_values(unpack('V*', $bytes)), ${name === "int" ? "$value->negative" : "false"}));`);
		} else
		{
			input.push(`$bytes = ${name === "bytes" ? "$value->toString()" : "$value"};`, "$out->length = strlen($bytes);");
			output.push("$bytes = $scope->read($value->data, $value->length);");
			if(name === "string") output.push("if (preg_match('//u', $bytes) !== 1) throw new \\RuntimeException('Native string is not valid UTF-8');", "return $bytes;");
			else output.push(`return ${ns}Bytes::fromString($bytes);`);
		}
		input.push("$out->data = $scope->buffer($bytes);");
	} else if(copy.compound)
	{
		const to = (field, value) => [`$item = self::to${field.type.index}(${value}, $scope);`, `$out->${field.name} = $item${field.type.aggregate ? "" : "->cdata"};`];
		const from = field => `self::from${field.type.index}($value->${field.name}, $scope)`;
		if(copy.compound === "option")
		{
			input.push("if ($value !== null) {", "    $out->has_value = 1;", ...to(copy.fields[0], "$value->value").map(line => `    ${line}`), "}");
			output.push("if ($value->has_value !== 0 && $value->has_value !== 1) throw new \\RuntimeException('Invalid native Option flag');"
				, `return $value->has_value === 0 ? null : new ${ns}Some(${from(copy.fields[0])});`);
		} else if(copy.compound === "result")
		{
			input.push(`if ($value instanceof ${ns}Ok) {`, "    $out->is_ok = 1;", ...to(copy.fields[0], "$value->value").map(line => `    ${line}`)
				, "} else {", ...to(copy.fields[1], "$value->value").map(line => `    ${line}`), "}");
			output.push("if ($value->is_ok !== 0 && $value->is_ok !== 1) throw new \\RuntimeException('Invalid native Except flag');"
				, `return $value->is_ok === 1 ? new ${ns}Ok(${from(copy.fields[0])}) : new ${ns}Err(${from(copy.fields[1])});`);
		} else
		{
			input.push("$scope->budget->charge(2, 32);", ...copy.fields.flatMap((field, i) => to(field, `$value[${i}]`)));
			output.push("$scope->budget->charge(2, 32);", `return [${copy.fields.map(from).join(", ")}];`);
		}
	} else if(copy.record)
	{
		for(const field of copy.fields) input.push(`$field${field.type.index}_${field.name} = self::to${field.type.index}($value->${field.name}, $scope);`, `$out->${field.name} = $field${field.type.index}_${field.name}${field.type.aggregate ? "" : "->cdata"};`);
		output.push(`return new ${ns}${copy.publicName}(${copy.fields.map(field => `self::from${field.type.index}($value->${field.name}, $scope)`).join(", ")});`);
	} else if(copy.element)
	{
		input.push("$scope->budget->charge(count($value), 32);", `$memory = $scope->allocate('${copy.element.ctype}', count($value), true);`, `foreach ($value as $i => $item) { $entry = self::to${copy.element.index}($item, $scope); $memory[$i] = $entry${copy.element.aggregate ? "" : "->cdata"}; }`, "$out->data = count($value) ? \\FFI::addr($memory[0]) : null;", "$out->length = count($value);");
		output.push(`$scope->budget->charge($value->length, max(32, \\FFI::sizeof($scope->ffi->type('${copy.element.ctype}'))));`, "if (!$value->length) return [];", "if ($value->data === null || \\FFI::isNull($value->data)) throw new \\RuntimeException('Native array has a missing buffer');", `$memory = $scope->ffi->cast('${copy.element.ctype} *', $value->data);`, "$items = [];", `for ($i = 0; $i < $value->length; $i++) $items[] = self::from${copy.element.index}($memory[$i], $scope);`, "return $items;");
	} else
	{ input.push("$out->cdata = $value;"); output.push("return $value;"); }
	input.push("return $out;");
	return `    private static function to${copy.index}(mixed $value, Scope $scope): \\FFI\\CData {\n${input.map(line => `        ${line}`).join("\n")}\n    }\n    private static function from${copy.index}(mixed $value, Scope $scope): mixed {\n        $scope->budget->charge(1, 16);\n${output.map(line => `        ${line}`).join("\n")}\n    }`;
}).join("\n");
