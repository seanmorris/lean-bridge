/**
 * Loads, verifies, and formats Lean proof artifacts without owning browser DOM.
 *
 * @file
 */

const keywords = new Set([
	"abbrev", "by", "cases", "def", "deriving", "do", "else", "end", "exact"
	, "have", "if", "import", "induction", "instance", "let", "match", "namespace"
	, "private", "rcases", "refine", "rfl", "rw", "simp", "structure", "then"
	, "theorem", "unfold", "where", "with"
]);
const declarationKeywords = new Set(["def", "instance", "structure", "theorem"]);
const escapeHtml = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
	.replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const highlightCode = value => {
	let declarationExpected = false;
	let cursor = 0;
	let result = "";
	for(const match of value.matchAll(/("(?:\\.|[^"\\])*"|\b\d+\b|\b[A-Za-z_][A-Za-z0-9_?']*)/gu))
	{
		result += escapeHtml(value.slice(cursor, match.index));
		const token = match[0];
		const escaped = escapeHtml(token);
		if(token.startsWith('"')) result += `<span class="token-string">${escaped}</span>`;
		else if(/^\d/u.test(token)) result += `<span class="token-number">${escaped}</span>`;
		else if(declarationExpected)
		{
			declarationExpected = false;
			result += `<span class="token-declaration">${escaped}</span>`;
		}
		else if(keywords.has(token))
		{
			declarationExpected = declarationKeywords.has(token);
			result += `<span class="token-keyword">${escaped}</span>`;
		}
		else result += /^[A-Z]/u.test(token) ? `<span class="token-type">${escaped}</span>` : escaped;
		cursor = match.index + token.length;
	}
	return result + escapeHtml(value.slice(cursor));
};

const highlightLine = (line, state) => {
	let cursor = 0;
	let result = "";
	while(cursor < line.length)
	{
		if(state.inBlockComment)
		{
			const end = line.indexOf("-/", cursor);
			const stop = end < 0 ? line.length : end + 2;
			result += `<span class="token-comment">${escapeHtml(line.slice(cursor, stop))}</span>`;
			cursor = stop;
			if(end >= 0) state.inBlockComment = false;
			continue;
		}
		const lineComment = line.indexOf("--", cursor);
		const blockComment = line.indexOf("/-", cursor);
		const starts = [lineComment, blockComment].filter(index => index >= 0);
		const next = starts.length ? Math.min(...starts) : line.length;
		result += highlightCode(line.slice(cursor, next));
		if(next === line.length) break;
		if(next === lineComment)
		{
			result += `<span class="token-comment">${escapeHtml(line.slice(next))}</span>`;
			break;
		}
		state.inBlockComment = true;
		cursor = next;
	}
	return result || " ";
};

/**
 * Format escaped Lean source with numbered, syntax-highlighted lines.
 *
 * @param source Exact Lean text to render.
 */
export const highlightSource = source => {
	const state = { inBlockComment: false };
	return source.split("\n").map((line, index) =>
		`<span class="code-line"><span class="line-number">${index + 1}</span>`
		+ `<span class="line-source">${highlightLine(line, state)}</span></span>`).join("");
};

/**
 * List the source files required by one proof configuration.
 *
 * @param config Source ordering for this proof.
 */
export const proofSourceNames = config => [...new Set([config.proof, config.core, ...config.dependencies])];

/**
 * Fetch only named Lean artifacts and their receipt, with caller-owned cancellation.
 *
 * @param artifactBase Directory containing named sources and runtime receipt.
 * @param config Source ordering for this proof.
 * @param signal Caller-owned request cancellation signal.
 */
export const loadProofSources = async (artifactBase, config, signal) => {
	const names = proofSourceNames(config);
	if(names.some(name => !/^[A-Za-z0-9_-]+\.lean$/u.test(name)))
		throw new Error("Invalid Lean source filename");
	const base = new URL(artifactBase, globalThis.location?.href);
	if(!base.pathname.endsWith("/")) base.pathname += "/";
	const fetchChecked = async path => {
		const response = await fetch(new URL(path, base), { signal });
		if(!response.ok) throw new Error(`Could not load ${path}: HTTP ${response.status}`);
		return response;
	};
	const [audit, ...loaded] = await Promise.all([
		fetchChecked("runtime/proof-audit.json").then(response => response.json())
		, ...names.map(name => fetchChecked(name).then(response => response.text()))
	]);
	return { audit, sources: new Map(names.map((name, index) => [name, loaded[index]])) };
};

/**
 * Compute the receipt-compatible SHA-256 hash of exact UTF-8 source bytes.
 *
 * @param source Exact Lean text to hash.
 */
export const sha256Source = async source => {
	const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
	return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
};

/**
 * Verify every displayed source against a structurally valid build receipt.
 *
 * @param config Source ordering for this proof.
 * @param sources Loaded source text by filename.
 * @param audit Build receipt to verify.
 */
export const verifyProofAudit = async (config, sources, audit) => {
	if(typeof audit?.checker !== "string" || !Array.isArray(audit?.theorems))
		throw new Error("Invalid proof build receipt");
	const matches = await Promise.all(proofSourceNames(config).map(async name => {
		const expected = audit.sourceFiles?.[name]?.sha256;
		return typeof expected === "string" && /^[a-f0-9]{64}$/u.test(expected)
			&& typeof sources.get(name) === "string" && await sha256Source(sources.get(name)) === expected;
	}));
	if(!matches.every(Boolean)) throw new Error("displayed source does not match the checked build receipt");
};

const withoutImports = source => source.replace(/^import .*$/gmu, "").trim();

/**
 * Join source modules and diagnostic commands into one standalone Lean input.
 *
 * @param config Source ordering and theorem names.
 * @param sources Loaded source text by filename.
 */
export const interactiveSource = (config, sources) => "import Std\n\n"
	+ [config.core, ...config.dependencies, config.proof]
		.map(name => withoutImports(sources.get(name))).join("\n\n")
	+ `\n\n${config.theorems.map(theorem => `#check ${theorem}\n#print axioms ${theorem}`).join("\n")}`;

/**
 * Remove private declaration names that cannot cross Comparator challenge boundaries.
 *
 * @param source Lean text to expose across the challenge boundary.
 */
export const comparatorCompatible = source => source.replace(/^private\s+(?=(?:def|structure)\b)/gmu, "");

/**
 * Extract a named theorem statement, leaving its proof for Comparator to compare.
 *
 * @param config Named theorem and source ordering.
 * @param sources Loaded source text by filename.
 */
export const comparatorChallenge = (config, sources) => {
	const core = [config.core, ...config.dependencies]
		.map(name => comparatorCompatible(withoutImports(sources.get(name)))).join("\n\n");
	const proof = comparatorCompatible(withoutImports(sources.get(config.proof)));
	const theoremStart = proof.indexOf(`theorem ${config.comparator}`);
	const proofStart = proof.indexOf(":=", theoremStart);
	if(theoremStart < 0 || proofStart < 0) throw new Error("could not extract Comparator theorem");
	const prelude = proof.slice(0, theoremStart).trimEnd();
	const statement = proof.slice(theoremStart, proofStart).trimEnd();
	return `import Std\n\n${core}\n\n${prelude}\n\n${statement} := by\n  sorry\n\nend ${config.namespace}`;
};

const toBase64Url = bytes => {
	let binary = "";
	for(const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};

/**
 * Build a compressed Lean WASM workspace URL from the checked source modules.
 *
 * @param config Source ordering and theorem names.
 * @param sources Loaded source text by filename.
 * @param {AbortSignal} [signal] Cancel pending compression when its owner leaves.
 */
export const buildWasmUrl = async (config, sources, signal) => {
	signal?.throwIfAborted();
	const workspace = JSON.stringify({
		files: [{ name: config.proof, content: interactiveSource(config, sources) }]
		, active: config.proof
	});
	const compressed = new Blob([new TextEncoder().encode(workspace)])
		.stream().pipeThrough(new CompressionStream("gzip"), { signal });
	const bytes = await new Response(compressed).arrayBuffer();
	signal?.throwIfAborted();
	return `https://lean.cau.li/#s=${toBase64Url(new Uint8Array(bytes))}`;
};

/**
 * Build a separate Comparator challenge and solution with visible theorem output.
 *
 * @param config Named theorem and source ordering.
 * @param sources Loaded source text by filename.
 */
export const buildLeanWebUrl = (config, sources) =>
	"https://live.lean-lang.org/#challenge=" + encodeURIComponent(comparatorChallenge(config, sources))
	+ `&code=${encodeURIComponent(comparatorCompatible(interactiveSource(config, sources)))}`;

const checkerWindows = new Map();

/**
 * Open or focus a named checker without taking ownership of its lifetime.
 *
 * @param url Prepared external checker URL.
 * @param windowName Stable checker tab name.
 */
export const openProofChecker = (url, windowName) => {
	if(!url) return false;
	let existing = checkerWindows.get(windowName);
	if(!existing || existing.window.closed)
	{
		const checker = globalThis.open("about:blank", windowName);
		if(!checker) return false;
		checker.opener = null;
		checker.location.replace(url);
		existing = { window: checker, url };
		checkerWindows.set(windowName, existing);
	}
	else
	{
		if(existing.url !== url)
		{
			existing.window.location.replace(url);
			existing.url = url;
		}
		existing.window.focus();
	}
	return true;
};
