/**
 * Admit ordinary PHP copied APIs without Alpha transport dispatch.
 *
 * @file
 */
import { compilePrimitiveCSurface } from "../c/primitive-surface.mjs";

const reserved = new Set("abstract and array as bool break callable case catch class clone const continue declare default die do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile enum eval exit extends false final finally float fn for foreach from function global goto if implements include include_once instanceof insteadof int interface isset iterable list match mixed namespace never new null object or parent print private protected public readonly require require_once resource return self static string switch throw trait true try unset use var void while xor yield bigint biginteger bytes leanbridgeerror internal this globals dispatch invoke".split(" "));
const primitives = { unit: "null", bool: "bool", uint8: "int", uint16: "int", uint32: "int", uint64: "BigInteger", int8: "int", int16: "int", int32: "int", int64: "int", nat: "BigInteger", int: "BigInteger", float32: "float", float64: "float", string: "string", bytes: "Bytes" };

/**
 * Require exact Composer coordinates, never silently rewrite author settings.
 *
 * @param settings - Optional package name and version.
 */
export const validateOrdinaryPhpSettings = (settings = {}) => {
	if(settings.name !== undefined && (settings.name.length > 100 || !/^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*\/[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/.test(settings.name))) throw new TypeError("Composer name must be a lowercase vendor/package coordinate of at most 100 characters");
	if(settings.version !== undefined && !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:alpha|beta|RC)\.(?:0|[1-9]\d*))?$/.test(settings.version)) throw new TypeError("Composer version must be an exact three-part version, optionally followed by -alpha.N, -beta.N or -RC.N");
};

/**
 * Bind source names and PHP types to the shared copied C surface.
 *
 * @param ir - Authoritative compiler-derived Binding IR.
 */
export const compileCopiedPhpModel = ir => {
	const surface = compilePrimitiveCSurface(ir);
	const namespace = `Lean${surface.prefix.split("_").map(word => word[0].toUpperCase() + word.slice(1)).join("")}`;
	const fail = (declaration, message) => {
		const source = declaration?.source?.extensions?.["lean-lang.org/source-position"];
		throw Object.assign(new TypeError(`${source ? `${source.path}:${source.startLine}:${source.startColumn}: ` : ""}${declaration?.id ?? ir.component.id}: ${message}`), { code: "unsupported-php-signature", details: { declaration: declaration?.id ?? null, source: source ?? null } });
	};
	const names = new Set(reserved);
	for(const copy of surface.copies)
	{
		if(copy.record)
		{
			copy.publicName = copy.record.name;
			if(names.has(copy.publicName.toLowerCase())) fail(ir.declarations[0], `PHP class name is reserved or duplicated: ${copy.publicName}`);
			names.add(copy.publicName.toLowerCase());
			for(const field of copy.fields) if(reserved.has(field.name.toLowerCase())) fail(ir.declarations[0], `PHP field name is reserved: ${field.name}`);
		}
		copy.publicType = copy.record ? copy.publicName : copy.element ? "array" : primitives[copy.ref.name];
		copy.docType = copy.element ? `list<${copy.element.docType}>` : copy.publicType;
		copy.ctype = copy.aggregate ? copy.name : copy.ref.name === "unit" ? "uint8_t" : copy.name;
	}
	for(const fn of surface.functions)
	{
		if(names.has(fn.field.toLowerCase())) fail(fn.declaration, `PHP function name is reserved or duplicated: ${fn.field}`);
		names.add(fn.field.toLowerCase());
		for(const parameter of fn.parameters) if(reserved.has(parameter.name.toLowerCase())) fail(fn.declaration, `PHP parameter name is reserved: ${parameter.name}`);
	}
	return { ir, surface, namespace };
};
