/**
 * Compiler-authenticated typed carriers for values containing retained resources.
 * These are private Lean/C helpers, not a copied wire ABI or a host projection.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { compileOwnedAggregateModel } from "../abi/owned-aggregate-model.mjs";
import { projectNativeMetadata } from "../analyze/native-metadata.mjs";
import { createOwnedElaboratedSemanticModel } from "../analyze/semantic-model.mjs";

const primitives = { unit: "Unit", bool: "Bool", char: "Char"
	, nat: "Nat", int: "Int", uint8: "UInt8", uint16: "UInt16"
	, uint32: "UInt32", uint64: "UInt64", int8: "Int8", int16: "Int16"
	, int32: "Int32", int64: "Int64", usize: "USize", isize: "ISize"
	, float32: "Float32", float64: "Float", string: "String", bytes: "ByteArray" };
const fail = message => { throw new TypeError(`Owned aggregate carriers: ${message}`); };

/**
 * Generate all constructors, projections, exported calls and closure invocations.
 * Resource leaves cross in typed Arrays and retain their original Lean identity.
 * Host callback construction and public handle conversion are separate layers.
 *
 * @param options - Fresh native metadata and independently retained compiler evidence.
 * @param options.metadata - Compiler-emitted native signatures.
 * @param options.sourceIdentity - Authorized request, sources, interfaces and tool identities.
 * @param options.component - Source package coordinates.
 */
export const generateOwnedAggregateCarriers = ({ metadata, sourceIdentity, component }) => {
	const elaborated = projectNativeMetadata(metadata, sourceIdentity, { copiedGraphs: true, ownedGraphs: true });
	if(sourceIdentity.reviewedBindingIr !== undefined) fail("reviewed v4 source reconciliation is not yet connected");
	const { document } = createOwnedElaboratedSemanticModel({ metadata
		, request: sourceIdentity.request
		, component, elaborationSha256: elaborated.sha256 });
	const model = compileOwnedAggregateModel(document);
	const nodes = new Map(model.types.map(type => [type.id, type]));
	const definitions = new Map(document.types.map(type => [type.id, type]));
	const declarations = new Map(document.declarations.map(item => [item.id, item]));
	const prefix = `lean_bridge_owned_${sha256(`${component.id}\0${model.bindingIrSha256}`).slice(0, 24)}`;
	const module = `LeanBridgeOwned${sha256(prefix).slice(0, 16)}`;
	const symbols = { types: Object.fromEntries(model.types.map(type => [type.id, `${prefix}_t${sha256(type.id).slice(0, 20)}`]))
		, exports: Object.fromEntries(model.declarations.map(item => [item.id, `${prefix}_f${sha256(item.id).slice(0, 20)}`])) };
	const sourceType = (id, active = new Set()) => {
		if(active.has(id)) fail("recursive callable type lacks a nominal value boundary");
		const node = nodes.get(id);
		if(node.kind === "primitive") return `_root_.${primitives[node.name]}`;
		if(node.kind === "callback")
		{
			const seen = new Set(active); seen.add(id);
			return `(${[...node.callable.parameters, node.callable.result].map(site => sourceType(site.type, seen)).join(" → ")})`;
		}
		const definition = definitions.get(id);
		if(definition) return `_root_.${definition.source.declaration}`;
		const children = node.arguments.map(id => sourceType(id, active));
		if(node.kind === "result") return `(_root_.Except ${children[1]} ${children[0]})`;
		return `(_root_.${{ array: "Array", list: "List", option: "Option", tuple: "Prod" }[node.kind]} ${children.join(" ")})`;
	};
	const carrier = id => `(_root_.Array ${sourceType(id)})`;
	const lines = [...new Set(elaborated.declarations.map(item => `import ${item.module}`))
		, "set_option maxRecDepth 10000"
		, `namespace ${module}`
		, "def carrierValue {α : Type} (value : _root_.Array α) : _root_.Option α :="
		, "  if bound : 0 < value.size then"
		, "    if value.size == 1 then .some (value[0]'bound) else .none"
		, "  else .none", ""
		, "def carrierResult {α : Type} (value : _root_.Option α) : _root_.Array α :="
		, "  match value with | .none => #[] | .some result => #[result]", ""
		, "def carrierCollect {α : Type} (values : _root_.Array (_root_.Array α)) : _root_.Option (_root_.Array α) := Id.run do"
		, `  if values.size > ${model.limits.visits} then return .none`
		, "  let mut result := #[]", "  for value in values do"
		, "    match carrierValue value with", "    | .none => return .none"
		, "    | .some item => result := result.push item"
		, "  return .some result", ""
		, "def carrierListItems {α : Type} (values : _root_.List α) (limit : _root_.Nat) : _root_.Array (_root_.Array α) :="
		, "  let rec loop : _root_.Nat → _root_.List α → _root_.Array (_root_.Array α) → _root_.Array (_root_.Array α)"
		, "    | 0, _, acc => acc", "    | _, [], acc => acc"
		, "    | fuel + 1, head :: tail, acc => loop fuel tail (acc.push #[head])"
		, `  loop (min limit ${model.limits.visits + 1}) values #[]`
		, ""
	];
	const header = ["#pragma once", "#include <lean/lean.h>", "#include <stdint.h>"
		, "/* Private typed helpers consume their Array arguments and return an owned Array. */"];
	const checked = (names, body) => ["carrierResult (do"
		, ...names.map(name => `  let ${name} ← carrierValue ${name}`)
		, ...body.map(line => `  ${line}`), ")"];
	let serial = 0;
	const emit = (symbol, parameters, result, body, count, branch = false) => {
		lines.push(`@[export ${symbol}]`, `def carrier${serial++} ${parameters} : ${result} :=`
			, ...body.map(line => `  ${line}`), "");
		header.push(`${branch ? "uint32_t" : "lean_object *"} ${symbol}(${Array(Math.max(1, count)).fill("lean_object *").join(", ")});`);
	};
	for(const node of model.types)
	{
		if(["primitive", "resource"].includes(node.kind)) continue;
		const symbol = symbols.types[node.id], input = `(value : ${carrier(node.id)})`;
		const make = (name, children, expression) => {
			const names = children.map((_, index) => `a${index}`);
			emit(`${symbol}_${name}`, children.map((id, index) => `(${names[index]} : ${carrier(id)})`).join(" ") || "(_bridgeUnit : _root_.Unit)"
				, carrier(node.id), checked(names, [`pure (${expression})`]), children.length);
		};
		const field = (name, id, body) => emit(`${symbol}_${name}`, input, carrier(id), checked(["value"], body), 1);
		const branch = cases => emit(`${symbol}_branch`, input, "_root_.UInt32", ["match carrierValue value with"
			, "| .none => 4294967295", "| .some value =>", "  match value with"
			, ...cases.map((pattern, index) => `  | ${pattern} => ${index}`)], 1, true);
		if(node.kind === "callback")
		{
			const names = node.callable.parameters.map((_, index) => `a${index}`);
			emit(`${symbol}_apply`, [`(closure : ${carrier(node.id)})`
				, ...node.callable.parameters.map((site, index) => `(${names[index]} : ${carrier(site.type)})`)].join(" ")
			, carrier(node.callable.result.type), checked(["closure", ...names], [`pure (closure ${names.join(" ")})`]), names.length + 1);
			continue;
		}
		if(node.kind === "alias")
		{ make("make", [node.target], "a0"); field("field0", node.target, ["pure value"]); continue; }
		if(node.kind === "record")
		{
			make("make", node.fields.map(field => field.type), `({ ${node.fields.map((field, index) => `«${field.name}» := a${index}`).join(", ")} } : ${sourceType(node.id)})`);
			node.fields.forEach((item, index) => field(`field${index}`, item.type, [`pure value.«${item.name}»`]));
			continue;
		}
		if(node.kind === "variant")
		{
			branch(node.cases.map(item => `.«${item.name}» ${item.fields.map(() => "_").join(" ")}`));
			node.cases.forEach((item, index) => {
				make(`make${index}`, item.fields.map(field => field.type), `.«${item.name}» ${item.fields.map((_, index) => `a${index}`).join(" ")}`);
				item.fields.forEach((child, fieldIndex) => field(`case${index}_field${fieldIndex}`, child.type, [
					"match value with"
					, `| .«${item.name}» ${item.fields.map((_, index) => index === fieldIndex ? "child" : "_").join(" ")} => pure child`
					, ...(node.cases.length > 1 ? ["| _ => .none"] : [])
				]));
			});
			continue;
		}
		const children = node.arguments;
		if(["array", "list"].includes(node.kind))
		{
			const array = node.kind === "array";
			emit(`${symbol}_make`, `(values : _root_.Array ${carrier(children[0])})`, carrier(node.id)
				, ["carrierResult (do", "  let values ← carrierCollect values", `  pure ${array ? "values" : "values.toList"}`, ")"], 1);
			emit(`${symbol}_items`, input, `(_root_.Array ${carrier(children[0])})`, ["match carrierValue value with"
				, "| .none => #[]"
				, `| .some values => ${array ? `(values.extract 0 ${model.limits.visits + 1}).map (fun child => #[child])` : `carrierListItems values ${model.limits.visits + 1}`}`], 1);
			emit(`${symbol}_itemsBounded`, `${input} (limit : _root_.Nat)`, `(_root_.Array ${carrier(children[0])})`
				, [`let bound := min limit ${model.limits.visits} + 1`
					, "match carrierValue value with"
					, "| .none => #[]"
					, `| .some values => ${array ? "(values.extract 0 bound).map (fun child => #[child])" : "carrierListItems values bound"}`], 2);
			continue;
		}
		if(node.kind === "tuple")
		{
			make("make", children, "(a0, a1)");
			children.forEach((child, index) => field(`field${index}`, child, [`pure value.${index ? "snd" : "fst"}`]));
			continue;
		}
		const option = node.kind === "option", names = option ? ["none", "some"] : ["ok", "error"];
		branch([`.${names[0]}${option ? "" : " _"}`, `.${names[1]} _`]);
		if(option) make("none", [], ".none");
		children.forEach((child, index) => {
			const name = option ? "some" : names[index];
			make(`make${index}`, [child], `.${name} a0`);
			field(`field${index}`, child, ["match value with", `| .${name} child => pure child`, "| _ => .none"]);
		});
	}
	for(const declaration of model.declarations)
	{
		const original = declarations.get(declaration.id);
		const selectedName = original.source.extensions?.["lean-lang.org/specialization"]?.name ?? original.source.declaration;
		const source = elaborated.declarations.find(item => item.name === selectedName);
		if(!source || declaration.kind !== "function" || declaration.receiver) fail("export lacks a selected pure function");
		const names = declaration.parameters.map((_, index) => `a${index}`);
		const parameters = declaration.parameters.map((site, index) => `(${names[index]} : ${carrier(site.type)})`).join(" ");
		const call = `${source.specialization ? `(${source.specialization.application})` : `_root_.${source.name}`} ${names.join(" ")}`;
		emit(symbols.exports[declaration.id], parameters || "(_bridgeUnit : _root_.Unit)", carrier(declaration.result.type)
			, checked(names, [`pure (${call})`]), names.length);
	}
	lines.push(`end ${module}`, "");
	return Object.freeze({ model, module, symbols
		, leanSource: lines.join("\n")
		, header: header.join("\n") + "\n"
		, metadataSha256: elaborated.sha256
		, sourceIdentitySha256: sha256(canonicalJson(sourceIdentity)) });
};
