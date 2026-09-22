/**
 * Owned C++ values for finite copied graphs, with deep-copy recursive boxes.
 * Value declarations alone do not admit compiled or installed C++ exports.
 *
 * @file
 */
import { sha256 } from "../../capsule/node.mjs";
import { compileCopiedCGraphLayout } from "../c/copied-graph-layout.mjs";
import { cKeywords } from "../c/generate.mjs";

const scalar = {
	unit: "std::monostate", bool: "bool", string: "std::string"
	, bytes: "std::vector<uint8_t>"
	, nat: "Nat", int: "Int", char: "char32_t", usize: "uint64_t", isize: "int64_t"
	, float32: "float", float64: "double"
};
const box = `namespace detail {
template<class T, class U> struct BoxInput : std::is_same<T, U> {};
template<class... T, class U> struct BoxInput<std::variant<T...>, U>
  : std::bool_constant<std::is_same_v<std::variant<T...>, U> || (std::is_same_v<T, U> || ...)> {};
template<class T, class U> struct BoxInput<std::optional<T>, U>
  : std::bool_constant<std::is_same_v<std::optional<T>, U> || std::is_same_v<T, U> || std::is_same_v<std::nullopt_t, U>> {};
}
template<class T> class Box {
  std::unique_ptr<T> value_;
public:
  Box() noexcept = default;
  template<class U>
  requires detail::BoxInput<T, std::remove_cvref_t<U>>::value
  Box(U&& value) : value_(std::make_unique<T>(std::forward<U>(value))) {}
  Box(const Box& other) : value_(other ? std::make_unique<T>(*other) : nullptr) {}
  Box(Box&&) noexcept = default;
  Box& operator=(const Box& other) {
    if (this != &other) { Box copy(other); value_.swap(copy.value_); }
    return *this;
  }
  Box& operator=(Box&&) noexcept = default;
  template<class U>
  requires detail::BoxInput<T, std::remove_cvref_t<U>>::value
  Box& operator=(U&& value) {
    Box copy(std::forward<U>(value)); value_.swap(copy.value_); return *this;
  }
  explicit operator bool() const noexcept { return static_cast<bool>(value_); }
  T& operator*() { if (!value_) throw std::logic_error("Empty Lean value box"); return *value_; }
  const T& operator*() const { if (!value_) throw std::logic_error("Empty Lean value box"); return *value_; }
  T* operator->() { return &**this; }
  const T* operator->() const { return &**this; }
  friend bool operator==(const Box& a, const Box& b) {
    return a ? b && *a == *b : !b;
  }
};`;

/**
 * Generate native containers, named records and named variant alternatives.
 * Only layout edges requiring indirection use a Box; copying a Box duplicates
 * its value. Forward declarations close nominal cycles without opaque handles.
 *
 * @param ir - Pure copied Binding IR with finite recursive definitions.
 */
export const generateCopiedCppGraphValues = ir => {
	const layout = compileCopiedCGraphLayout(ir), definitions = new Map(ir.types.map(type => [type.id, type]));
	const nodes = new Map(layout.nodes.map(node => [node.id, node]));
	const names = new Map(), occupied = new Set(["Box", "Ok", "Err", "Result", "Nat", "Int", "Error", "detail", "std", "boost"]);
	const claim = name => {
		if(typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || name.includes("__") || cKeywords.has(name) || occupied.has(name))
			throw new TypeError(`C++ graph value name is reserved or duplicated: ${name}`);
		occupied.add(name); return name;
	};
	for(const root of layout.roots) claim(root.name.slice(layout.prefix.length + 1));
	for(const definition of ir.types) names.set(definition.id, claim(definition.name));
	const alternatives = new Map(), containerNames = new Map();
	for(const node of layout.nodes)
	{
		if(node.kind === "variant") alternatives.set(node.id, node.cases.map(branch => claim(names.get(node.ref.id) + branch.name.split("_").map(part => part ? part[0].toUpperCase() + part.slice(1) : "_").join(""))));
		if(node.ref.kind === "apply") containerNames.set(node.id, claim(`Graph${sha256(node.id).slice(0, 20)}`));
	}
	const groups = new Map(layout.boxedGroups.flatMap((group, index) => group.map(id => [id, index])));
	// C needs forward-declared structs for containers too. C++ templates can
	// instead close a cycle at its nominal edge, avoiding Box<optional<Box<T>>>.
	const boxed = (parent, field) => field.storage === "pointer" && !(nodes.get(field.type).ref.kind === "apply"
		&& groups.has(parent) && groups.get(parent) === groups.get(field.type));
	const emitted = new Set();
	const type = id => {
		const node = nodes.get(id);
		if(node.ref.kind === "named") return names.get(node.ref.id);
		if(node.kind === "primitive") return scalar[node.ref.name] ?? `${node.ref.name}_t`;
		if(emitted.has(id)) return containerNames.get(id);
		if(node.element) return `std::vector<${type(node.element)}>`;
		const parameters = node.fields.map(field => boxed(id, field) ? `Box<${type(field.type)}>` : type(field.type));
		return `${{ option: "std::optional", result: "Result", tuple: "std::pair" }[node.kind]}<${parameters.join(", ")}>`;
	};
	const bigint = layout.nodes.some(node => ["nat", "int"].includes(node.ref.name));
	const lines = ["#pragma once", "#include <cstdint>", "#include <memory>"
		, "#include <optional>", "#include <stdexcept>", "#include <string>"
		, "#include <type_traits>", "#include <utility>", "#include <variant>"
		, "#include <vector>"
		, ...bigint ? ["#ifndef BOOST_MP_STANDALONE", "#define BOOST_MP_STANDALONE", "#endif", "#include <boost/multiprecision/cpp_int.hpp>"] : []
		, `namespace lean_bridge::${layout.prefix} {`, box
		, "template<class T> struct Ok { T value; friend bool operator==(const Ok&, const Ok&) = default; };"
		, "template<class E> struct Err { E value; friend bool operator==(const Err&, const Err&) = default; };"
		, "template<class T, class E> using Result = std::variant<Ok<T>, Err<E>>;"
		, ...bigint ? ["using Nat = boost::multiprecision::cpp_int;", "using Int = boost::multiprecision::cpp_int;"] : []];
	for(const node of layout.nodes) if(node.ref.kind === "named") lines.push(`struct ${names.get(node.ref.id)};`);
	// Structural is_constructible checks recurse through optional/result fields
	// in recursive records. Admit only the target value or its named alternatives.
	for(const [id, branches] of alternatives)
	{
		const name = names.get(nodes.get(id).ref.id);
		lines.push(...branches.map(branch => `struct ${branch};`), "namespace detail {"
			, `template<class U> struct BoxInput<${name}, U> : std::bool_constant<${[name, ...branches].map(branch => `std::is_same_v<${branch}, U>`).join(" || ")}> {};`, "}");
	}
	const equalities = [];
	const record = (name, fields, tail = []) => {
		lines.push(`struct ${name} {`, ...fields, ...tail, `  friend bool operator==(const ${name}&, const ${name}&);`, "};");
		equalities.push(`inline bool operator==(const ${name}&, const ${name}&) = default;`);
	};
	const field = (id, item) => `  ${boxed(id, item) ? `Box<${type(item.type)}>` : type(item.type)} ${item.name}{};`;
	for(const id of layout.order)
	{
		const node = nodes.get(id), name = names.get(node.ref.id);
		if(node.ref.kind === "apply")
		{ lines.push(`using ${containerNames.get(id)} = ${type(id)};`); emitted.add(id); }
		else if(node.kind === "record") record(name, node.fields.map(item => field(id, item)));
		else if(node.kind === "variant")
		{
			const branches = alternatives.get(id);
			node.cases.forEach((branch, index) => record(branches[index], branch.fields.map(item => field(id, item))));
			record(name, [`  std::variant<${branches.join(", ")}> value;`], [
				`  ${name}() = default;`, "  template<class T>"
				, `  requires (${branches.map(branch => `std::is_same_v<std::remove_cvref_t<T>, ${branch}>`).join(" || ")})`
				, `  ${name}(T&& branch) : value(std::forward<T>(branch)) {}`
			]);
		}
	}
	for(const alias of layout.aliases) lines.push(`using ${definitions.get(alias.id).name} = ${type(alias.target)};`);
	lines.push(...equalities, "}", "");
	const members = (id, fields) => fields.map(field => ({ ...field, boxed: boxed(id, field) }));
	return { layout, header: lines.join("\n")
		, types: layout.nodes.map(node => ({ id: node.id, name: type(node.id)
			, fields: members(node.id, node.fields)
			, cases: node.cases.map((branch, index) => ({ ...branch, name: alternatives.get(node.id)[index], fields: members(node.id, branch.fields) })) })) };
};
