/**
 * Validate author-owned package metadata and project it without inventing owners.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { cpanPackageLicense, isLicenseFilePath, parsePackageLicense } from "./package-license.mjs";

const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = message => { throw new TypeError(`Invalid package metadata: ${message}`); };
const closed = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
const text = (value, limit) => typeof value === "string" && value.length > 0 && value.trim() === value
	&& value.isWellFormed() && Buffer.byteLength(value) <= limit
	&& ![...value].some(char => char.codePointAt(0) < 32 || (char.codePointAt(0) >= 127 && char.codePointAt(0) <= 159) || [0x2028, 0x2029, 0xfffe, 0xffff].includes(char.codePointAt(0)));
const webUrl = value => {
	if(!text(value, 1024) || !/^https:\/\/[^/@\s\\?#]+(?:\/[^\s\\?#]*)?$(?![\s\S])/.test(value)) return false;
	try
	{
		const url = new URL(value);
		return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
	} catch
	{ return false; }
};

/**
 * Validate a shared declaration before any compiler or package generator runs.
 *
 * @param metadata - Validated shared package declaration.
 */
export const validatePackageMetadata = metadata => {
	if(!closed(metadata, ["description", "authors", "homepage", "repository", "license", "licenseFiles"])) fail("use description, authors, homepage, repository, license and licenseFiles");
	if(metadata.license !== undefined) parsePackageLicense(metadata.license);
	if(metadata.licenseFiles !== undefined && (!Array.isArray(metadata.licenseFiles) || !metadata.licenseFiles.length || metadata.licenseFiles.length > 32
		|| metadata.licenseFiles.some(path => !isLicenseFilePath(path)) || new Set(metadata.licenseFiles).size !== metadata.licenseFiles.length)) fail("licenseFiles must contain one to 32 unique, nonhidden relative file paths, without globs or build directories");
	if(metadata.description !== undefined && !text(metadata.description, 512)) fail("description must be a single line of at most 512 UTF-8 bytes");
	for(const field of ["homepage", "repository"])
		if(metadata[field] !== undefined && !webUrl(metadata[field])) fail(`${field} must be an HTTPS URL without credentials, query or fragment`);
	if(metadata.authors !== undefined)
	{
		if(!Array.isArray(metadata.authors) || !metadata.authors.length || metadata.authors.length > 32) fail("authors must contain one to 32 people or organizations");
		const seen = new Set();
		for(const author of metadata.authors)
		{
			if(!closed(author, ["name", "email", "url"]) || !text(author.name, 128)) fail("each author needs a name of at most 128 UTF-8 bytes");
			if(author.email !== undefined && (!text(author.email, 254)
				|| !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$(?![\s\S])/.test(author.email))) fail("author email must be a plain email address");
			if(author.url !== undefined && !webUrl(author.url)) fail("author url must be an HTTPS URL without credentials, query or fragment");
			const identity = canonicalJson(author);
			if(seen.has(identity)) fail("duplicate author");
			seen.add(identity);
		}
	}
	return metadata;
};

/**
 * Read metadata retained inside the compiled source identity, not a live project.
 *
 * @param sourceIdentity - Compiled source provenance.
 */
export const compiledPackageMetadata = sourceIdentity => validatePackageMetadata(
	sourceIdentity.exportConfigurationSource == null ? {} : JSON.parse(sourceIdentity.exportConfigurationSource).package ?? {});

/**
 * Bind the retained declaration to both source bytes and validated configuration.
 *
 * @param sourceIdentity - Compiled source provenance.
 * @param inputs - Verified root source inventory.
 */
export const verifyPackageMetadataSource = (sourceIdentity, inputs) => {
	const input = inputs.find(file => file.path === "lean-bridge.exports.json");
	const source = sourceIdentity.exportConfigurationSource;
	if(input ? typeof source !== "string" || !source.isWellFormed() || Buffer.byteLength(source) !== input.bytes || sha256(source) !== input.sha256 : source !== null)
		throw new Error("Package metadata declaration differs from captured source bytes");
	const configuration = source === null ? { schemaVersion: 1 } : JSON.parse(source);
	if(sha256(canonicalJson(configuration)) !== sourceIdentity.exportConfigurationSha256)
		throw new Error("Package metadata declaration differs from compiled configuration");
	return compiledPackageMetadata(sourceIdentity);
};

/**
 * Preserve all authors in npm's author/contributors representation.
 *
 * @param metadata - Validated shared package declaration.
 */
export const npmPackageMetadata = metadata => ({
	...(metadata.license ? { license: metadata.license } : {}),
	...(metadata.description ? { description: metadata.description } : {}),
	...(metadata.authors ? { author: metadata.authors[0], ...(metadata.authors.length > 1 ? { contributors: metadata.authors.slice(1) } : {}) } : {}),
	...(metadata.homepage ? { homepage: metadata.homepage } : {}),
	...(metadata.repository ? { repository: { type: "git", url: metadata.repository } } : {})
});

/**
 * Composer uses homepage for an author's URL and support.source for code links.
 *
 * @param metadata - Validated shared package declaration.
 */
export const composerPackageMetadata = metadata => ({
	...(metadata.license ? { license: metadata.license } : {}),
	...(metadata.description ? { description: metadata.description } : {}),
	...(metadata.authors ? { authors: metadata.authors.map(({ name, email, url }) => ({ name, ...(email ? { email } : {}), ...(url ? { homepage: url } : {}) })) } : {}),
	...(metadata.homepage ? { homepage: metadata.homepage } : {}),
	...(metadata.repository ? { support: { source: metadata.repository } } : {})
});

/**
 * Escape text and attribute values without allowing XML markup injection.
 *
 * @param value - Validated metadata string.
 */
export const metadataXml = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");

/**
 * A human-readable author field for Cargo and CPAN.
 *
 * @param author - Validated author object.
 */
export const metadataAuthor = author => `${author.name}${author.email ? ` <${author.email}>` : ""}`;

/**
 * TOML strings use JSON-compatible escapes for the admitted single-line text.
 *
 * @param metadata - Validated shared package declaration.
 */
export const cargoPackageMetadata = metadata => [
	...(metadata.description ? [`description = ${JSON.stringify(metadata.description)}`] : [])
	, ...(metadata.license ? [`license = ${JSON.stringify(metadata.license)}`] : [])
	, ...(metadata.authors ? [`authors = ${JSON.stringify(metadata.authors.map(metadataAuthor))}`] : [])
	, ...(["homepage", "repository"].filter(key => metadata[key]).map(key => `${key} = ${JSON.stringify(metadata[key])}`))
].join("\n");

/**
 * Python keeps plain author names separate from RFC-822 mailboxes.
 *
 * @param metadata - Validated shared package declaration.
 */
export const pythonPackageMetadata = metadata => [
	...(metadata.description ? [`Summary: ${metadata.description}`] : [])
	, ...(metadata.license ? [`License-Expression: ${metadata.license}`] : [])
	, ...(metadata.authors?.some(author => !author.email) ? [`Author: ${metadata.authors.filter(author => !author.email).map(author => author.name).join(", ")}`] : [])
	, ...(metadata.authors?.some(author => author.email) ? [`Author-email: ${metadata.authors.filter(author => author.email).map(author => `${JSON.stringify(author.name)} <${author.email}>`).join(", ")}`] : [])
	, ...(metadata.homepage ? [`Home-page: ${metadata.homepage}`] : [])
	, ...(metadata.repository ? [`Project-URL: Source, ${metadata.repository}`] : [])
].join("\n");

/**
 * NuGet's required authors and description never borrow runtime ownership.
 *
 * @param metadata - Validated shared package declaration.
 */
export const nugetPackageMetadata = metadata => `${metadata.license ? `<license type="expression">${metadataXml(metadata.license)}</license>` : ""}<authors>${metadataXml(metadata.authors?.map(author => author.name).join(", ") ?? "Author not declared")}</authors><description>${metadataXml(metadata.description ?? "Compiled Lean API with generated C# conversions and native runtime.")}</description>${metadata.homepage ? `<projectUrl>${metadataXml(metadata.homepage)}</projectUrl>` : ""}${metadata.repository ? `<repository type="git" url="${metadataXml(metadata.repository)}" />` : ""}`;

/**
 * Emit Maven developer and SCM metadata using escaped XML values.
 *
 * @param metadata - Validated shared package declaration.
 */
export const mavenPackageMetadata = metadata => `${metadata.license ? `<licenses><license><name>${metadataXml(metadata.license)}</name><distribution>repo</distribution></license></licenses>` : ""}<description>${metadataXml(metadata.description ?? "Compiled Lean API with generated Java conversions and native runtime.")}</description>${metadata.homepage ? `<url>${metadataXml(metadata.homepage)}</url>` : ""}${metadata.repository ? `<scm><url>${metadataXml(metadata.repository)}</url><connection>scm:git:${metadataXml(metadata.repository)}</connection></scm>` : ""}${metadata.authors ? `<developers>${metadata.authors.map(author => `<developer><name>${metadataXml(author.name)}</name>${author.email ? `<email>${metadataXml(author.email)}</email>` : ""}${author.url ? `<url>${metadataXml(author.url)}</url>` : ""}</developer>`).join("")}</developers>` : ""}`;

/**
 * CPAN author and resource fields belong to the component, not Lean Bridge.
 *
 * @param metadata - Validated shared package declaration.
 */
export const cpanPackageMetadata = metadata => ({
	...(metadata.license ? { license: [cpanPackageLicense(metadata.license)], x_spdx_expression: metadata.license } : {}),
	...(metadata.description ? { abstract: metadata.description } : {}),
	...(metadata.authors ? { author: metadata.authors.map(metadataAuthor) } : {}),
	...(metadata.homepage || metadata.repository ? { resources: {
		...(metadata.homepage ? { homepage: metadata.homepage } : {}),
		...(metadata.repository ? { repository: { type: "git", url: metadata.repository, web: metadata.repository } } : {})
	} } : {})
});
