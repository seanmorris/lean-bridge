/**
 * Apply Perl-only namespace and export names after semantic lowering.
 *
 * @file
 */

/**
 * Convert a source export's leaf name to Perl's generated function spelling.
 *
 * @param value - Source declaration leaf name.
 */
export const perlExportName = value => value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

/**
 * Quote source data without Perl interpolation or JSON escape semantics.
 *
 * @param value - Literal string to preserve in generated Perl source.
 */
export const perlStringLiteral = value => `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

/**
 * Validate one Perl projection without changing the canonical source declarations.
 *
 * @param moduleName - Selected CPAN module namespace.
 * @param declarations - Checked native source declarations.
 */
export const projectPerlNames = (moduleName, declarations) => {
	if(!/^LeanBridge::[A-Za-z][A-Za-z0-9_]*(?:::[A-Za-z][A-Za-z0-9_]*)*$/.test(moduleName) || /^LeanBridge::Runtime(?:::|$)/.test(moduleName))
		throw new TypeError("native-library-v1: invalid or reserved Perl module name");
	const names = new Set(["true", "false", "close", "closed", "DESTROY", "CLONE", "CLONE_SKIP"]);
	return declarations.map(declaration => {
		const publicName = perlExportName(declaration.name.split(".").at(-1));
		if(names.has(publicName)) throw new TypeError(`native-library-v1: Perl name collision: ${publicName}`);
		names.add(publicName);
		return { ...declaration, publicName };
	});
};
