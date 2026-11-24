/** @file Generate the private Perl method table for a checked synchronous host import. */
import { validateBindingIr } from "../../binding-ir/contract.mjs";
import { hostMemberSymbol } from "../lean/host-object.mjs";
import { perlExportName, perlStringLiteral as lit, projectPerlNames } from "./naming.mjs";

const fail = why => { throw new TypeError("Perl host members: " + why); };
const id = /^[A-Za-z][A-Za-z0-9_]*$/u;
const primitives = new Set("unit bool char bytes string nat int usize isize float32 float64 uint8 uint16 uint32 uint64 int8 int16 int32 int64".split(" "));
const reserved = new Set(["destroy", "autoload", "clone", "clone_skip", "can", "isa", "does", "version"]);

/**
 * Member closures receive already converted scalar arguments. They dispatch
 * real Perl methods and check blessed referents without trusting an overridden
 * isa, can, stringification or boolean operation. Ownership stays in native
 * code; the slot table is not an application API.
 *
 * @param ir - Validated host import contract.
 * @param moduleName - Component's CPAN namespace.
 */
export const perlHostMembers = (ir, moduleName) => {
	validateBindingIr(ir); projectPerlNames(moduleName, []);
	const types = ir.types, names = types.map(t => t.name);
	if(!types.length || types.length > 64 || new Set(names).size !== types.length || types.some(t =>
		t.kind !== "resource" || !t.host?.targets.includes("perl") || t.host.dynamic || !id.test(t.name))) fail("expected statically declared Perl host classes");
	const kind = t => {
		if(t.kind === "primitive" && primitives.has(t.name)) return -1;
		const i = types.findIndex(r => r.id === t.id);
		if(t.kind !== "named" || i < 0) fail("unsupported member carrier");
		return i;
	};
	const used = new Map();
	const slots = ir.declarations.map(d => {
		const owner = types.findIndex(t => t.id === d.owner), self = ["method", "property"].includes(d.kind);
		if(owner < 0 || !id.test(d.name) || !["method", "property", "static-method", "constructor"].includes(d.kind)
			|| d.resultMode !== "value" || d.typeParameters.length || d.parameters.some(p => p.optional || p.default !== null)
			|| d.parameters.length > 63 || self !== Boolean(d.receiver) || (self && kind(d.receiver.type) !== owner)) fail("invalid synchronous member " + d.id);
		const selector = d.kind === "constructor" ? "new" : perlExportName(d.name);
		const sites = self ? [d.receiver, ...d.parameters] : d.parameters, args = sites.map(s => kind(s.type)), result = kind(d.result.type);
		const setter = d.kind === "property" && d.parameters.length !== 0;
		if(reserved.has(selector) || (selector === "new" && d.kind !== "constructor")
			|| (d.kind === "constructor" && result !== owner)
			|| (setter && (d.parameters.length !== 1 || d.result.type.name !== "unit"))) fail("invalid Perl selector or accessor " + d.id);
		const key = owner + ":" + selector, form = d.kind === "property" ? (setter ? "set" : "get") : d.kind;
		const previous = used.get(key) ?? new Set();
		if(previous.size && !(previous.size === 1 && ((form === "get" && previous.has("set")) || (form === "set" && previous.has("get")))))
			fail("ambiguous Perl selector " + selector);
		previous.add(form); used.set(key, previous);
		return { owner, self, selector, setter, args, result, sites, output: d.result, symbol: hostMemberSymbol("perl", types[owner], d) };
	});
	const required = [...used.keys()].map(k => { const [owner, selector] = k.split(":"); return "    die 'missing host method " + selector + "' unless UNIVERSAL::can($class[" + owner + "], " + lit(selector) + ");"; });
	const code = slots.map(m => {
		const check = m.args.flatMap((k, i) => k < 0 ? [] : ["        _object($_[" + i + "], $class[" + k + "]);"]);
		const receiver = m.self ? "$_[0]" : "$class[" + m.owner + "]";
		const params = m.args.map((_, i) => "$_[" + i + "]").slice(Number(m.self));
		const call = receiver + "->" + m.selector + "(" + params.join(", ") + ")";
		const arity = "        die 'wrong host method arity' unless @_ == " + m.args.length + ";";
		const deliver = m.setter ? call + "; return undef;" : m.result >= 0
			? "return _object(scalar(" + call + "), $class[" + m.result + "]);" : "return scalar(" + call + ");";
		return ["      sub {", arity, ...check, "        " + deliver, "      }"].join("\n");
	});
	const implementation = `package ${moduleName}::_HostMembers;
use strict;
use warnings;
use Scalar::Util ();
sub _object {
    die 'wrong nominal Perl host object' unless defined(Scalar::Util::blessed($_[0])) && UNIVERSAL::isa($_[0], $_[1]);
    return $_[0];
}
sub _bind {
    die 'expected one Perl host binding table' unless @_ == 1;
    my ($bindings) = @_;
    die 'expected named Perl host classes' unless ref($bindings) eq 'HASH' && keys(%{$bindings}) == ${types.length};
    my @class = map {
        my $class = $bindings->{$_};
        die 'invalid Perl host class' unless exists($bindings->{$_}) && defined($class) && !ref($class) && $class =~ /\\A[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*\\z/;
        $class
    } (${names.map(lit).join(", ")});
${required.join("\n")}
    return [
${code.join(",\n")}
    ];
}
1;
`;
	return { slots, implementation };
};
