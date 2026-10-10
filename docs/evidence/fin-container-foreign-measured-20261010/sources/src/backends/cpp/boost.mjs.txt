/**
 * Pinned standalone Boost headers, supplied offline to prepared C++ consumers.
 *
 * @file
 */
import { gunzipSync } from "node:zlib";
import { sha256 } from "../../capsule/node.mjs";
import source from "./boost.source.json" with { type: "json" };

export const boostIdentity = Object.freeze({
	version: "1.90.0"
	, mode: "BOOST_MP_STANDALONE"
	, sha256: "6f4b548f393ddcdce8f5d8b3064d2dc58c9d09e856c80d8b37e4748d6c602ffb"
	, license: "BSL-1.0" });

/** Read upstream headers without consulting the network or a system Boost install. */
export const boostSources = () => {
	const bytes = gunzipSync(Buffer.from(source.gzipBase64.join(""), "base64"), { maxOutputLength: 4 * 1024 * 1024 });
	if(source.version !== boostIdentity.version || source.mode !== boostIdentity.mode
		|| source.sha256 !== boostIdentity.sha256 || sha256(bytes) !== boostIdentity.sha256)
		throw new Error("Pinned Boost source identity differs");
	const files = JSON.parse(bytes);
	if(Object.keys(files).length !== 198 || bytes.length !== 3129500) throw new Error("Pinned Boost file inventory differs");
	for(const [path, text] of Object.entries(files))
		if(!/^(?:include\/boost\/[A-Za-z0-9_./-]+|share\/lean-bridge\/licenses\/Boost-LICENSE)$/.test(path)
			|| path.split("/").some(part => part === ".." || part === ".") || typeof text !== "string")
			throw new Error(`Invalid Boost source path: ${path}`);
	return { ...files, "share/lean-bridge/boost.json": `${JSON.stringify({ ...boostIdentity, sources: source.sources
		, files: Object.fromEntries(Object.entries(files).map(([path, text]) => [path, { bytes: Buffer.byteLength(text), sha256: sha256(text) }])) }, null, 2)}\n` };
};
