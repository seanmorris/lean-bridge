/**
 * Public Perl receiver members over original checked whole-value owners.
 *
 * @file
 */
import { perlStringLiteral as q } from "./naming.mjs";

const reserved = new Set("new get close closed share retain call same_identity can isa DOES VERSION import unimport AUTOLOAD DESTROY CLONE CLONE_SKIP BEGIN UNITCHECK CHECK INIT END STORABLE_freeze STORABLE_thaw".split(" "));

/**
 * Forward a member through its authenticated export without shifting anchors.
 *
 * @param moduleName - Validated public module namespace.
 * @param node - Receiver's nominal resource or aggregate type.
 * @param functions - Lowered exports with original receiver/argument slots.
 * @param raw - Expose only members that need no receiver owner slot.
 */
const members = (moduleName, node, functions, raw) => {
	const claimed = new Set(reserved), result = [];
	for(const fn of functions)
	{
		if(fn.receiver !== 0 || fn.parameters[0] !== node.id) continue;
		if(claimed.has(fn.publicName)) throw new TypeError(`Reserved or duplicate Perl receiver member: ${node.publicType}::${fn.publicName}`);
		claimed.add(fn.publicName);
		const original = fn.anchor === 0 || fn.transfers?.includes(0);
		if(raw && original) continue;
		result.push(`sub ${fn.publicName} {
  my $self = CORE::shift;
  return ${moduleName}::${fn.publicName}(${raw || original ? "$self" : "$self->get"}, @_);
}
`);
	}
	return result.join("");
};

/**
 * Owner subclasses retain nominal methods across share, retain and copy_value.
 *
 * @param moduleName - Validated Perl module namespace.
 * @param types - Generated public value families.
 * @param functions - Receiver and ordinary exports.
 */
export const ownedPerlReceiverClasses = (moduleName, types, functions) => types
	.filter(node => node.ownerType).map(node => `package ${node.ownerType};
our @ISA = (${q(moduleName + "::Value")});
${members(moduleName, node, functions, false)}${node.identity ? `package ${node.publicType};
${members(moduleName, node, functions, true)}` : ""}`).join("\n");
