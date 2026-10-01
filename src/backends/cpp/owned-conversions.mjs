/**
 * Bounded C++ conversions over the ownership-aware public C value API.
 * Native result guards outlive every partial C++ conversion; only explicit
 * owning results or callback-scoped borrows can produce resource wrappers.
 *
 * @file
 */
import { generateOwnedCppValues } from "./owned-values.mjs";

const support = (p, limits, bigint, anchors) => {
	const m = p.toUpperCase();
	return `static_assert(sizeof(void*) == 8 && sizeof(size_t) == 8 && CHAR_BIT == 8 && sizeof(bool) == 1, "Verified native ownership ABI requires 64-bit pointers and 8-bit bytes");
struct OwnedBudget {
  size_t nodes = ${limits.visits}, native_bytes = ${limits.bytes}, storage_bytes = ${limits.bytes};
  static void charge(size_t& available, size_t count, size_t width) {
    if (width && count > available / width) throw Error(${m}_LIMIT);
    available -= count * width;
  }
  void enter(size_t depth) { if (depth > ${limits.depth} || !nodes) throw Error(${m}_LIMIT); --nodes; }
  void native(size_t count, size_t width) { charge(native_bytes, count, width); }
  void storage(size_t count, size_t width) { charge(storage_bytes, count, width); }
};
template<class T> inline const T& owned_read(const T *value) {
  const auto address = reinterpret_cast<uintptr_t>(value);
  if (!value || address % alignof(T) || sizeof(T) > UINTPTR_MAX - address) throw Error(${m}_MALFORMED_RESULT);
  return *value;
}
template<class T> inline void owned_span(const T *data, size_t count) {
  if (count) {
    if (count > (UINTPTR_MAX - reinterpret_cast<uintptr_t>(data)) / sizeof(T)) throw Error(${m}_MALFORMED_RESULT);
    (void)owned_read(data);
  }
}
inline bool owned_bool(const bool& source) {
  uint8_t value; std::memcpy(&value, &source, 1);
  if (value > 1) throw Error(${m}_MALFORMED_RESULT);
  return value != 0;
}
inline void owned_utf8(const char *data, size_t length, ${p}_status status) {
  size_t i = 0;
  while (i < length) {
    uint32_t value = static_cast<uint8_t>(data[i++]), minimum; size_t remaining;
    if (value < 0x80) continue;
    if (value >= 0xc2 && value <= 0xdf) { value &= 0x1f; minimum = 0x80; remaining = 1; }
    else if (value >= 0xe0 && value <= 0xef) { value &= 0x0f; minimum = 0x800; remaining = 2; }
    else if (value >= 0xf0 && value <= 0xf4) { value &= 7; minimum = 0x10000; remaining = 3; }
    else throw Error(status);
    if (remaining > length - i) throw Error(status);
    while (remaining--) {
      uint8_t next = static_cast<uint8_t>(data[i++]);
      if ((next & 0xc0) != 0x80) throw Error(status);
      value = (value << 6) | (next & 0x3f);
    }
    if (value < minimum || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) throw Error(status);
  }
}
struct OwnedOutput {
  NativeOwner owner;
  std::shared_ptr<State> state;
  std::shared_ptr<Lease> lease;${anchors ? "\n  bool anchored_result = false;" : ""}
  explicit OwnedOutput(std::shared_ptr<State> input, std::shared_ptr<Lease> borrowed = {})
    : state(std::move(input)), lease(std::move(borrowed)) {}
  const std::shared_ptr<Lease>& hold() {
    if (!lease) {
      if (!owner.value) throw Error(${m}_MALFORMED_RESULT);
      lease = state->adopt(owner${anchors ? ", anchored_result" : ""});
    }
    lease->require(); return lease;
  }
};
${bigint ? `inline size_t owned_integer_limbs(const Nat& source) {
  auto high = source.backend().limbs()[source.backend().size() - 1]; size_t bits = 0;
  while (high) { ++bits; high >>= 1; }
  bits += (source.backend().size() - 1) * sizeof(*source.backend().limbs()) * CHAR_BIT;
  return (bits + GMP_NUMB_BITS - 1) / GMP_NUMB_BITS;
}
struct OwnedIntegerView {
  std::vector<mp_limb_t> limbs;
  __mpz_struct value{};
  explicit OwnedIntegerView(const Int& source) {
    limbs.reserve(owned_integer_limbs(source));
    if (source != 0) boost::multiprecision::export_bits(source, std::back_inserter(limbs), GMP_NUMB_BITS, false);
    const auto length = static_cast<mp_size_t>(limbs.size());
    (void)mpz_roinit_n(&value, limbs.data(), source < 0 ? -length : length);
  }
  OwnedIntegerView(const OwnedIntegerView&) = delete;
  OwnedIntegerView& operator=(const OwnedIntegerView&) = delete;
  // mpz_roinit_n borrows the C++ limb vector. Never clear or mutate this GMP view.
};` : ""}
`;
};

/**
 * Validate complete argument graphs before allocating their temporary C views.
 * Result containers own their copied storage; resource leaves share a checked
 * result lease, or a callback borrow that expires when its frame returns.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 * @param options - Consumer capabilities implemented by the caller.
 * @param options.transferredInputs - Enable explicit rvalue input consumption.
 * @param options.anchoredResults - Validate whole-result lifetimes.
 * @param options.receiverExports - Preserve named receiver calls.
 * @param options.hostCallbacks - The compiled adapter provides callbacks and copies.
 */
export const generateOwnedCppConversions = (ir, { transferredInputs = false, anchoredResults = false, receiverExports = false, hostCallbacks = true } = {}) => {
	const values = generateOwnedCppValues(ir, { transferredInputs, anchoredResults, receiverExports, hostCallbacks }), { c } = values, p = c.prefix, m = p.toUpperCase();
	const nodes = new Map(values.types.map(node => [node.id, node]));
	const declarations = [], structures = [], implementations = [];
	const finite = new Set(); let changed = true;
	while(changed)
	{
		changed = false;
		for(const node of nodes.values())
		{
			if(finite.has(node.id)) continue;
			const all = fields => fields.every(field => finite.has(field.type));
			const productive = node.leaf || node.element || node.kind === "option" || (node.kind === "variant" ? node.cases.some(branch => all(branch.fields))
				: node.kind === "result" ? node.fields.some(field => finite.has(field.type)) : all(node.fields));
			if(productive)
			{
				finite.add(node.id); changed = true;
			}
		}
	}
	for(const node of nodes.values()) declarations.push(`struct OwnedView${node.index};`
		, `inline void owned_check${node.index}(const ${node.hostName}&, size_t, OwnedBudget&, const std::shared_ptr<State>&);`
		, `inline ${node.hostName} owned_from${node.index}(const ${node.cName}&, size_t, OwnedBudget&, OwnedOutput&);`);
	for(const node of nodes.values())
	{
		const i = node.index, host = node.hostName, raw = node.cName;
		const members = [], make = ["(void)source; (void)state;"], check = ["(void)source; (void)state; budget.enter(depth);"
			, `budget.native(1, sizeof(${raw})); budget.storage(1, sizeof(OwnedView${i}));`];
		const from = ["(void)source; (void)output; budget.enter(depth);"
			, `budget.native(1, sizeof(${raw})); budget.storage(1, sizeof(${host}));`];
		const fieldInput = (field, slot) => field.boxed ? `*(${slot})` : slot;
		const checkField = (field, slot) => [
			...field.boxed ? [`if (!(${slot})) throw Error(${m}_INVALID_ARGUMENT);`] : []
			, `owned_check${nodes.get(field.type).index}(${fieldInput(field, slot)}, depth + 1, budget, state);`
		];
		const makeField = (field, input, output, suffix) => {
			const child = nodes.get(field.type), member = `field${suffix}`;
			members.push(`std::unique_ptr<OwnedView${child.index}> ${member};`);
			return [`${member} = std::make_unique<OwnedView${child.index}>(${fieldInput(field, input)}, state);`
				, `${output} = ${field.pointer ? "&" : ""}${member}->value;`];
		};
		const fromField = (field, slot) => `owned_from${nodes.get(field.type).index}(${field.pointer ? `owned_read(${slot})` : slot}, depth + 1, budget, output)`;
		if(!finite.has(node.id))
		{
			check.push(`throw Error(${m}_INVALID_ARGUMENT);`); make.push(`throw Error(${m}_INVALID_ARGUMENT);`);
			from.push(`throw Error(${m}_MALFORMED_RESULT);`);
		}
		else if(node.identity)
		{
			check.push(`(void)ResourceAccess::get<${raw}>(source, state);`);
			make.push(`value = ResourceAccess::get<${raw}>(source, state);`);
			from.push(`if (!source) throw Error(${m}_MALFORMED_RESULT);`
				, `return ResourceAccess::make<${node.identityTag}>(output.hold(), source);`);
		}
		else if(node.kind === "primitive")
		{
			const name = node.name;
			if(name === "unit")
			{ make.push("value = 0;"); from.push(`if (source) throw Error(${m}_MALFORMED_RESULT);`, "return {};"); }
			else if(["string", "bytes"].includes(name))
			{
				check.push("budget.native(source.size(), 1);");
				if(name === "string") check.push(`owned_utf8(source.data(), source.size(), ${m}_INVALID_ARGUMENT);`);
				make.push("value.data = source.data(); value.length = source.size();");
				from.push("budget.native(source.length, 1); owned_span(source.data, source.length);"
					, `budget.storage(source.length${name === "string" ? " + 1" : ""}, 1);`
					, ...name === "string" ? [`owned_utf8(source.data, source.length, ${m}_MALFORMED_RESULT);`] : []
					, `return source.length ? ${host}(${name === "string" ? "source.data, source.length" : "source.data, source.data + source.length"}) : ${host}{};`);
			}
			else if(node.integer)
			{
				if(name === "nat") check.push(`if (source < 0) throw Error(${m}_INVALID_ARGUMENT);`);
				check.push(`if (source.backend().size() > budget.native_bytes / sizeof(boost::multiprecision::limb_type) + 1) throw Error(${m}_LIMIT);`
					, "const size_t count = owned_integer_limbs(source);"
					, "budget.native(count, sizeof(mp_limb_t)); budget.storage(count, sizeof(mp_limb_t));");
				members.push("std::unique_ptr<OwnedIntegerView> integer;");
				make.push("integer = std::make_unique<OwnedIntegerView>(source); value = &integer->value;");
				from.push("const auto signed_count = owned_read(source)._mp_size;"
					, "const size_t count = signed_count < 0 ? size_t(0) - static_cast<size_t>(signed_count) : static_cast<size_t>(signed_count);"
					, "budget.native(count, sizeof(mp_limb_t)); budget.storage(count, sizeof(mp_limb_t));"
					, "const mp_limb_t *limbs = mpz_limbs_read(source); owned_span(limbs, count);"
					, ...name === "nat" ? [`if (mpz_sgn(source) < 0) throw Error(${m}_MALFORMED_RESULT);`] : []
					, `${host} result = 0;`
					, "if (count) boost::multiprecision::import_bits(result, limbs, limbs + count, GMP_NUMB_BITS, false);"
					, name === "int" ? "return mpz_sgn(source) < 0 ? -result : result;" : "return result;");
			}
			else
			{
				if(name === "char") check.push(`if (source > 0x10ffff || (source >= 0xd800 && source <= 0xdfff)) throw Error(${m}_INVALID_ARGUMENT);`);
				make.push(`value = static_cast<${raw}>(source);`);
				if(name === "bool") from.push("return owned_bool(source);");
				else
				{
					if(name === "char") from.push(`if (source > 0x10ffff || (source >= 0xd800 && source <= 0xdfff)) throw Error(${m}_MALFORMED_RESULT);`);
					from.push(`return static_cast<${host}>(source);`);
				}
			}
		}
		else if(node.element)
		{
			const child = nodes.get(node.element);
			check.push(`if (source.size() > budget.nodes) throw Error(${m}_LIMIT);`
				, `budget.native(source.size(), sizeof(${child.cName})); budget.storage(source.size(), sizeof(${child.cName}));`
				, `for (const auto& child : source) owned_check${child.index}(child, depth + 1, budget, state);`);
			members.push(`std::vector<OwnedView${child.index}> items;`, `std::unique_ptr<${child.cName}[]> data;`);
			make.push("items.reserve(source.size());", `data = source.empty() ? nullptr : std::make_unique<${child.cName}[]>(source.size());`
				, "for (const auto& child : source) items.emplace_back(child, state);"
				, "for (size_t j = 0; j < source.size(); ++j) data[j] = items[j].value;"
				, "value.data = data.get(); value.length = source.size();");
			from.push(`if (source.length > budget.nodes) throw Error(${m}_LIMIT);`
				, `budget.native(source.length, sizeof(${child.cName})); budget.storage(source.length, sizeof(${child.hostName}));`
				, "owned_span(source.data, source.length);", `${host} result; result.reserve(source.length);`
				, `for (size_t j = 0; j < source.length; ++j) result.push_back(owned_from${child.index}(source.data[j], depth + 1, budget, output));`
				, "return result;");
		}
		else if(node.kind === "variant")
		{
			check.push(`if (source.value.valueless_by_exception()) throw Error(${m}_INVALID_ARGUMENT);`, "switch (source.value.index()) {");
			make.push("switch (source.value.index()) {");
			from.push("std::underlying_type_t<decltype(source.kind)> kind;"
				, "std::memcpy(&kind, &source.kind, sizeof(kind));", "switch (kind) {");
			node.cases.forEach((branch, index) => {
				const slots = branch.fields.map(field => `std::get<${branch.hostName}>(source.value).${field.name}`);
				check.push(`case ${index}:`, ...branch.fields.flatMap((field, j) => checkField(field, slots[j])), "break;");
				make.push(`case ${index}: value.kind = ${branch.tag};`
					, ...branch.fields.flatMap((field, j) => makeField(field, slots[j], `value.cases.${branch.name}.${field.name}`, `${index}_${j}`)), "break;");
				from.push(`case ${branch.tag}: return ${branch.hostName}{${branch.fields.map(field => fromField(field, `source.cases.${branch.name}.${field.name}`)).join(", ")}};`);
			});
			check.push(`default: throw Error(${m}_INVALID_ARGUMENT);`, "}");
			make.push(`default: throw Error(${m}_INVALID_ARGUMENT);`, "}");
			from.push(`default: throw Error(${m}_MALFORMED_RESULT);`, "}");
		}
		else if(["option", "result"].includes(node.kind))
		{
			const option = node.kind === "option", flag = option ? "has_value" : "is_ok";
			if(!option) check.push(`if (source.valueless_by_exception()) throw Error(${m}_INVALID_ARGUMENT);`);
			make.push(`value.${flag} = ${option ? "source.has_value()" : "source.index() == 0"};`);
			from.push(`const bool selected = owned_bool(source.${flag});`);
			node.fields.forEach((field, index) => {
				const condition = option ? "source.has_value()" : `source.index() == ${index}`;
				const slot = option ? "*source" : `std::get<${index}>(source).value`;
				check.push(`if (${condition}) {`, ...checkField(field, slot), "}");
				make.push(`if (${condition}) {`, ...makeField(field, slot, `value.${field.name}`, index), "}");
				const expression = fromField(field, `source.${field.name}`), child = nodes.get(field.type);
				const payload = field.boxed ? `Box<${child.hostName}>` : child.hostName;
				from.push(`if (${index ? "!" : ""}selected) return ${option ? `${host}{std::in_place, ${expression}}` : `${host}{${index ? "Err" : "Ok"}<${payload}>{${expression}}}`};`);
			});
			from.push(option ? "return std::nullopt;" : `throw Error(${m}_MALFORMED_RESULT);`);
		}
		else
		{
			node.fields.forEach((field, index) => {
				const slot = `source.${node.kind === "tuple" ? ["first", "second"][index] : field.name}`;
				check.push(...checkField(field, slot)); make.push(...makeField(field, slot, `value.${field.name}`, index));
			});
			from.push(`return ${host}{${node.fields.map(field => fromField(field, `source.${field.name}`)).join(", ")}};`);
		}
		structures.push(`struct OwnedView${i} {`, ...members.map(line => `  ${line}`), `  ${raw} value{};`
			, `  OwnedView${i}(const ${host}&, const std::shared_ptr<State>&);`, `  ~OwnedView${i}();`
			, `  OwnedView${i}(OwnedView${i}&&) noexcept;`, `  OwnedView${i}(const OwnedView${i}&) = delete;`, "};");
		implementations.push(`inline OwnedView${i}::~OwnedView${i}() = default;`
			, `inline OwnedView${i}::OwnedView${i}(OwnedView${i}&&) noexcept = default;`
			, `inline void owned_check${i}(const ${host}& source, size_t depth, OwnedBudget& budget, const std::shared_ptr<State>& state) {\n${check.map(line => `  ${line}`).join("\n")}\n}`
			, `inline OwnedView${i}::OwnedView${i}(const ${host}& source, const std::shared_ptr<State>& state) {\n${make.map(line => `  ${line}`).join("\n")}\n}`
			, `inline ${host} owned_from${i}(const ${raw}& source, size_t depth, OwnedBudget& budget, OwnedOutput& output) {\n${from.map(line => `  ${line}`).join("\n")}\n}`);
	}
	const header = ["#pragma once", `#include "${p}-values.hpp"`
		, "#include <climits>", "#include <cstring>", "#include <iterator>"
		, `namespace lean_bridge::${p}::detail {`
		, support(p, c.native.model.limits, c.nodes.some(node => node.integer), c.functions.some(item => item.anchor !== undefined))
		, ...declarations, ...structures, ...implementations, "}", ""].join("\n");
	return { ...values, valuesHeader: values.header, header };
};
