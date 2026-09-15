/**
 * Generate strict PHP checks and scoped FFI conversions for the public C ABI.
 *
 * @file
 */

/**
 * Declare C layouts and calls without preprocessing or Lean layout assumptions.
 *
 * @param model - Admitted copied PHP projection.
 */
export const copiedPhpDefinitions = model => {
	const { surface } = model;
	return ["typedef struct { int code; void *message; size_t message_length; } BridgeError;"
		, ...surface.copies.filter(copy => copy.aggregate).map(copy => `typedef struct { ${copy.record ? copy.fields.length ? copy.fields.map(field => `${field.type.ctype} ${field.name};`).join(" ") : "uint8_t empty;" : `void *data; size_t length; void *owner; void (*release)(void *);${copy.ref.name === "int" ? " bool negative;" : ""}`} } ${copy.ctype};\nvoid ${copy.name}_clear(${copy.ctype} *);`)
		, ...surface.functions.map(fn => `int ${fn.name}(${fn.declaration.parameters.map(site => { const copy = surface.copy(site.type); return copy.ctype + (copy.aggregate ? " *" : ""); }).concat(fn.resultType === "void" ? [] : [`${surface.copy(fn.declaration.result.type).ctype} *`]).concat("BridgeError *").join(", ")});`)
	].join("\n");
};

/**
 * Validate exact PHP values even when an application has strict_types disabled.
 *
 * @param model - Admitted public type names and copied shapes.
 */
export const copiedPhpChecks = model => model.surface.copies.map(copy => {
	const lines = [], name = copy.ref.name, publicType = `\\${model.namespace}\\${copy.publicType}`;
	if(name === "unit") lines.push("if ($value !== null) throw new \\TypeError('Unit requires null');");
	else if(name === "bool") lines.push("if (!is_bool($value)) throw new \\TypeError('Bool requires bool');");
	else if(/^(?:u?int)(?:8|16|32|64)$/.test(name) && name !== "uint64")
	{
		const bits = Number(name.match(/\d+/)[0]), signed = name.startsWith("int");
		lines.push("if (!is_int($value)) throw new \\TypeError('Expected an int without numeric coercion');");
		if(bits !== 64) lines.push(`if ($value < ${signed ? -(2 ** (bits-1)) : 0} || $value > ${2 ** (signed ? bits-1 : bits) - 1}) throw new \\ValueError('Integer is outside the declared Lean range');`);
	} else if(name === "uint64" || name === "nat" || name === "int")
	{
		lines.push(`if (!$value instanceof ${publicType}) throw new \\TypeError('Expected BigInteger');`, "$decimal = (string) $value;", `${publicType}::fromDecimal($decimal);`, "$budget->charge(strlen($decimal));");
		if(name !== "int") lines.push("if ($decimal[0] === '-') throw new \\ValueError('Expected an unsigned integer');");
		if(name === "uint64") lines.push("if (strlen($decimal) > 20 || (strlen($decimal) === 20 && strcmp($decimal, '18446744073709551615') > 0)) throw new \\ValueError('Integer is outside the UInt64 range');");
	} else if(name === "float32" || name === "float64") lines.push("if (!is_float($value)) throw new \\TypeError('Expected a float without numeric coercion');");
	else if(name === "string") lines.push("if (!is_string($value)) throw new \\TypeError('Expected a UTF-8 string');", "$budget->charge(strlen($value));", "if (preg_match('//u', $value) !== 1) throw new \\ValueError('String requires valid UTF-8');");
	else if(name === "bytes") lines.push(`if (!$value instanceof ${publicType}) throw new \\TypeError('Expected Bytes');`, "$budget->charge(strlen($value->toString()));");
	else if(copy.record) lines.push(`if (!$value instanceof ${publicType}) throw new \\TypeError('Expected ${copy.publicType}');`, ...copy.fields.map(field => `self::check${field.type.index}($value->${field.name}, $budget);`));
	else lines.push("if (!is_array($value) || !array_is_list($value)) throw new \\TypeError('Expected a list with consecutive integer keys');", "$budget->charge(count($value), 32);", "$result = [];", `foreach ($value as $item) $result[] = self::check${copy.element.index}($item, $budget);`, "return $result;");
	if(!copy.element) lines.push("return $value;");
	return `    public static function check${copy.index}(mixed $value, Budget $budget): mixed {\n        $budget->charge(1, 16);\n${lines.map(line => `        ${line}`).join("\n")}\n    }`;
}).join("\n");

/**
 * Copy inputs into retained scratch and outputs into independent PHP values.
 *
 * @param model - Admitted C and PHP types.
 */
export const copiedPhpConversions = model => model.surface.copies.map(copy => {
	const input = [], output = [], name = copy.ref.name, ns = `\\${model.namespace}\\`;
	input.push(`$out = $scope->allocate('${copy.ctype}');`);
	if(name === "unit")
	{ input.push("$out->cdata = 0;"); output.push("return null;"); }
	else if(name === "uint64")
	{
		input.push("$words = IntegerCodec::limbs((string) $value);", "\\FFI::memcpy(\\FFI::addr($out), pack('V2', $words[0] ?? 0, $words[1] ?? 0), 8);");
		output.push(`return ${ns}BigInteger::fromDecimal(IntegerCodec::decimal(array_values(unpack('V2', pack('q', $value))), false));`);
	} else if(["string", "bytes", "nat", "int"].includes(name))
	{
		if(name === "nat" || name === "int")
		{
			input.push("$decimal = (string) $value;", "$words = IntegerCodec::limbs($decimal);", "$scope->budget->charge(count($words), 32);", "$bytes = $words ? pack('V*', ...$words) : '';", "$out->length = count($words);");
			if(name === "int") input.push("$out->negative = $decimal[0] === '-';");
			output.push("if ($value->length > 1701) throw new \\ValueError('BigInteger decimal conversion limit exceeded');", "$bytes = $scope->read($value->data, $value->length * 4, 8);", `return ${ns}BigInteger::fromDecimal(IntegerCodec::decimal($bytes === '' ? [] : array_values(unpack('V*', $bytes)), ${name === "int" ? "$value->negative" : "false"}));`);
		} else
		{
			input.push(`$bytes = ${name === "bytes" ? "$value->toString()" : "$value"};`, "$out->length = strlen($bytes);");
			output.push("$bytes = $scope->read($value->data, $value->length);");
			if(name === "string") output.push("if (preg_match('//u', $bytes) !== 1) throw new \\RuntimeException('Native string is not valid UTF-8');", "return $bytes;");
			else output.push(`return ${ns}Bytes::fromString($bytes);`);
		}
		input.push("$out->data = $scope->buffer($bytes);");
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
