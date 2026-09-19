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
		} else if(["nat", "int"].includes(ref.name))
		{
			view.push("std::vector<uint32_t> limbs;");
			constructor.push("if (source != 0) boost::multiprecision::export_bits(source, std::back_inserter(limbs), 32, false);"
				, `value = ${name}{limbs.data(), limbs.size(), nullptr, nullptr${ref.name === "int" ? ", source < 0" : ""}};`);
			if(ref.name === "nat") check.push('if (source < 0) invalid("Nat must be nonnegative");');
			check.push("charge(budget, source == 0 ? 0 : (boost::multiprecision::msb(source < 0 ? -source : source) / 32 + 1), sizeof(uint32_t));");
			output.push(`${host} result = 0;`
				, "if (source.length) boost::multiprecision::import_bits(result, source.data, source.data + source.length, 32, false);"
				, ref.name === "int" ? "return source.negative ? -result : result;" : "return result;");
		} else if(["string", "bytes"].includes(ref.name))
		{
			constructor.push(`value = ${name}{source.data(), source.size(), nullptr, nullptr};`);
			check.push("charge(budget, source.size(), 1);");
			if(ref.name === "string") output.push('return source.length ? std::string(source.data, source.length) : std::string{};');
			else output.push("return source.length ? std::vector<uint8_t>(source.data, source.data + source.length) : std::vector<uint8_t>{};");
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
		, helpers: `[[noreturn]] inline void invalid(const char* message) {
  const ${p}_error error{${p.toUpperCase()}_ERROR_INVALID_ARGUMENT, message, std::char_traits<char>::length(message)};
  throw Error(${p.toUpperCase()}_STATUS_INVALID_ARGUMENT, error);
}
inline void charge(size_t& budget, size_t count, size_t width) {
  if (count > budget / width) {
    const ${p}_error error{${p.toUpperCase()}_ERROR_INVALID_ARGUMENT, "16 MiB call limit exceeded", 26};
    throw Error(${p.toUpperCase()}_STATUS_INVALID_ARGUMENT, error);
  }
  budget -= count * width;
}
${conversions.join("\n\n")}` };
};
