/**
 * Retain source-library notices separately from bridge and runtime licenses.
 *
 * @file
 */
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";

const manifestPath = "source-notices.json";
const digest = value => typeof value === "string" && value.length === 64 && /^[a-f0-9]+$/.test(value);
const safePath = value => typeof value === "string" && value.length > 0
	&& !/[\\:]/.test(value) && ![...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
	&& value.split("/").every(part => part && part !== "." && part !== "..");
const closed = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
	&& Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const payloadPath = hash => `source-notices/${hash}.txt`;
const same = (a, b) => canonicalJson(a) === canonicalJson(b);

/**
 * Recognize conventional notice files and REUSE-style LICENSES directories.
 *
 * @param path - Package-relative source path.
 */
export const isSourceNotice = path => safePath(path) && (path.split("/").slice(0, -1).some(part => /^licenses$/i.test(part))
	|| (!/\.(?:lean|mjs|js|ts|c|h|rs|py|rb|java|cs|php)$/i.test(path) && /^(?:licen[cs]es?|notices?|copying|copyright)(?:[._-].+)?$/i.test(path.split("/").at(-1))))
	&& !path.split("/").some(part => part.startsWith("."));

/**
 * Recognize license-file locations without treating attribution alone as terms.
 *
 * @param path - Package-relative source path.
 */
export const isSourceLicense = path => isSourceNotice(path) && !/^(?:notices?|copyright)(?:[._-].+)?$/i.test(path.split("/").at(-1))
	&& (path.split("/").slice(0, -1).some(part => /^licenses$/i.test(part))
	|| /^(?:licen[cs]es?|copying)(?:[._-].+)?$/i.test(path.split("/").at(-1)));

const regularBytes = async path => {
	if(!(await lstat(path)).isFile() || await realpath(path) !== resolve(path)) throw new Error("Source notices must be regular files without symlinks");
	return readFile(path);
};

/**
 * Capture notices from the same inventoried inputs used for compilation.
 *
 * @param options - Root inventory and optional immutable Lake snapshot.
 * @param options.projectRoot - Original project for lock-free source builds.
 * @param options.projectName - Root library name, not a bridge package name.
 * @param options.inputs - Analyzed root source identities.
 * @param options.sourceTreeSha256 - Analyzed root tree identity.
 * @param options.snapshot - Captured Lake dependencies, when present.
 * @param options.snapshotRoot - Verified, materialized snapshot directory.
 */
export const captureSourceNotices = async ({ projectRoot, projectName, inputs, sourceTreeSha256, snapshot, snapshotRoot }) => {
	const payloads = new Map(), packages = [];
	const capture = async (name, source, files, root) => {
		const notices = [];
		for(const file of files.filter(file => isSourceNotice(file.path)).sort((a, b) => a.path < b.path ? -1 : 1))
		{
			const bytes = await regularBytes(join(root, file.path));
			if(bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error(`Source notice changed after capture: ${file.path}`);
			const payload = payloadPath(file.sha256);
			payloads.set(payload, bytes);
			notices.push({ path: file.path, bytes: file.bytes, sha256: file.sha256, payload });
		}
		packages.push({ name, source, notices });
	};
	await capture(projectName, { kind: "root", sourceTreeSha256, inputs }, inputs, projectRoot);
	for(const pkg of snapshot?.document.packages ?? [])
		await capture(pkg.name, { kind: "lake", treeSha256: pkg.treeSha256, snapshotSha256: snapshot.sha256, origin: pkg.source }, pkg.files, join(snapshotRoot, pkg.directory));
	const document = { schemaVersion: 1, kind: "lean-bridge-source-notices", packages };
	const bytes = Buffer.from(canonicalJson(document));
	return { document, sha256: sha256(bytes), files: new Map([[manifestPath, bytes], ...payloads]) };
};

/**
 * Verify retained notices against the compiled source identity before copying.
 *
 * @param root - Compiled component or relocated notice root.
 * @param sourceIdentity - Source identity from the verified compilation receipt.
 */
export const readVerifiedSourceNotices = async (root, sourceIdentity) => {
	const bytes = await regularBytes(join(root, manifestPath));
	if(!digest(sourceIdentity.sourceNoticesSha256) || sha256(bytes) !== sourceIdentity.sourceNoticesSha256) throw new Error("Source notice inventory differs from compilation");
	const document = JSON.parse(bytes);
	if(!closed(document, ["schemaVersion", "kind", "packages"]) || document.schemaVersion !== 1 || document.kind !== "lean-bridge-source-notices"
		|| !bytes.equals(Buffer.from(canonicalJson(document))) || !Array.isArray(document.packages) || !document.packages.length) throw new Error("Invalid source notice inventory");
	const dependencies = sourceIdentity.lakeDependencies?.snapshot?.packages ?? [];
	if(document.packages.length !== dependencies.length + 1) throw new Error("Source notices differ from captured package set");
	const files = new Map([[manifestPath, bytes]]);
	for(const [index, pkg] of document.packages.entries())
	{
		if(!closed(pkg, ["name", "source", "notices"]) || typeof pkg.name !== "string" || !pkg.name || !Array.isArray(pkg.notices)) throw new Error("Invalid source notice package");
		const dependency = dependencies[index - 1];
		const inputs = index === 0 ? pkg.source?.inputs : dependency.files;
		if(index === 0 && (!Array.isArray(inputs) || inputs.some(file => !closed(file, ["path", "bytes", "sha256"]) || !safePath(file.path)
			|| !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !digest(file.sha256))
			|| sha256(inputs.map(file => `${file.sha256}  ${file.path}\n`).join("")) !== sourceIdentity.sourceTreeSha256)) throw new Error("Source notice inputs differ from compiled source tree");
		const source = index === 0 ? { kind: "root", sourceTreeSha256: sourceIdentity.sourceTreeSha256, inputs }
			: { kind: "lake", treeSha256: dependency.treeSha256, snapshotSha256: sourceIdentity.lakeDependencies.snapshotSha256, origin: dependency.source };
		if(!same(pkg.source, source) || (index > 0 && pkg.name !== dependency.name)) throw new Error("Source notice package differs from compilation");
		const identity = ({ path, bytes, sha256 }) => ({ path, bytes, sha256 });
		const expected = inputs.filter(file => isSourceNotice(file.path)).sort((a, b) => a.path < b.path ? -1 : 1).map(identity);
		if(!same(pkg.notices.map(identity), expected)) throw new Error("Source notices omit or change captured source files");
		let previous = "";
		for(const notice of pkg.notices)
		{
			if(!closed(notice, ["path", "bytes", "sha256", "payload"]) || !isSourceNotice(notice.path) || notice.path <= previous
				|| !Number.isSafeInteger(notice.bytes) || notice.bytes < 0 || !digest(notice.sha256) || notice.payload !== payloadPath(notice.sha256)) throw new Error("Invalid source notice file");
			previous = notice.path;
			const contents = files.get(notice.payload) ?? await regularBytes(join(root, notice.payload));
			if(contents.length !== notice.bytes || sha256(contents) !== notice.sha256) throw new Error(`Source notice payload drift: ${notice.path}`);
			files.set(notice.payload, contents);
		}
	}
	let actual;
	try
	{ actual = await readdir(join(root, "source-notices")); }
	catch(error)
	{ if(error.code !== "ENOENT") throw error; actual = []; }
	if(!same(actual.sort(), [...files.keys()].filter(path => path !== manifestPath).map(path => path.slice("source-notices/".length)).sort())) throw new Error("Unexpected source notice payload");
	return { document, files };
};
