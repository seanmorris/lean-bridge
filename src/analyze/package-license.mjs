/**
 * Parse bounded SPDX declarations offline against the pinned license list.
 *
 * @file
 */
import spdx from "./spdx-data.json" with { type: "json" };

const licenses = new Set(spdx.licenses), exceptions = new Set(spdx.exceptions);
const fail = () => { throw new TypeError("Invalid package license: use a listed SPDX 3.28 identifier or expression with AND, OR, WITH and parentheses (maximum 512 ASCII characters, 32 nested groups); deprecated identifiers and LicenseRef are not supported"); };

/**
 * Preserve operator precedence without rewriting the publisher's expression.
 *
 * @param value - Author-declared SPDX expression.
 */
export const parsePackageLicense = value => {
	if(typeof value !== "string" || !value.length || value.length > 512 || value.trim() !== value || /[^A-Za-z0-9.()+ -]/.test(value)) fail();
	const matches = [...value.matchAll(/[A-Za-z0-9.-]+\+?|[()]|[^ ]+/g)];
	for(const match of matches)
	{
		const boundary = match[0] === "WITH" ? /^ $/ : /^[ ()]$/;
		if(["WITH", "AND", "OR"].includes(match[0]) && (!boundary.test(value[match.index - 1] ?? "") || !boundary.test(value[match.index + match[0].length] ?? ""))) fail();
	}
	const tokens = matches.map(match => match[0]);
	let index = 0;
	const primary = depth => {
		if(depth > 32) fail();
		if(tokens[index] === "(")
		{
			index++;
			const node = expression(depth + 1);
			if(tokens[index++] !== ")") fail();
			return node;
		}
		const token = tokens[index++] ?? "", later = token.endsWith("+");
		const license = later ? token.slice(0, -1) : token;
		if(!licenses.has(license)) fail();
		let exception;
		if(tokens[index] === "WITH")
		{
			index++;
			exception = tokens[index++];
			if(!exceptions.has(exception)) fail();
		}
		return { license, later, ...(exception ? { exception } : {}) };
	};
	const conjunction = depth => {
		let node = primary(depth);
		while(tokens[index] === "AND")
		{ index++; node = { operator: "AND", left: node, right: primary(depth) }; }
		return node;
	};
	const expression = depth => {
		let node = conjunction(depth);
		while(tokens[index] === "OR")
		{ index++; node = { operator: "OR", left: node, right: conjunction(depth) }; }
		return node;
	};
	const result = expression(0);
	if(index !== tokens.length) fail();
	return result;
};

/**
 * Exact relative paths only; never opt build trees, hidden files or globs in.
 *
 * @param path - Declared license-file path relative to its owning Lean package.
 */
export const isLicenseFilePath = path => typeof path === "string" && path.length <= 512
	&& path.split("/").length <= 16
	&& path.split("/").every(part => /^[A-Za-z0-9_-][A-Za-z0-9._ -]*$(?![\s\S])/.test(part)
		&& part.trim() === part && !part.endsWith(".")
		&& !["build", "dist", "target", "node_modules", "vendor", "result"].includes(part));

/**
 * Keep the existing npm fallback, but reject conflicting explicit declarations.
 *
 * @param metadata - Shared author declaration.
 * @param npm - Original source package.json, when present.
 */
export const componentLicense = (metadata, npm = {}) => {
	const fallback = typeof npm.license === "string" && npm.license.trim() ? npm.license : undefined;
	if(metadata.license && fallback && metadata.license !== fallback) throw new Error("Package license conflicts with source package.json; use the same expression in both declarations");
	return metadata.license ?? fallback ?? "UNLICENSED";
};

/**
 * Ruby's license field has no Boolean semantics; keep those in metadata.
 *
 * @param value - Optional validated expression.
 */
export const rubyPackageLicense = value => {
	if(!value) return "Nonstandard";
	const node = parsePackageLicense(value);
	const single = node.operator ? null : `${node.license}${node.later ? "+" : ""}${node.exception ? ` WITH ${node.exception}` : ""}`;
	return single && single.length <= 64 ? single : "Nonstandard";
};

/**
 * CPAN's vocabulary is narrower than SPDX; only use unambiguous exact mappings.
 *
 * @param value - Optional validated expression.
 */
export const cpanPackageLicense = value => ({
	"MIT": "mit", "Apache-1.1": "apache_1_1", "Apache-2.0": "apache_2_0"
	, "Artistic-1.0": "artistic_1", "Artistic-2.0": "artistic_2"
	, "BSD-3-Clause": "bsd", "MPL-1.0": "mozilla_1_0", "MPL-1.1": "mozilla_1_1"
	, "OpenSSL": "openssl", "QPL-1.0": "qpl_1_0", "Zlib": "zlib"
}[value] ?? "unknown");
