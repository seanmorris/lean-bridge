/**
 * Nested C++ values and scoped borrowed views of copied C arguments.
 *
 * @file
 */

/**
 * Name an admitted C++ value without leaking C storage details.
 *
 * @param copy - Admitted copied type.
 */
export const copiedCppType = copy => {
	if(copy.element) return `std::vector<${copiedCppType(copy.element)}>`;
	if(copy.record) return copy.record.name;
	const name = copy.scalarName;
	return ({ char: "char32_t", unit: "std::monostate", string: "std::string", bytes: "std::vector<uint8_t>", nat: "Nat", int: "Int", bool: "bool", float32: "float", float64: "double" }[name] ?? `${name}_t`);
};

/**
 * Generate dependency-ordered records and per-type C views/converters.
 *
 * @param surface - Admitted C surface with copied type dependencies.
 */
export const renderCppCopiedValues = surface => {
	const p = surface.prefix;
	const records = surface.copies.filter(copy => copy.record).map(copy => `struct ${copy.record.name} {\n${copy.fields.map(field => `  ${copiedCppType(field.type)} ${field.name}{};`).join("\n")}\n};`).join("\n");
	const conversions = surface.copies.map(copy => {
		const { index, name, element, fields, record, ref } = copy, host = copiedCppType(copy);
		const view = [], constructor = [], initializers = [], check = [], output = [];
		if(element)
		{
			view.push(`std::vector<View${element.index}> items;`, `std::unique_ptr<${element.name}[]> values;`);
			constructor.push(`items.reserve(source.size()); values = std::make_unique<${element.name}[]>(source.size());`
				, "for (const auto& item : source) items.emplace_back(item);"
				, "for (size_t i = 0; i < source.size(); ++i) values[i] = items[i].value;"
				, `value = ${name}{values.get(), source.size(), nullptr, nullptr};`);
			check.push(`charge(budget, source.size(), sizeof(${element.name}) > sizeof(void*) ? sizeof(${element.name}) : sizeof(void*));`
				, `for (const auto& item : source) check${element.index}(item, budget);`);
			output.push(`${host} result; result.reserve(source.length);`
				, `for (size_t i = 0; i < source.length; ++i) result.push_back(from${element.index}(source.data[i]));`, "return result;");
		} else if(record)
		{
			fields.forEach((field, i) => {
				view.push(`View${field.type.index} field${i};`);
				initializers.push(`field${i}(source.${field.name})`);
				check.push(`check${field.type.index}(source.${field.name}, budget);`);
			});
			constructor.push(`value = ${name}{${fields.map((_, i) => `field${i}.value`).join(", ")}};`);
			check.unshift(`charge(budget, 1, sizeof(${name}));`);
			output.push(`return ${host}{${fields.map(field => `from${field.type.index}(source.${field.name})`).join(", ")}};`);
		} else if(["string", "bytes", "nat", "int"].includes(ref.name))
		{
			const limbs = ["nat", "int"].includes(ref.name), data = limbs ? "source.limbs" : "source";
			constructor.push(`value = ${name}{${data}.data(), ${data}.size(), nullptr, nullptr${ref.name === "int" ? ", source.negative" : ""}};`);
			check.push(`charge(budget, ${data}.size(), ${limbs ? "sizeof(uint32_t)" : "1"});`);
			if(ref.name === "string") output.push('return source.length ? std::string(source.data, source.length) : std::string{};');
			else if(ref.name === "bytes") output.push("return source.length ? std::vector<uint8_t>(source.data, source.data + source.length) : std::vector<uint8_t>{};");
			else output.push(`return ${host}{${ref.name === "int" ? "source.negative, " : ""}source.length ? std::vector<uint32_t>(source.data, source.data + source.length) : std::vector<uint32_t>{}};`);
		} else
		{
			constructor.push(`value = ${ref.name === "unit" ? "0" : "source"};`);
			output.push(`return ${ref.name === "unit" ? "{}" : "source"};`);
		}
		return [`inline void check${index}(const ${host}& source, size_t& budget) {`
			, "  (void)source; (void)budget;", ...check.map(line => `  ${line}`), "}"
			, `struct View${index} {`, ...view.map(line => `  ${line}`)
			, `  ${name} value{};`
			, `  explicit View${index}(const ${host}& source)${initializers.length ? ` : ${initializers.join(", ")}` : ""} {`
			, "    (void)source;", ...constructor.map(line => `    ${line}`), "  }", "};"
			, `inline ${host} from${index}(const ${name}& source) {`
			, "  (void)source;", ...output.map(line => `  ${line}`), "}"].join("\n");
	});
	return { records
		, helpers: `inline void charge(size_t& budget, size_t count, size_t width) {
  if (count > budget / width) {
    const ${p}_error error{${p.toUpperCase()}_ERROR_INVALID_ARGUMENT, "16 MiB call limit exceeded", 26};
    throw Error(${p.toUpperCase()}_STATUS_INVALID_ARGUMENT, error);
  }
  budget -= count * width;
}
${conversions.join("\n\n")}` };
};
