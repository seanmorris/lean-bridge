/**
 * Finite Perl declarations for resource-bearing values and closure signatures.
 *
 * @file
 */
import { generateOwnedCValues } from "../c/owned-values.mjs";
import { projectPerlNames, perlStringLiteral } from "./naming.mjs";
import { ownedPerlBorrowClasses } from "./owned-borrows.mjs";
import { ownedPerlReceiverClasses } from "./owned-receivers.mjs";

const reserved = new Set("new DESTROY CLONE CLONE_SKIP can isa DOES VERSION import unimport AUTOLOAD BEGIN UNITCHECK CHECK INIT END STORABLE_freeze STORABLE_thaw".split(" "));
const identifier = name => typeof name === "string" && /^[A-Za-z][A-Za-z0-9_]*$/u.test(name);
const primitives = {
	unit: "undef", bool: "true() | false()", char: "single-scalar text"
	, string: "text scalar", bytes: "octet string"
	, nat: "Math::BigInt (nonnegative)", int: "Math::BigInt"
	, uint8: "unsigned integer scalar", uint16: "unsigned integer scalar"
	, uint32: "unsigned integer scalar", uint64: "unsigned integer scalar"
	, int8: "signed integer scalar", int16: "signed integer scalar"
	, int32: "signed integer scalar", int64: "signed integer scalar"
	, usize: "unsigned integer scalar", isize: "signed integer scalar"
	, float32: "numeric scalar", float64: "numeric scalar"
};

const valueClass = (name, fields, parent = null) => `package ${name};
${parent ? `our @ISA = (${perlStringLiteral(parent)});\n` : ""}sub new {
  CORE::die "${name}->new expects named fields\\n" unless @_ % 2 == 1 && CORE::defined($_[0]) && !CORE::ref($_[0]) && $_[0] eq ${perlStringLiteral(name)};
  CORE::shift; my %fields;
  while (@_) {
    my ($key, $value) = CORE::splice @_, 0, 2;
    CORE::die "invalid field name\\n" if !CORE::defined($key) || CORE::ref($key);
    CORE::die "duplicate constructor field\\n" if CORE::exists($fields{$key});
    $fields{$key} = $value;
  }
  my @required = qw(${fields.map(field => field.publicName).join(" ")});
  CORE::die "fields do not match the generated schema\\n" if CORE::keys(%fields) != @required || CORE::grep { !CORE::exists($fields{$_}) } @required;
  return CORE::bless \\%fields, ${perlStringLiteral(name)};
}
${fields.map(field => `# ${field.publicName}: ${field.contractType}\nsub ${field.publicName} { $_[0]->{${field.publicName}} }`).join("\n")}
`;

/**
 * Keep nominal recursion finite and alias/container representations transparent.
 * These declarations do not enable native transport or installed CPAN admission.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 * @param moduleName - Validated public CPAN namespace.
 * @param options - Explicit transport capabilities.
 * @param options.transferredInputs - Enable consuming parameters.
 * @param options.anchoredResults - Keep whole owners for borrowed results.
 * @param options.receiverExports - Preserve receiver methods and properties.
 * @param options.hostCallbacks - Enable callback/copy transport independently.
 */
export const generateOwnedPerlValues = (ir, moduleName, { transferredInputs = false, anchoredResults = false, receiverExports = false, hostCallbacks = true } = {}) => {
	const c = generateOwnedCValues(ir, { hostCallbacks, transferredInputs, anchoredResults, receiverExports });
	const receivers = c.functions.some(fn => fn.receiver === 0);
	const anchored = c.anchoredResults === true || receivers;
	const definitions = new Map(ir.types.map(type => [type.id, type]));
	const projected = projectPerlNames(moduleName, ir.declarations.map(declaration => ({
		...declaration, name: declaration.source.declaration
	})));
	const functions = c.functions.map(fn => {
		const publicName = projected.find(item => item.id === fn.id)?.publicName;
		if(!identifier(publicName) || reserved.has(publicName) || (anchored && publicName === "copy_value"))
			throw new TypeError(`Invalid or reserved owned Perl function: ${publicName}`);
		return { ...fn, publicName };
	});
	const occupied = new Set(["Some", "Ok", "Err", "Owned", "Runtime"]), names = new Map();
	if(anchored) occupied.add("Value");
	const claim = name => {
		if(!identifier(name) || reserved.has(name) || occupied.has(name))
			throw new TypeError(`Invalid, reserved or duplicated owned Perl type: ${name}`);
		occupied.add(name);
		return `${moduleName}::${name}`;
	};
	for(const node of c.nodes) if(node.kind !== "primitive" && node.name)
		names.set(node.id, claim(node.name));
	for(const alias of c.native.aliases) claim(definitions.get(alias.id).name);
	const contract = ref => ref.kind === "primitive" ? ref.name : ref.kind === "named"
		? definitions.get(ref.id).name
		: `${ref.constructor}<${ref.arguments.map(contract).join(", ")}>`;
	const members = (fields, original) => {
		const seen = new Set();
		return fields.map((field, index) => {
			const publicName = field.sourceName;
			if(!identifier(publicName) || reserved.has(publicName) || seen.has(publicName))
				throw new TypeError(`Invalid, reserved or duplicated owned Perl field: ${publicName}`);
			seen.add(publicName);
			return { ...field, publicName, contractType: contract(original[index].type) };
		});
	};
	const types = c.nodes.map((node, index) => {
		const definition = definitions.get(node.id), constructors = new Set();
		const publicType = node.kind === "primitive" ? primitives[node.name] : names.get(node.id)
			?? (node.element || node.kind === "tuple" ? "array reference"
				: node.kind === "option" ? "undef | Some" : "Ok | Err");
		return { ...node, index, publicType
			, ...receivers && ["resource", "record", "variant"].includes(node.kind) && node.representation !== "copied"
				? { ownerType: claim(node.name + "Value") } : {}
			, fields: node.kind === "record" ? members(node.fields, definition.fields) : node.fields
			, cases: node.cases.map(branch => {
				const name = branch.sourceName[0].toUpperCase() + branch.sourceName.slice(1);
				if(!identifier(name) || reserved.has(name) || constructors.has(name))
					throw new TypeError(`Invalid or duplicated owned Perl constructor: ${name}`);
				constructors.add(name);
				return { ...branch, publicName: `${publicType}::${name}`
					, fields: members(branch.fields, definition.cases.find(item => item.name === branch.sourceName).fields) };
			})
		};
	});
	const table = new Map(types.map(node => [node.id, node]));
	const aliases = c.native.aliases.map(alias => ({
		...alias, name: definitions.get(alias.id).name
		, contractType: contract(definitions.get(alias.id).target)
		, perlType: table.get(alias.target).publicType
	}));
	const wrappers = [...types.some(node => node.kind === "option") ? ["Some"] : []
		, ...types.some(node => node.kind === "result") ? ["Ok", "Err"] : []];
	const nominal = types.filter(node => names.has(node.id));
	const declarations = nominal.map(node => {
		if(node.identity) return `package ${node.publicType};
sub new { CORE::die "Resources and closures are returned by Lean functions\\n" }
sub CLONE_SKIP { 1 }
sub STORABLE_freeze { CORE::die "Lean identities cannot be serialized\\n" }
sub STORABLE_thaw { CORE::die "Lean identities cannot be deserialized\\n" }
`;
		return node.kind === "record" ? valueClass(node.publicType, node.fields)
			: `package ${node.publicType};
sub new { CORE::die "select a named variant constructor\\n" }
${node.cases.map(branch => valueClass(branch.publicName, branch.fields, node.publicType)).join("\n")}`;
	});
	const source = `package ${moduleName};
use strict;
use warnings;
use Math::BigInt;
# Fields are validated and snapshotted at the native call boundary.
# Resource and closure identities are created and checked by the XS adapter.
${aliases.map(alias => `# ${alias.name} = ${alias.contractType}; Perl: ${alias.perlType}`).join("\n")}
sub true () { !!1 }
sub false () { !!0 }
${wrappers.map(name => `package ${moduleName}::${name};
sub new {
  CORE::die "${name}->new expects one payload\\n" unless @_ == 2 && CORE::defined($_[0]) && !CORE::ref($_[0]) && $_[0] eq '${moduleName}::${name}';
  return CORE::bless {value => $_[1]}, '${moduleName}::${name}';
}
sub value { $_[0]->{value} }
`).join("\n")}
${declarations.join("\n")}
${anchored ? ownedPerlBorrowClasses(moduleName, types, functions, ir) : ""}\
${receivers ? ownedPerlReceiverClasses(moduleName, types, functions) : ""}\
1;
`;
	return { c, moduleName, types, functions, aliases, source
		, wholeOwners: anchored, receiverExports: receivers, hostCallbacks
		, publicTypes: [...anchored ? [`${moduleName}::Value`] : []
			, ...types.filter(node => node.ownerType).map(node => node.ownerType)
			, ...wrappers.map(name => `${moduleName}::${name}`)
			, ...nominal.flatMap(node => [node.publicType, ...node.cases.map(branch => branch.publicName)])] };
};
