/**
 * Enforce the documentation framework's Node baseline without narrowing consumer engines.
 *
 * @file
 */

const [major, minor] = process.versions.node.split(".").map(Number);
if(major < 22 || (major === 22 && minor < 22))
	throw new Error("The documentation site requires Node.js 22.22.0 or newer. CI uses 22.23.2.");
