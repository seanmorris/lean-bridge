/**
 * Renders Lean source, verifies its receipt, and launches two Lean checkers.
 *
 * @file
 */

const sourceNames = ["Dijkstra.lean", "DijkstraCore.lean"];
const keywords = new Set([
	"abbrev", "by", "cases", "def", "deriving", "do", "else", "end", "exact"
	, "have", "if", "import", "induction", "instance", "let", "match", "namespace"
	, "private", "rcases", "refine", "rfl", "rw", "simp", "structure", "then"
	, "theorem", "unfold", "where", "with"
]);
const declarationKeywords = new Set(["def", "instance", "structure", "theorem"]);
const sources = new Map();
const code = document.querySelector("#proof-code");
const sourceLabel = document.querySelector("#source-label");
const sourceStats = document.querySelector("#source-stats");
const auditStatus = document.querySelector("#audit-status");
const auditChecker = document.querySelector("#audit-checker");
const theoremCount = document.querySelector("#theorem-count");
const playgroundPanel = document.querySelector("#playground-panel");
const openWasm = document.querySelector("#open-wasm");
const openLeanWeb = document.querySelector("#open-lean-web");
const launchWasm = document.querySelector("#launch-wasm");
const launchLeanWeb = document.querySelector("#launch-lean-web");
let activeSource = "Dijkstra.lean";
let wasmUrl = "";
let leanWebUrl = "";

const escapeHtml = value => value
	.replaceAll("&", "&amp;")
	.replaceAll("<", "&lt;")
	.replaceAll(">", "&gt;")
	.replaceAll('"', "&quot;");

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

const renderSource = name => {
	activeSource = name;
	const source = sources.get(name);
	const state = { inBlockComment: false };
	code.innerHTML = source.split("\n").map((line, index) =>
		`<span class="code-line"><span class="line-number">${index + 1}</span>`
		+ `<span class="line-source">${highlightLine(line, state)}</span></span>`).join("");
	sourceLabel.textContent = name;
	sourceStats.textContent = `${source.split("\n").length} lines · ${new TextEncoder().encode(source).length} bytes`;
	for(const tab of document.querySelectorAll(".source-tab"))
	{
		tab.classList.toggle("active", tab.dataset.source === name);
	}
};

const sha256 = async value => {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
};

const verifyAudit = async audit => {
	const matches = await Promise.all(sourceNames.map(async name =>
		await sha256(sources.get(name)) === audit.sourceFiles[name].sha256));
	if(!matches.every(Boolean)) throw new Error("displayed source does not match the checked build receipt");
	auditStatus.className = "audit-value verified";
	auditStatus.textContent = "Source matches checked build";
	auditChecker.textContent = audit.checker;
	theoremCount.textContent = String(audit.theorems.length);
};

const playgroundSource = () => {
	const withoutImports = source => source.replace(/^import .*$/gmu, "").trim();
	return `import Std\n\n${withoutImports(sources.get("DijkstraCore.lean"))}\n\n`
		+ withoutImports(sources.get("Dijkstra.lean"));
};

const interactiveSource = () => `${playgroundSource()}\n\n`
	+ "#check LeanDijkstra.dijkstra_correct\n"
	+ "#print axioms LeanDijkstra.dijkstra_correct\n"
	+ "#check LeanDijkstra.dijkstraCsr_correct\n"
	+ "#print axioms LeanDijkstra.dijkstraCsr_correct\n";

// Comparator compiles the inputs as Challenge.lean and Solution.lean. Lean
// includes that filename in private declaration names, so identical private
// helpers otherwise receive different names and lean4export cannot compare
// them. Making those helpers public in both inputs changes only visibility.
const comparatorCompatible = source =>
	source.replace(/^private\s+(?=(?:def|structure)\b)/gmu, "");

const comparatorChallenge = () => {
	const core = comparatorCompatible(
		sources.get("DijkstraCore.lean").replace(/^import .*$/gmu, "").trim(),
	);
	const proof = sources.get("Dijkstra.lean");
	const theoremStart = proof.indexOf("theorem dijkstraCsr_correct");
	const proofStart = proof.indexOf(":=", theoremStart);
	if(theoremStart < 0 || proofStart < 0)
	{
		throw new Error("could not extract the dijkstraCsr_correct challenge statement");
	}
	const statement = proof.slice(theoremStart, proofStart).trimEnd();
	return `import Std\n\n${core}\n\nnamespace LeanDijkstra\n\n${statement} := by\n  sorry\n\nend LeanDijkstra`;
};

const toBase64Url = bytes => {
	let binary = "";
	for(const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};

const buildWasmUrl = async () => {
	const workspace = JSON.stringify({
		files: [{ name: "Dijkstra.lean", content: interactiveSource() }]
		, active: "Dijkstra.lean"
	});
	const compressed = new Blob([new TextEncoder().encode(workspace)])
		.stream().pipeThrough(new CompressionStream("gzip"));
	const bytes = new Uint8Array(await new Response(compressed).arrayBuffer());
	return `https://lean.cau.li/#s=${toBase64Url(bytes)}`;
};

const openChecker = (url, button, openedLabel) => {
	window.open(url, "_blank", "noopener,noreferrer");
	playgroundPanel.hidden = false;
	button.textContent = openedLabel;
	button.disabled = true;
};

const load = async () => {
	const [audit, ...loadedSources] = await Promise.all([
		fetch("./runtime/proof-audit.json").then(response => response.json())
		, ...sourceNames.map(name => fetch(`./${name}`).then(response => response.text()))
	]);
	for(let index = 0; index < sourceNames.length; index += 1)
	{
		sources.set(sourceNames[index], loadedSources[index]);
	}
	renderSource(activeSource);
	await verifyAudit(audit);
	wasmUrl = await buildWasmUrl();
	leanWebUrl = "https://live.lean-lang.org/#challenge="
		+ `${encodeURIComponent(comparatorChallenge())}`
		+ `&code=${encodeURIComponent(comparatorCompatible(interactiveSource()))}`;
	openWasm.href = wasmUrl;
	openLeanWeb.href = leanWebUrl;
	launchWasm.textContent = "Open Lean WASM checker ↗";
	launchLeanWeb.textContent = "Open Lean Web / Comparator ↗";
	launchWasm.disabled = false;
	launchLeanWeb.disabled = false;
};

for(const tab of document.querySelectorAll(".source-tab"))
{
	tab.addEventListener("click", () => renderSource(tab.dataset.source));
}

document.querySelector("#copy-source").addEventListener("click", async event => {
	await navigator.clipboard.writeText(sources.get(activeSource));
	event.currentTarget.textContent = "Copied";
	setTimeout(() => { event.currentTarget.textContent = "Copy"; }, 1200);
});

launchWasm.addEventListener("click", () => openChecker(wasmUrl, launchWasm, "Lean WASM opened"));
launchLeanWeb.addEventListener("click", () =>
	openChecker(leanWebUrl, launchLeanWeb, "Lean Web opened"));
load().catch(error => {
	auditStatus.className = "audit-value failed";
	auditStatus.textContent = "Proof receipt unavailable";
	console.error(error);
});
