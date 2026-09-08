/**
 * Checks the DOM-free proof artifacts, standalone payloads, and checker ownership.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import {
	buildLeanWebUrl, buildWasmUrl, highlightSource, loadProofSources
	, openProofChecker, sha256Source, verifyProofAudit
} from "./proof-services.mjs";

const config = { core: "Core.lean", proof: "Proof.lean", dependencies: []
	, namespace: "Demo", comparator: "total", theorems: ["Demo.total"] };
const sources = new Map([
	["Core.lean", "import Init\nnamespace Demo\ndef value : Nat := 1\nend Demo"]
	, ["Proof.lean", "import Core\nnamespace Demo\ntheorem total : value = 1 := by rfl\nend Demo"]
]);
const receipt = async () => ({
	checker: "Lean 4", theorems: ["Demo.total"]
	, sourceFiles: Object.fromEntries(await Promise.all([...sources].map(async ([name, source]) =>
		[name, { sha256: await sha256Source(source) }])))
});

test("proof highlighting escapes source text without browser DOM", () => {
	const html = highlightSource('def name := "<script>"\n/- <img src=x onerror=bad> -/');
	assert.ok(html.includes("token-keyword"));
	assert.ok(html.includes("token-comment"));
	assert.ok(html.includes("&lt;script&gt;"));
	assert.doesNotMatch(html, /<script>|<img/u);
});

test("receipt verification rejects tampering, missing hashes, and malformed metadata", async () => {
	const audit = await receipt();
	await verifyProofAudit(config, sources, audit);
	const changed = new Map(sources);
	changed.set("Core.lean", sources.get("Core.lean") + "\n");
	await assert.rejects(verifyProofAudit(config, changed, audit), /does not match/u);
	await assert.rejects(verifyProofAudit(config, sources, { ...audit, sourceFiles: {} }), /does not match/u);
	await assert.rejects(verifyProofAudit(config, sources, {}), /Invalid proof/u);
});

test("both checker payloads include the named guarantee and visible axiom output", async () => {
	const link = new URL(buildLeanWebUrl(config, sources));
	const payload = new URLSearchParams(link.hash.slice(1));
	assert.match(payload.get("challenge"), /theorem total : value = 1 := by\n {2}sorry/u);
	assert.match(payload.get("code"), /#check Demo.total\n#print axioms Demo.total/u);
	const wasm = new URL(await buildWasmUrl(config, sources));
	const packed = new URLSearchParams(wasm.hash.slice(1)).get("s");
	const workspace = JSON.parse(gunzipSync(Buffer.from(packed, "base64url")).toString());
	assert.equal(workspace.active, "Proof.lean");
	assert.equal(workspace.files.length, 1);
	assert.match(workspace.files[0].content, /#print axioms Demo.total/u);
	assert.doesNotMatch(workspace.files[0].content, /^import Core$/mu);
});

test("artifact requests remain under the supplied prefix and preserve abort signals", async context => {
	const previous = globalThis.fetch;
	context.after(() => { globalThis.fetch = previous; });
	const requests = [];
	const audit = await receipt();
	const controller = new AbortController();
	globalThis.fetch = async (url, options) => {
		requests.push([url.href, options.signal]);
		if(options.signal.aborted) throw new DOMException("Aborted", "AbortError");
		return new Response(url.pathname.endsWith(".json") ? JSON.stringify(audit)
			: sources.get(url.pathname.split("/").at(-1)));
	};
	const loaded = await loadProofSources("https://example.test/project/artifacts/myers/", config, controller.signal);
	assert.deepEqual(loaded.sources, sources);
	assert.equal(requests.length, 3);
	assert.ok(requests.every(([url, signal]) => url.startsWith("https://example.test/project/artifacts/myers/")
		&& signal === controller.signal));
	controller.abort();
	await assert.rejects(loadProofSources("https://example.test/", config, controller.signal), /Aborted/u);
	await assert.rejects(loadProofSources("https://example.test/", { ...config, core: "../Core.lean" }), /filename/u);
	globalThis.fetch = async () => new Response("Missing", { status: 404 });
	await assert.rejects(loadProofSources("https://example.test/", config), /HTTP 404/u);
});

test("checker compression rejects cancellation before and during stream consumption", async () => {
	const before = new AbortController();
	before.abort();
	await assert.rejects(buildWasmUrl(config, sources, before.signal), { name: "AbortError" });
	const during = new AbortController();
	const pending = buildWasmUrl(config, sources, during.signal);
	during.abort();
	await assert.rejects(pending, { name: "AbortError" });
	assert.ok((await buildWasmUrl(config, sources)).startsWith("https://lean.cau.li/#s="));
});

test("checker tabs focus, reopen, and remain user-owned after popup failure", context => {
	const previous = globalThis.open;
	context.after(() => {
		if(previous === undefined) Reflect.deleteProperty(globalThis, "open");
		else globalThis.open = previous;
	});
	let opens = 0;
	let focuses = 0;
	const visited = [];
	const checker = { opener: "original", closed: false
		, location: { replace: url => visited.push(url) }
		, focus: () => { focuses++; } };
	globalThis.open = () => { opens++; return checker; };
	assert.equal(openProofChecker("https://example.test/one", "services-test"), true);
	assert.equal(checker.opener, null);
	assert.equal(openProofChecker("https://example.test/one", "services-test"), true);
	assert.equal(opens, 1);
	assert.equal(focuses, 1);
	assert.equal(openProofChecker("https://example.test/two", "services-test"), true);
	assert.deepEqual(visited, ["https://example.test/one", "https://example.test/two"]);
	checker.closed = true;
	assert.equal(openProofChecker("https://example.test/two", "services-test"), true);
	assert.equal(opens, 2);
	globalThis.open = () => null;
	assert.equal(openProofChecker("https://example.test/", "blocked-test"), false);
});
