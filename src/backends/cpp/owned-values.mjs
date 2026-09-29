/**
 * C++ value projections for explicitly owned aggregates. Containers copy their
 * data while resource leaves share checked leases and retain nominal identity.
 * Compiled conversion and installed-package admission are separate steps.
 *
 * @file
 */
import { sha256 } from "../../capsule/node.mjs";
import { cKeywords } from "../c/generate.mjs";
import { generateOwnedCValues } from "../c/owned-values.mjs";
import { planNativeGraphStorage } from "../c/copied-graph-layout.mjs";
import { cppValueBox } from "./copied-graph-values.mjs";
import { ownedCppRuntime } from "./owned-runtime.mjs";

const scalar = {
	unit: "std::monostate", bool: "bool", string: "std::string"
	, bytes: "std::vector<uint8_t>", nat: "Nat", int: "Int", char: "char32_t"
	, usize: "uint64_t", isize: "int64_t", float32: "float", float64: "double"
};

/**
 * Emit source-named records, variants, transparent aliases and standard containers.
 * Recursive or oversized inline fields use deep-copy boxes; identity leaves never
 * become copied integer tokens. Returned callable leaves retain distinct leases;
 * their executable wrappers are supplied by the conversion/package projection.
 *
 * @param ir - Validated explicit ownership contract with named resource identities.
 * @param options - Consumer capabilities implemented by the caller.
 * @param options.transferredInputs - Enable explicit rvalue input consumption.
 */
export const generateOwnedCppValues = (ir, { transferredInputs = false } = {}) => {
	const c = generateOwnedCValues(ir, { hostCallbacks: true, transferredInputs });
	const transfers = c.functions.some(item => item.transfers?.length);
	const nodes = new Map(c.nodes.map(node => [node.id, { ...node
		, aggregate: !node.leaf
		, fields: node.fields.map(field => ({ ...field, storage: "value" }))
		, cases: node.cases.map(branch => ({ ...branch, fields: branch.fields.map(field => ({ ...field, storage: "value" })) }))
	}]));
	const layout = planNativeGraphStorage(nodes);
	const occupied = new Set(["Box", "Ok", "Err", "Result", "Resource", "Nat", "Int", "Error", "detail", "std", "boost", "with_recovery"]);
	const claim = name => {
		if(typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/u.test(name) || name.includes("__") || cKeywords.has(name) || occupied.has(name))
			throw new TypeError(`Owned C++ value name is reserved or duplicated: ${name}`);
		occupied.add(name); return name;
	};
	for(const fn of c.functions) claim(fn.cName.slice(c.prefix.length + 1));
	const names = new Map(), identities = new Map(), alternatives = new Map(), containers = new Map();
	for(const node of nodes.values())
	{
		if(node.kind !== "primitive" && node.name) names.set(node.id, claim(node.name));
		else if(node.kind !== "primitive") containers.set(node.id, claim(`Value${sha256(node.id).slice(0, 20)}`));
		if(node.identity) identities.set(node.id, `Identity${sha256(node.id).slice(0, 20)}`);
	}
	for(const node of nodes.values()) if(node.kind === "variant")
		alternatives.set(node.id, node.cases.map(branch => claim(names.get(node.id) + branch.name.split("_")
			.map(part => part ? part[0].toUpperCase() + part.slice(1) : "_").join(""))));
	const definitions = new Map(c.native.model.types.map(node => [node.id, node]));
	for(const alias of c.native.aliases) claim(definitions.get(alias.id).name);
	const groups = new Map(layout.boxedGroups.flatMap((group, index) => group.map(id => [id, index])));
	const boxed = (parent, field) => field.storage === "pointer" && !(containers.has(field.type)
		&& groups.has(parent) && groups.get(parent) === groups.get(field.type));
	const emitted = new Set();
	const type = (id, active = new Set()) => {
		const node = nodes.get(id);
		if(names.has(id)) return names.get(id);
		if(node.kind === "primitive") return scalar[node.name] ?? `${node.name}_t`;
		if(emitted.has(id)) return containers.get(id);
		if(active.has(id)) throw new TypeError("Owned C++ container cycle requires a nominal value boundary");
		const next = new Set(active); next.add(id);
		if(node.element) return `std::vector<${type(node.element, next)}>`;
		const args = node.fields.map(field => boxed(id, field) ? `Box<${type(field.type, next)}>` : type(field.type, next));
		return `${{ option: "std::optional", result: "Result", tuple: "std::pair" }[node.kind]}<${args.join(", ")}>`;
	};
	const bigint = [...nodes.values()].some(node => node.kind === "primitive" && ["nat", "int"].includes(node.name));
	const lines = ["#pragma once", `#include "${c.prefix}.h"`
		, "#include <atomic>", "#include <cstdint>", "#include <list>"
		, "#include <memory>", "#include <mutex>", "#include <optional>"
		, "#include <stdexcept>", "#include <string>", "#include <thread>"
		, "#include <type_traits>", "#include <utility>", "#include <variant>"
		, "#include <vector>", "#include <unistd.h>"
		, ...bigint ? ["#ifndef BOOST_MP_STANDALONE", "#define BOOST_MP_STANDALONE", "#endif", "#include <boost/multiprecision/cpp_int.hpp>"] : []
		, `namespace lean_bridge::${c.prefix} {`
		, ownedCppRuntime(c.prefix, { transferredInputs: transfers }), cppValueBox
		, "template<class T> struct Ok { T value; friend bool operator==(const Ok&, const Ok&) = default; };"
		, "template<class E> struct Err { E value; friend bool operator==(const Err&, const Err&) = default; };"
		, "template<class T, class E> using Result = std::variant<Ok<T>, Err<E>>;"
		, ...bigint ? ["using Nat = boost::multiprecision::cpp_int;", "using Int = boost::multiprecision::cpp_int;"] : []];
	for(const node of nodes.values())
	{
		if(node.identity) lines.push(`namespace detail { struct ${identities.get(node.id)}; }`
			, `using ${names.get(node.id)} = Resource<detail::${identities.get(node.id)}>;`);
		else if(names.has(node.id)) lines.push(`struct ${names.get(node.id)};`);
	}
	for(const [id, branches] of alternatives)
	{
		const name = names.get(id);
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
		const node = nodes.get(id), name = names.get(id);
		if(containers.has(id))
		{ lines.push(`using ${containers.get(id)} = ${type(id)};`); emitted.add(id); }
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
	for(const alias of c.native.aliases) lines.push(`using ${definitions.get(alias.id).name} = ${type(alias.target)};`);
	lines.push(...equalities, "}", "");
	const members = (id, fields) => fields.map(field => ({ ...field, boxed: boxed(id, field) }));
	return { c, layout, header: lines.join("\n")
		, types: [...nodes.values()].map(node => ({ ...node
			, hostName: type(node.id), identityTag: identities.get(node.id)
			, fields: members(node.id, node.fields)
			, cases: node.cases.map((branch, index) => ({ ...branch, hostName: alternatives.get(node.id)[index], fields: members(node.id, branch.fields) })) })) };
};
