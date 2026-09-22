/**
 * Bounded C++ views and owned output conversion for the native copied graph ABI.
 * Runtime initialization, retirement and package admission remain caller policy.
 *
 * @file
 */
import { componentRecursiveLimits } from "../../abi/component-recursive.mjs";
import { generateCopiedCppGraphValues } from "./copied-graph-values.mjs";

const support = `static_assert(sizeof(size_t) == 8 && sizeof(void*) == 8 && sizeof(bool) == 1 && CHAR_BIT == 8, "Native graph conversion requires the verified 64-bit byte ABI");
class GraphConversionError : public std::runtime_error {
public:
  uint32_t status;
  GraphConversionError(uint32_t code, const char* message) : std::runtime_error(message), status(code) {}
};
[[noreturn]] inline void graph_fail(uint32_t status, const char* text) { throw GraphConversionError(status, text); }
struct GraphBudget {
  size_t nodes = ${componentRecursiveLimits.valueNodes};
  size_t native_bytes = 16u * 1024u * 1024u;
  size_t storage_bytes = 16u * 1024u * 1024u;
  static void charge(size_t& budget, size_t count, size_t width) {
    if (count > budget / width) graph_fail(2, "Copied graph byte limit exceeded");
    budget -= count * width;
  }
  void enter(size_t depth) {
    if (depth > ${componentRecursiveLimits.valueDepth} || !nodes) graph_fail(2, "Copied graph depth or node limit exceeded");
    --nodes;
  }
  void native(size_t count, size_t width) { charge(native_bytes, count, width); }
  void storage(size_t count, size_t width) { charge(storage_bytes, count, width); }
};
template<class T> inline const T& graph_read(const T* pointer) {
  const uintptr_t address = reinterpret_cast<uintptr_t>(pointer);
  if (!pointer || address % alignof(T) || sizeof(T) > UINTPTR_MAX - address) graph_fail(4, "Invalid native graph pointer");
  return *pointer;
}
template<class T> inline void graph_span(const T* pointer, size_t count) {
  if (count) {
    if (count > (UINTPTR_MAX - reinterpret_cast<uintptr_t>(pointer)) / sizeof(T)) graph_fail(4, "Invalid native graph span");
    (void)graph_read(pointer);
  }
}
inline void graph_utf8(const char* data, size_t length, uint32_t status) {
  size_t i = 0;
  while (i < length) {
    uint32_t point = static_cast<uint8_t>(data[i++]), minimum; size_t extra;
    if (point < 0x80) continue;
    if (point >= 0xc2 && point <= 0xdf) { point &= 0x1f; extra = 1; minimum = 0x80; }
    else if (point >= 0xe0 && point <= 0xef) { point &= 0x0f; extra = 2; minimum = 0x800; }
    else if (point >= 0xf0 && point <= 0xf4) { point &= 7; extra = 3; minimum = 0x10000; }
    else graph_fail(status, "Invalid UTF-8 text");
    if (extra > length - i) graph_fail(status, "Incomplete UTF-8 text");
    while (extra--) {
      uint8_t next = static_cast<uint8_t>(data[i++]);
      if ((next & 0xc0) != 0x80) graph_fail(status, "Invalid UTF-8 continuation");
      point = (point << 6) | (next & 0x3f);
    }
    if (point < minimum || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) graph_fail(status, "Invalid UTF-8 scalar");
  }
}
template<class Integer> inline size_t graph_limb_count(const Integer& source) {
  auto high = source.backend().limbs()[source.backend().size() - 1]; size_t high_bits = 0;
  while (high) { ++high_bits; high >>= 1; }
  const size_t bits = (source.backend().size() - 1) * sizeof(*source.backend().limbs()) * CHAR_BIT + high_bits;
  return (bits + 31) / 32;
}
template<class T, void (*Clear)(T*)> struct GraphOwned {
  T* value;
  explicit GraphOwned(T* input) : value(input) {}
  GraphOwned(const GraphOwned&) = delete;
  GraphOwned& operator=(const GraphOwned&) = delete;
  ~GraphOwned() { Clear(value); }
};`;

/**
 * Generate private conversion calls around an authenticated native C function.
 * The caller supplies that function after establishing runtime readiness, and
 * owns the policy for unexpected results. No public package is enabled here.
 *
 * @param ir - Compiler-checked copied Binding IR.
 */
export const generateCopiedCppGraphConversions = ir => {
	const values = generateCopiedCppGraphValues(ir), { layout } = values;
	const hosts = new Map(values.types.map(type => [type.id, type]));
	const nodes = new Map(layout.nodes.map((node, index) => [node.id, { ...node, index, host: hosts.get(node.id) }]));
	// A finite copied value needs a terminating constructor. Keep uninhabited
	// declarations, but reject their values without generating endless walkers.
	const finite = new Set();
	let changed = true;
	while(changed)
	{
		changed = false;
		for(const node of nodes.values())
		{
			if(finite.has(node.id)) continue;
			const all = fields => fields.every(field => finite.has(field.type));
			const inhabitable = node.kind === "primitive" || node.element || node.kind === "option"
				|| (node.kind === "variant" ? node.cases.some(branch => all(branch.fields))
					: node.kind === "result" ? node.fields.some(field => finite.has(field.type)) : all(node.fields));
			if(inhabitable)
			{ finite.add(node.id); changed = true; }
		}
	}
	const declarations = [], structs = [], implementations = [], calls = [];
	const input = (field, slot) => field.boxed ? `*(${slot})` : slot;
	const output = (field, slot) => field.storage === "pointer" ? `graph_read(${slot})` : slot;
	const ctor = (node, statements) => `inline GraphView${node.index}::GraphView${node.index}(const ${node.host.name}& source) {\n  (void)source;\n${statements.map(line => `  ${line}`).join("\n")}\n}`;
	for(const node of nodes.values())
	{
		const i = node.index, host = node.host.name;
		declarations.push(`struct GraphView${i};`
			, `inline void graph_check${i}(const ${host}&, size_t, bool, GraphBudget&);`
			, `inline ${host} graph_from${i}(const ${node.name}&, size_t, bool, bool, GraphBudget&);`);
	}
	for(const node of nodes.values())
	{
		const i = node.index, host = node.host.name, raw = node.name;
		const members = [], make = [], check = ["(void)source; budget.enter(depth);"
			, `if (storage) budget.native(1, sizeof(${raw}));`
			, `budget.storage(1, sizeof(GraphView${i}));`];
		const from = ["(void)source; budget.enter(depth);"
			, `if (native_storage) budget.native(1, sizeof(${raw}));`
			, `if (host_storage) budget.storage(1, sizeof(${host}));`];
		const checkField = (field, expression) => [
			...field.boxed ? [`if (!(${expression})) graph_fail(1, "Empty recursive value box");`] : []
			, `graph_check${nodes.get(field.type).index}(${input(field, expression)}, depth + 1, ${field.storage === "pointer"}, budget);`
		];
		const makeField = (field, expression, slot, suffix) => {
			const child = nodes.get(field.type), member = `field${suffix}`;
			members.push(`std::unique_ptr<GraphView${child.index}> ${member};`);
			return [`${member} = std::make_unique<GraphView${child.index}>(${input(field, expression)});`
				, `${slot} = ${field.storage === "pointer" ? "&" : ""}${member}->value;`];
		};
		const fromField = (field, slot) => `graph_from${nodes.get(field.type).index}(${output(field, slot)}, depth + 1, ${field.storage === "pointer"}, ${field.boxed}, budget)`;
		if(!finite.has(node.id))
		{
			check.push('graph_fail(1, "Type has no finite copied value");');
			make.push('graph_fail(1, "Type has no finite copied value");');
			from.push('graph_fail(4, "Native type has no finite copied value");');
		}
		else if(node.kind === "primitive")
		{
			const scalar = node.ref.name;
			if(scalar === "unit")
			{ make.push("value = 0;"); from.push('if (source) graph_fail(4, "Invalid native Unit");', "return {};"); }
			else if(["string", "bytes"].includes(scalar))
			{
				check.push("budget.native(source.size(), 1);");
				if(scalar === "string") check.push("graph_utf8(source.data(), source.size(), 1);");
				make.push("value.data = source.data(); value.length = source.size();");
				from.push("budget.native(source.length, 1); graph_span(source.data, source.length);"
					, ...scalar === "string" ? ["graph_utf8(source.data, source.length, 4);"] : []
					, `budget.storage(source.length${scalar === "string" ? " + 1" : ""}, 1);`
					, `return source.length ? ${host}(${scalar === "string" ? "source.data, source.length" : "source.data, source.data + source.length"}) : ${host}{};`);
			}
			else if(["nat", "int"].includes(scalar))
			{
				if(scalar === "nat") check.push('if (source < 0) graph_fail(1, "Nat must be nonnegative");');
				check.push("if (source.backend().size() > budget.native_bytes / sizeof(boost::multiprecision::limb_type) + 1) graph_fail(2, \"Copied integer limit exceeded\");"
					, "const size_t limbs = graph_limb_count(source);"
					, "budget.native(limbs, sizeof(uint32_t)); budget.storage(limbs, sizeof(uint32_t));");
				members.push("std::vector<uint32_t> limbs;");
				make.push("limbs.reserve(graph_limb_count(source));"
					, "if (source != 0) boost::multiprecision::export_bits(source, std::back_inserter(limbs), 32, false);"
					, "value.data = limbs.data(); value.length = limbs.size();", ...scalar === "int" ? ["value.negative = source < 0;"] : []);
				from.push("budget.native(source.length, sizeof(uint32_t)); budget.storage(source.length, sizeof(uint32_t));"
					, "graph_span(source.data, source.length);", `${host} result = 0;`
					, ...scalar === "int" ? ["uint8_t negative; std::memcpy(&negative, &source.negative, 1);", 'if (negative > 1) graph_fail(4, "Invalid native integer sign");'] : []
					, "if (source.length) boost::multiprecision::import_bits(result, source.data, source.data + source.length, 32, false);"
					, scalar === "int" ? "return negative ? -result : result;" : "return result;");
			}
			else
			{
				if(scalar === "char") check.push('if (source > 0x10ffff || (source >= 0xd800 && source <= 0xdfff)) graph_fail(1, "Invalid Unicode scalar");');
				make.push(`value = static_cast<${raw}>(source);`);
				if(scalar === "bool") from.push("uint8_t bits; std::memcpy(&bits, &source, 1);", 'if (bits > 1) graph_fail(4, "Invalid native Bool");', "return bits != 0;");
				else
				{
					if(scalar === "char") from.push('if (source > 0x10ffff || (source >= 0xd800 && source <= 0xdfff)) graph_fail(4, "Invalid native Unicode scalar");');
					from.push(`return static_cast<${host}>(source);`);
				}
			}
		}
		else if(node.element)
		{
			const child = nodes.get(node.element);
			check.push('if (source.size() > budget.nodes) graph_fail(2, "Copied sequence node limit exceeded");'
				, `budget.native(source.size(), sizeof(${child.name})); budget.storage(source.size(), sizeof(${child.name}));`
				, `for (const auto& child : source) graph_check${child.index}(child, depth + 1, false, budget);`);
			members.push(`std::vector<GraphView${child.index}> items;`, `std::unique_ptr<${child.name}[]> data;`);
			make.push("items.reserve(source.size());", `data = source.empty() ? nullptr : std::make_unique<${child.name}[]>(source.size());`
				, "for (const auto& child : source) items.emplace_back(child);", "for (size_t j = 0; j < source.size(); ++j) data[j] = items[j].value;"
				, "value.data = data.get(); value.length = source.size();");
			from.push('if (source.length > budget.nodes) graph_fail(2, "Copied sequence node limit exceeded");'
				, `budget.native(source.length, sizeof(${child.name})); budget.storage(source.length, sizeof(${child.host.name}));`
				, "graph_span(source.data, source.length);", `${host} result; result.reserve(source.length);`
				, `for (size_t j = 0; j < source.length; ++j) result.push_back(graph_from${child.index}(source.data[j], depth + 1, false, false, budget));`, "return result;");
		}
		else if(node.kind === "variant")
		{
			check.push('if (source.value.valueless_by_exception()) graph_fail(1, "Variant has no active constructor");', "switch (source.value.index()) {");
			make.push("value.kind = static_cast<uint32_t>(source.value.index());", "switch (source.value.index()) {");
			from.push("switch (source.kind) {");
			node.host.cases.forEach((branch, index) => {
				const slots = branch.fields.map(field => `std::get<${branch.name}>(source.value).${field.name}`);
				check.push(`case ${index}:`, ...branch.fields.flatMap((field, j) => checkField(field, slots[j])), "break;");
				make.push(`case ${index}:`, ...branch.fields.flatMap((field, j) => makeField(field, slots[j], `value.cases.${node.cases[index].name}.${field.name}`, `${index}_${j}`)), "break;");
				from.push(`case ${index}: return ${branch.name}{${branch.fields.map(field => fromField(field, `source.cases.${node.cases[index].name}.${field.name}`)).join(", ")}};`);
			});
			check.push('default: graph_fail(1, "Invalid variant constructor");', "}");
			make.push('default: graph_fail(1, "Invalid variant constructor");', "}");
			from.push('default: graph_fail(4, "Invalid native variant constructor");', "}");
		}
		else if(["option", "result"].includes(node.kind))
		{
			const option = node.kind === "option", flag = option ? "has_value" : "is_ok";
			if(!option) check.push('if (source.valueless_by_exception()) graph_fail(1, "Result has no active branch");');
			make.push(`value.${flag} = ${option ? "source.has_value()" : "source.index() == 0"};`);
			from.push(`if (source.${flag} > 1) graph_fail(4, "Invalid native optional/result tag");`);
			node.host.fields.forEach((field, index) => {
				const condition = option ? "source.has_value()" : `source.index() == ${index}`;
				const slot = option ? "*source" : `std::get<${index}>(source).value`;
				check.push(`if (${condition}) {`, ...checkField(field, slot), "}");
				make.push(`if (${condition}) {`, ...makeField(field, slot, `value.${field.name}`, index), "}");
				const result = fromField(field, `source.${field.name}`), child = nodes.get(field.type), type = field.boxed ? `Box<${child.host.name}>` : child.host.name;
				from.push(`if (${index ? "!" : ""}source.${flag}) return ${option ? `${host}{std::in_place, ${result}}` : `${host}{${index ? "Err" : "Ok"}<${type}>{${result}}}`};`);
			});
			from.push(option ? "return std::nullopt;" : 'graph_fail(4, "Invalid native result branch");');
		}
		else
		{
			node.host.fields.forEach((field, index) => {
				const slot = `source.${node.kind === "tuple" ? ["first", "second"][index] : field.name}`;
				check.push(...checkField(field, slot)); make.push(...makeField(field, slot, `value.${field.name}`, index));
			});
			from.push(`return ${host}{${node.host.fields.map(field => fromField(field, `source.${field.name}`)).join(", ")}};`);
		}
		structs.push(`struct GraphView${i} {`, ...members.map(line => `  ${line}`), `  ${raw} value{};`
			, `  explicit GraphView${i}(const ${host}&);`, `  ~GraphView${i}();`
			, `  GraphView${i}(GraphView${i}&&) noexcept;`, `  GraphView${i}(const GraphView${i}&) = delete;`, "};");
		implementations.push(`inline GraphView${i}::~GraphView${i}() = default;`, `inline GraphView${i}::GraphView${i}(GraphView${i}&&) noexcept = default;`
			, `inline void graph_check${i}(const ${host}& source, size_t depth, bool storage, GraphBudget& budget) {\n${check.map(line => `  ${line}`).join("\n")}\n}`
			, ctor(node, make)
			, `inline ${host} graph_from${i}(const ${raw}& source, size_t depth, bool native_storage, bool host_storage, GraphBudget& budget) {\n${from.map(line => `  ${line}`).join("\n")}\n}`);
	}
	for(const root of layout.roots)
	{
		const result = nodes.get(root.result), params = root.parameters.map(id => nodes.get(id)), name = root.name.slice(layout.prefix.length + 1);
		calls.push(`template<class Invoke> inline ${result.host.name} graph_call_${name}(Invoke&& invoke${params.map((node, index) => `, const ${node.host.name}& arg${index}`).join("")}) {`
			, "  GraphBudget budget;"
			, ...params.map((node, index) => `  graph_check${node.index}(arg${index}, 0, true, budget);`)
			, ...params.map((node, index) => `  GraphView${node.index} view${index}(arg${index});`)
			, `  ${result.name} result{};`
			, ...result.aggregate ? [`  GraphOwned<${result.name}, ${result.name}_clear> owner(&result);`] : []
			, `  const uint32_t status = std::forward<Invoke>(invoke)(${[...params.map((_, index) => `&view${index}.value`), "&result"].join(", ")});`
			, '  if (status) graph_fail(status, "Native copied graph call failed");'
			, `  return graph_from${result.index}(result, 0, true, true, budget);`, "}");
	}
	const header = ["#pragma once", `#include "${layout.prefix}-values.hpp"`
		, `#include "${layout.prefix}-graph-types.h"`
		, "#include <climits>", "#include <cstring>", "#include <iterator>"
		, `namespace lean_bridge::${layout.prefix}::detail {`
		, support, ...declarations, ...structs, ...implementations, ...calls
		, "}", ""].join("\n");
	return { ...values, header, valuesHeader: values.header };
};
