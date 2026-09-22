/**
 * Total typed Lean carriers for recursive copied values. C sees only Arrays;
 * Lean constructs and projects source values without guessed object layouts.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { assertComponentRecursiveAbi } from "../abi/component-recursive-abi.mjs";
import { componentRecursiveLimits } from "../abi/component-recursive.mjs";

const identity = type => type.kind === "named" ? type.id : canonicalJson(type);
const key = type => sha256(identity(type)).slice(0, 20);

/**
 * Give the C generator the same finite helper identities as the Lean generator.
 *
 * @param abi - Validated copied-graph ABI.
 * @param type - A nominal or structural type reference.
 */
export const componentRecursiveHelper = (abi, type) => `${abi.exports[0].symbol}_recursive_${key(type)}`;

/**
 * Enumerate each nominal or inline shape once, without expanding backedges.
 *
 * @param abi - Closed copied-graph ABI.
 */
export const componentRecursiveTypes = abi => {
	assertComponentRecursiveAbi(abi);
	const definitions = new Map(abi.types.map(type => [type.id, type]));
	const pending = [...abi.types.map(type => ({ kind: "named", id: type.id })), ...abi.exports.flatMap(item => [...item.parameters, item.result])];
	const found = new Map();
	while(pending.length)
	{
		const type = pending.pop(), id = identity(type);
		if(found.has(id)) continue;
		found.set(id, type);
		if(type.kind === "apply") pending.push(...type.arguments);
		if(type.kind !== "named") continue;
		const definition = definitions.get(type.id);
		pending.push(...(definition.kind === "alias" ? [definition.target]
			: definition.kind === "record" ? definition.fields.map(field => field.type)
				: definition.cases.flatMap(branch => branch.fields.map(field => field.type))));
	}
	return [...found.values()];
};

/**
 * Every source value crosses C in a one-element Array, including primitives.
 * Empty carriers signal failure. No default inhabitant or recursive conversion
 * is required. Sequence conversion is bounded before exposing child carriers.
 *
 * @param abi - Closed copied-graph ABI, authenticated separately against IR.
 * @param exports - Compiler-selected source declarations and wrapper identities.
 * @param leanType - Renderer for semantic source type references.
 */
export const componentRecursiveLeanSource = (abi, exports, leanType) => {
	const types = componentRecursiveTypes(abi), definitions = new Map(abi.types.map(type => [type.id, type]));
	const sourceType = type => type.kind === "named" ? `_root_.${type.id.slice(5)}` : leanType(type);
	const carrier = type => `(_root_.Array ${sourceType(type)})`;
	const lines = [
		"def carrierValue {α : Type} (value : _root_.Array α) : _root_.Option α :="
		, "  if bound : 0 < value.size then"
		, "    if value.size == 1 then .some (value[0]'bound) else .none"
		, "  else .none", ""
		, "def carrierResult {α : Type} (value : _root_.Option α) : _root_.Array α :="
		, "  match value with | .none => #[] | .some result => #[result]", ""
		, "def carrierCollect {α : Type} (values : _root_.Array (_root_.Array α)) : _root_.Option (_root_.Array α) := Id.run do"
		, `  if values.size > ${componentRecursiveLimits.valueNodes} then return .none`
		, "  let mut result := #[]"
		, "  for value in values do"
		, "    match carrierValue value with"
		, "    | .none => return .none"
		, "    | .some item => result := result.push item"
		, "  return .some result", ""
		, "def carrierListItems {α : Type} (values : _root_.List α) : _root_.Array (_root_.Array α) :="
		, "  let rec loop : _root_.Nat → _root_.List α → _root_.Array (_root_.Array α) → _root_.Array (_root_.Array α)"
		, "    | 0, _, acc => acc"
		, "    | _, [], acc => acc"
		, "    | fuel + 1, head :: tail, acc => loop fuel tail (acc.push #[head])"
		, `  loop ${componentRecursiveLimits.valueNodes + 1} values #[]`, ""
	];
	const checked = (names, body) => ["carrierResult (do", ...names.map(name => `  let ${name} ← carrierValue ${name}`), ...body.map(line => `  ${line}`), ")"];
	for(const type of types.filter(type => type.kind !== "primitive"))
	{
		const symbol = componentRecursiveHelper(abi, type), hash = key(type);
		const emit = (name, parameters, result, body) => lines.push(`@[export ${symbol}_${name}]`, `def ${name}${hash} ${parameters} : ${result} :=`, ...body.map(line => `  ${line}`), "");
		const input = `(value : ${carrier(type)})`;
		const make = (name, children, body) => {
			const names = children.map((_, index) => `a${index}`);
			emit(name, children.map((child, index) => `(${names[index]} : ${carrier(child)})`).join(" ") || "(_bridgeUnit : _root_.Unit)"
				, carrier(type), checked(names, [`pure (${body})`]));
		};
		const field = (name, child, body) => emit(name, input, carrier(child), checked(["value"], body));
		const branch = cases => emit("branch", input, "_root_.UInt32", ["match carrierValue value with", "| .none => 4294967295", "| .some value =>", "  match value with", ...cases.map((pattern, index) => `  | ${pattern} => ${index}`)]);
		const definition = type.kind === "named" ? definitions.get(type.id) : null;
		if(definition?.kind === "alias")
		{
			make("make", [definition.target], "a0"); field("field0", definition.target, ["pure value"]);
			continue;
		}
		if(definition?.kind === "record")
		{
			make("make", definition.fields.map(field => field.type), `({ ${definition.fields.map((field, index) => `«${field.name}» := a${index}`).join(", ")} } : ${sourceType(type)})`);
			definition.fields.forEach((item, index) => field(`field${index}`, item.type, [`pure value.«${item.name}»`]));
			continue;
		}
		if(definition?.kind === "variant")
		{
			branch(definition.cases.map(item => `.«${item.name}» ${item.fields.map(() => "_").join(" ")}`));
			definition.cases.forEach((item, index) => {
				make(`make${index}`, item.fields.map(field => field.type), `.«${item.name}» ${item.fields.map((_, index) => `a${index}`).join(" ")}`);
				item.fields.forEach((child, fieldIndex) => field(`case${index}_field${fieldIndex}`, child.type, [
					"match value with"
					, `| .«${item.name}» ${item.fields.map((_, index) => index === fieldIndex ? "child" : "_").join(" ")} => pure child`
					, ...(definition.cases.length > 1 ? ["| _ => .none"] : [])
				]));
			});
			continue;
		}
		const children = type.arguments;
		if(["array", "list"].includes(type.constructor))
		{
			const array = type.constructor === "array";
			emit("make", `(values : _root_.Array ${carrier(children[0])})`, carrier(type), ["carrierResult (do", "  let values ← carrierCollect values", `  pure ${array ? "values" : "values.toList"}`, ")"]);
			emit("items", input, `(_root_.Array ${carrier(children[0])})`, [
				"match carrierValue value with", "| .none => #[]"
				, `| .some values => ${array ? `(values.extract 0 ${componentRecursiveLimits.valueNodes + 1}).map (fun child => #[child])` : "carrierListItems values"}`
			]);
			continue;
		}
		if(type.constructor === "tuple")
		{
			make("make", children, "(a0, a1)");
			children.forEach((child, index) => field(`field${index}`, child, [`pure value.${index ? "snd" : "fst"}`]));
			continue;
		}
		const option = type.constructor === "option", names = option ? ["none", "some"] : ["ok", "error"];
		branch([`.${names[0]}${option ? "" : " _"}`, `.${names[1]} _`]);
		if(option) make("none", [], ".none");
		children.forEach((child, index) => {
			const name = option ? "some" : names[index];
			make(`make${index}`, [child], `.${name} a0`);
			field(`field${index}`, child, ["match value with", `| .${name} child => pure child`, "| _ => .none"]);
		});
	}
	for(const item of exports)
	{
		const signature = abi.exports.find(value => value.bindingId === item.bindingId);
		if(!signature) throw new TypeError("Missing recursive export signature");
		const names = signature.parameters.map((_, index) => `a${index}`);
		const parameters = signature.parameters.map((type, index) => `(${names[index]} : ${carrier(type)})`).join(" ");
		const call = `${item.sourceApplication ? `(${item.sourceApplication})` : `_root_.${item.sourceDeclaration}`} ${names.join(" ")}`;
		lines.push(`@[export ${item.symbol}_lean]`, `def ${item.wrapper} ${parameters || "(_bridgeUnit : _root_.Unit)"} : ${carrier(signature.result)} :=`
			, ...checked(names, [`pure (${call})`]).map(line => `  ${line}`), "");
	}
	return lines;
};
