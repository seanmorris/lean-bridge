/**
 * Separate PHP class keywords from case-sensitive constructor variables.
 *
 * @file
 */
const keywords = new Set("__halt_compiler abstract and array as bool break callable case catch class clone const continue declare default die do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile enum eval exit extends false final finally float fn for foreach from function global goto if implements include include_once instanceof insteadof int interface isset iterable list match mixed namespace never new null object or parent print private protected public readonly require require_once resource return self static string switch throw trait true try unset use var void while xor yield".split(" "));
export const reservedPhpNames = new Set([...keywords, ..."bigint biginteger bytes leanbridgeerror leanclosure internal this globals dispatch invoke".split(" ")]);
const forbiddenFields = new Set(["this", "GLOBALS", "_SERVER", "_GET", "_POST", "_FILES", "_COOKIE", "_SESSION", "_REQUEST", "_ENV", "__lbBudget"]);

/**
 * Escape keyword class names; registration separately rejects collisions.
 *
 * @param name - Original Lean type name.
 */
export const phpClassName = name => keywords.has(name.toLowerCase()) ? `${name}_` : name;

/**
 * Preserve a source property name used by the generated named constructor.
 *
 * @param name - Original Lean field name, not a private C member.
 * @param fail - Source-aware diagnostic callback.
 */
export const phpFieldName = (name, fail) => {
	if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || forbiddenFields.has(name)) fail(`PHP field is reserved or invalid: ${name}`);
	return name;
};
