/**
 * Preserve copied Lean alias contracts beside ordinary Perl target values.
 *
 * @file
 */

/**
 * Find an original type definition in compiler-authenticated IR.
 *
 * @param model - Checked Perl model.
 * @param id - Stable IR type identity.
 */
const definition = (model, id) => {
	const type = model.bindingIr.types.find(type => type.id === id);
	if(!type) throw new TypeError(`missing Perl alias contract type: ${id}`);
	return type;
};
const contractType = (model, ref) => ref.kind === "primitive" ? ref.name
	: ref.kind === "named" ? definition(model, ref.id).name
		: `${ref.constructor}<${ref.arguments.map(argument => contractType(model, argument)).join(", ")}>`;
const pod = value => value.replace(/[\r\n]/g, " ").replace(/[&<>]/g, character => ({ "&": "E<amp>", "<": "E<lt>", ">": "E<gt>" }[character]));
const code = value => `C<${pod(value)}>`;
const perlType = (model, ref, seen = new Set()) => {
	if(ref.kind === "primitive") return ({ unit: "undef", bool: "true() | false()"
		, nat: "Math::BigInt (nonnegative)", int: "Math::BigInt"
		, float32: "numeric scalar", float64: "numeric scalar", string: "text scalar"
		, bytes: "octet string", char: "single-scalar text" }[ref.name]
		?? (/^(uint|usize)/.test(ref.name) ? "unsigned integer scalar" : "signed integer scalar"));
	if(ref.kind === "named")
	{
		const type = definition(model, ref.id);
		if(seen.has(type.id) || seen.size > 32) throw new TypeError("cyclic or deeply nested Perl alias contract");
		if(type.kind === "alias") return perlType(model, type.target, new Set([...seen, type.id]));
		if(!["record", "variant"].includes(type.kind)) throw new TypeError("Perl aliases require copied target values");
		const native = model.types.find(item => item.kind === type.kind && item.name === type.source.declaration);
		if(!native) throw new TypeError(`missing native Perl ${type.kind}: ${type.name}`);
		return `${model.moduleName}::${native.name.split(".").at(-1)}`;
	}
	const children = ref.arguments.map(argument => perlType(model, argument, seen));
	if(["array", "list"].includes(ref.constructor)) return `array reference<${children[0]}>`;
	if(ref.constructor === "option") return `undef | Some<${children[0]}>`;
	if(ref.constructor === "result") return `Ok<${children[0]}> | Err<${children[1]}>`;
	if(ref.constructor === "tuple") return `[${children.join(", ")}]`;
	throw new TypeError("unsupported Perl alias target");
};

/**
 * Preserve each alias name, original target and transparent Perl representation.
 *
 * @param model - Compiler-checked native Perl model.
 */
export const perlCopiedAliases = model => model.bindingIr.types.filter(type => type.kind === "alias").map(type => ({
	id: type.id, name: type.name, target: type.target
	, perlType: perlType(model, type.target)
}));

/**
 * Document original parameter and result types at their public function sites.
 *
 * @param model - Compiler-checked native Perl model.
 * @param item - Native export with its source identity.
 */
export const perlAliasApiDocs = (model, item) => {
	const declaration = model.bindingIr.declarations.find(d => d.id === `lean:${item.name}`);
	if(!declaration) throw new TypeError(`missing Perl alias declaration: ${item.name}`);
	return [...declaration.parameters.map(p => `Parameter ${code(p.name)}: ${code(contractType(model, p.type))}.`)
		, `Returns ${code(contractType(model, declaration.result.type))}.`].join(" ");
};

/**
 * Describe alias targets and record fields without adding Perl packages or wrappers.
 *
 * @param model - Compiler-checked native Perl model.
 * @param aliases - Admitted alias catalog.
 * @param structuredCallables - Whether this package exposes copied callback payloads.
 */
export const perlAliasPod = (model, aliases, structuredCallables = false) => [
	"=head1 COPIED ALIASES", ""
	, "Alias names, original targets and chains remain in the binding manifest and this POD. Call with ordinary Perl target values; aliases do not create separate packages or wrapper classes. Nat requires a nonnegative Math::BigInt; Int accepts negative values. Fixed-width and machine-word integers retain their ranges. Char requires one Unicode scalar. Unit uses undef. Copied payloads own independent storage. Existing copy budgets, schema depth and ownership checks apply. " + (structuredCallables ? "Copied alias targets work in callback and closure payloads. Recursive callback payloads and identity-bearing alias targets remain unsupported." : "Recursive copies, compound callables and identity-bearing alias targets remain unsupported.")
	, "", "=over 4", ""
	, ...aliases.flatMap(alias => [`=item ${code(alias.name)}`, "", `Contract: ${code(contractType(model, alias.target))}. Perl value: ${code(alias.perlType)}.`, ""])
	, "=back", "", "=head1 RECORD FIELD CONTRACTS", ""
	, "=over 4", ""
	, ...model.bindingIr.types.filter(type => type.kind === "record").flatMap(type => type.fields.flatMap(field => [
		`=item ${code(`${type.name}.${field.name}`)}`, ""
		, `Contract: ${code(contractType(model, field.type))}.`, ""
	]))
	, "=back", ""];
