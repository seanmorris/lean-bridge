/**
 * Original Git bytes missing from three retained PHP-Wasm source snapshots.
 * Keep this data in the captured module tree so replay has no uncaptured input.
 *
 * @file
 */
export const phpWasmEntryReplaySourceSupplement = Object.freeze({
	"schemaVersion": 1
	, "kind": "php-wasm-entry-source-supplement-v1"
	, "scope": "Original Git bytes omitted from the two immutable PHP-Wasm source archives. Supplement only the exact listed historical snapshots; never edit or broaden the original archive identities."
	, "archives": [
		{
			"path": "docs/evidence/php-wasm-entry-hosted-20261025/index.json"
			, "bytes": 6087819
			, "sha256": "581b034fd9dc2c8c59b60b571df2c7861bac8eed576d5d39f4cd3f2adf2f97a8"
		}
		, {
			"path": "docs/evidence/php-wasm-entry-diagnostic-nominal-full-20261025/index.json"
			, "bytes": 6054767
			, "sha256": "e5802a69e32cf136c99c88ca31c6fc5829273442b77d814d240460211220b82c"
		}
	]
	, "snapshots": [
		{
			"revision": "a003269808c43a2a3a509a23c8a8ab8def07b610"
			, "snapshotSha256": "a6e01ac7f1a68895670b93f6f98be897110c8e61e5f4987a26ea934858966d88"
		}
		, {
			"revision": "2e00c60aa4555377b4f17eb1f5eb2d2a812596c2"
			, "snapshotSha256": "7733b57765cc5c85e642e70397d9901b4e675f7c797951e89b61e399bc9cd422"
		}
		, {
			"revision": "700fea2378ffd59b61611deaaa6a1d15ba5d38d2"
			, "snapshotSha256": "a908b4daee7ad2c82ab8d5114babe876319fc0ed3c99fbb969cad5afef09e50e"
		}
	]
	, "files": [
		{
			"path": "site/paths.mjs"
			, "bytes": 772
			, "sha256": "88cf8a31f3d3cfb88e12f42aec75055a798da735148bdf029d83803be71d7e15"
			, "source": "/**\n * Resolve public site paths without assuming a domain-root deployment.\n *\n * @file\n */\n\n/**\n * Normalize the explicitly configured static-host prefix.\n *\n * @param {string} value Requested deployment directory.\n */\nexport const normalizeBase = (value = \"/\") => {\n\tif(!/^\\/(?:[A-Za-z0-9._~-]+\\/)*$/u.test(value)\n\t\t|| value.split(\"/\").some(part => part === \".\" || part === \"..\"))\n\t\tthrow new Error(\"LEAN_BRIDGE_SITE_BASE must be an absolute directory path ending in /.\");\n\treturn value;\n};\n\n/**\n * Prefix a registry path with its deployment directory.\n *\n * @param {string} base Validated deployment prefix.\n * @param {string} path Registry path without its deployment prefix.\n */\nexport const withBase = (base, path) => normalizeBase(base) + path.replace(/^\\//u, \"\");\n"
		}
		, {
			"path": "site/serve.mjs"
			, "bytes": 1994
			, "sha256": "4b1d8c7687ee6b3d376ba188538fcbb1a12ee35c1f768330f5c05ed4b5788454"
			, "source": "/**\n * Serve the exact static artifact with nested paths, correct MIME types, and real 404s.\n *\n * @file\n */\n\nimport { createServer } from \"node:http\";\nimport { readFile, stat } from \"node:fs/promises\";\nimport { extname, resolve, sep } from \"node:path\";\nimport { normalizeBase } from \"./paths.mjs\";\n\nconst contentTypes = {\n\t\".html\": \"text/html; charset=utf-8\", \".js\": \"text/javascript\"\n\t, \".mjs\": \"text/javascript\", \".css\": \"text/css\", \".json\": \"application/json\"\n\t, \".wasm\": \"application/wasm\", \".lean\": \"text/plain; charset=utf-8\"\n\t, \".svg\": \"image/svg+xml\", \".data\": \"text/x-script\"\n};\n\n/**\n * Start a loopback-only preview of one assembled deployment directory.\n *\n * @param {object} options Server paths.\n * @param {string} options.root Artifact root directory.\n * @param {string} options.base Deployment path prefix.\n */\nexport const startSiteServer = async ({ root, base }) => {\n\troot = resolve(root);\n\tbase = normalizeBase(base);\n\tconst server = createServer(async (request, response) => {\n\t\ttry\n\t\t{\n\t\t\tconst pathname = decodeURIComponent(new URL(request.url, \"http://localhost\").pathname);\n\t\t\tif(!pathname.startsWith(base)) throw new Error(\"Outside deployment prefix\");\n\t\t\tlet target = resolve(root, pathname.slice(base.length));\n\t\t\tif(target !== root && !target.startsWith(root + sep)) throw new Error(\"Outside artifact\");\n\t\t\tif((await stat(target)).isDirectory()) target = resolve(target, \"index.html\");\n\t\t\tresponse.writeHead(200, { \"Content-Type\": contentTypes[extname(target)] || \"application/octet-stream\" });\n\t\t\tresponse.end(await readFile(target));\n\t\t}\n\t\tcatch\n\t\t{\n\t\t\tresponse.writeHead(404, { \"Content-Type\": \"text/html; charset=utf-8\" });\n\t\t\ttry\n\t\t\t{ response.end(await readFile(resolve(root, \"404.html\"))); }\n\t\t\tcatch\n\t\t\t{ response.end(\"Page not found\"); }\n\t\t}\n\t});\n\tawait new Promise(resolve => server.listen(0, \"127.0.0.1\", resolve));\n\treturn {\n\t\turl: `http://127.0.0.1:${server.address().port}${base}`\n\t\t, close: () => new Promise(resolve => server.close(resolve))\n\t};\n};\n"
		}
	]
});
