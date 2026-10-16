/**
 * Finite Perl classes for recursive copied values. Native conversion and
 * installed CPAN acceptance are separate stages.
 *
 * @file
 */
import { compileCopiedCGraphLayout } from "../c/copied-graph-layout.mjs";
import { projectPerlNames } from "./naming.mjs";

const reserved = new Set("new DESTROY CLONE CLONE_SKIP can isa DOES VERSION import unimport AUTOLOAD BEGIN UNITCHECK CHECK INIT END".split(" "));
const identifier = value => /^[A-Za-z][A-Za-z0-9_]*$/.test(value);
const primitive = {
	unit: "undef", bool: "true() | false()"
	, nat: "Math::BigInt (nonnegative)", int: "Math::BigInt"
	, string: "text scalar", bytes: "octet string", char: "single-scalar text"
	, float32: "numeric scalar", float64: "numeric scalar"
	, uint8: "unsigned integer scalar", uint16: "unsigned integer scalar"
	, uint32: "unsigned integer scalar", uint64: "unsigned integer scalar"
	, usize: "unsigned integer scalar"
	, int8: "signed integer scalar", int16: "signed integer scalar"
	, int32: "signed integer scalar", int64: "signed integer scalar"
	, isize: "signed integer scalar"
};

// Qualify builtins so fields such as keys, ref and bless remain ordinary methods.
const record = (name, fields, parent = null) => `package ${name};
${parent ? `our @ISA = ('${parent}');\n` : ""}sub new {
  CORE::die "${name}->new expects named fields\\n" unless @_ % 2 == 1 && CORE::defined($_[0]) && !CORE::ref($_[0]) && $_[0] eq '${name}';
  CORE::shift; my %fields;
  while (@_) {
    my ($key, $value) = CORE::splice @_, 0, 2;
    CORE::die "invalid field name\\n" if !CORE::defined($key) || CORE::ref($key);
${parent ? '    CORE::die "duplicate constructor field\\n" if CORE::exists($fields{$key});\n' : ""}    $fields{$key} = $value;
  }
  my @required = qw(${fields.map(field => field.publicName).join(" ")});
  CORE::die "fields do not match the generated schema\\n" if CORE::keys(%fields) != @required || CORE::grep { !CORE::exists($fields{$_}) } @required;
  return CORE::bless \\%fields, '${name}';
}
${fields.map(field => `# ${field.publicName}: ${field.contractType}\nsub ${field.publicName} { $_[0]->{${field.publicName}} }`).join("\n")}
`;

/**
 * Retain nominal edges and transparent alias names without unfolding recursion.
 * Classes preserve Perl's existing mutable named-field construction; copied
 * payloads will be checked by the native call boundary, not constructors.
 *
 * @param ir - Concrete, pure copied Binding IR.
 * @param moduleName - Selected CPAN module namespace.
 */
export const generateCopiedPerlGraphValues = (ir, moduleName) => {
	const layout = compileCopiedCGraphLayout(ir);
	const definitions = new Map([...ir.types].sort((a, b) => a.id.localeCompare(b.id)).map(type => [type.id, type]));
	const functions = projectPerlNames(moduleName, ir.declarations.map(declaration => ({ ...declaration, name: declaration.source.declaration })));
	for(const fn of functions) if(!/^[a-z][a-z0-9_]*$/.test(fn.publicName) || reserved.has(fn.publicName))
		throw new TypeError(`Reserved or invalid Perl graph function: ${fn.publicName}`);
	const occupied = new Set(["Some", "Ok", "Err", "Runtime"]), names = new Map();
	for(const type of definitions.values())
	{
		if(!identifier(type.name) || occupied.has(type.name)) throw new TypeError(`Invalid or reserved Perl graph type: ${type.name}`);
		occupied.add(type.name); names.set(type.id, `${moduleName}::${type.name}`);
	}
	const contract = ref => ref.kind === "primitive" ? ref.name : ref.kind === "named" ? definitions.get(ref.id).name
		: `${ref.constructor}<${ref.arguments.map(contract).join(", ")}>`;
	const members = (fields, source) => fields.map((field, index) => {
		const publicName = field.sourceName;
		if(!identifier(publicName) || reserved.has(publicName)) throw new TypeError(`Reserved or invalid Perl graph field: ${publicName}`);
		return { ...field, publicName, contractType: contract(source[index].type) };
	});
	const types = layout.nodes.map(node => {
		const definition = node.ref.kind === "named" ? definitions.get(node.ref.id) : null;
		const publicType = definition ? names.get(definition.id) : node.kind === "primitive" ? primitive[node.ref.name]
			: ["array", "list", "tuple"].includes(node.kind) ? "array reference" : node.kind === "option" ? "undef | Some" : "Ok | Err";
		const constructors = new Set();
		return { ...node, publicType
			, fields: node.kind === "record" ? members(node.fields, definition.fields) : node.fields
			, cases: node.cases.map(branch => {
				const name = branch.sourceName[0].toUpperCase() + branch.sourceName.slice(1);
				if(!identifier(name) || reserved.has(name) || constructors.has(name)) throw new TypeError(`Invalid or reserved Perl graph constructor: ${name}`);
				constructors.add(name);
				return { ...branch, publicName: `${publicType}::${name}`
					, fields: members(branch.fields, definition.cases.find(item => item.name === branch.sourceName).fields) };
			})
		};
	});
	const wrappers = [...types.some(type => type.kind === "option") ? ["Some"] : []
		, ...types.some(type => type.kind === "result") ? ["Ok", "Err"] : []];
	const aliases = [...definitions.values()].filter(type => type.kind === "alias").map(type => {
		const target = types.find(node => node.id === layout.aliases.find(alias => alias.id === type.id).target);
		return { id: type.id, name: type.name, target: type.target, contractType: contract(type.target), perlType: target.publicType };
	});
	const nominal = types.filter(type => ["record", "variant"].includes(type.kind));
	const source = `package ${moduleName};
use strict;
use warnings;
use Math::BigInt;
# Finite declarations only. Conversion performs payload validation at calls.
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
${nominal.map(type => type.kind === "record" ? record(type.publicType, type.fields) : `package ${type.publicType};
sub new { CORE::die "select a named variant constructor\\n" }
${type.cases.map(branch => record(branch.publicName, branch.fields, type.publicType)).join("\n")}`).join("\n")}
1;
`;
	return { layout, types, functions, aliases, source, moduleName };
};
