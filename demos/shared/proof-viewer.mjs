/**
 * Renders checked Lean sources and launches the two portfolio proof checkers.
 *
 * @file
 */

import {
	buildLeanWebUrl, buildWasmUrl, highlightSource, loadProofSources
	, openProofChecker, verifyProofAudit
} from "./proof-services.mjs";

const configElement = document.querySelector("[data-proof-core]");
const config = {
	core: configElement.dataset.proofCore
	, proof: configElement.dataset.proofModule
	, namespace: configElement.dataset.proofNamespace
	, comparator: configElement.dataset.comparatorTheorem
	, theorems: configElement.dataset.proofTheorems.split(",")
	, dependencies: (configElement.dataset.proofDependencies || "").split(",").filter(Boolean)
};
let sources = new Map();
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
const copySource = document.querySelector("#copy-source");
const sourceControls = [...document.querySelectorAll(".source-tab, [data-source-select]")];
const sourceTabs = [...document.querySelectorAll(".source-tab")];
code.setAttribute("role", "tabpanel");
code.tabIndex = 0;
for(const control of [...sourceControls, copySource, launchWasm, launchLeanWeb]) control.disabled = true;
let copyTimer = 0;
let activeSource = config.proof;
let wasmUrl = "";
let leanWebUrl = "";

const renderSource = name => {
	const source = sources.get(name);
	if(typeof source !== "string") return;
	activeSource = name;
	code.innerHTML = highlightSource(source);

	sourceLabel.textContent = name;
	sourceStats.textContent = `${source.split("\n").length} lines · ${new TextEncoder().encode(source).length} bytes`;
	for(const tab of document.querySelectorAll(".source-tab"))
	{
		tab.classList.toggle("active", tab.dataset.source === name);
		tab.setAttribute("aria-selected", String(tab.dataset.source === name));
		tab.setAttribute("aria-controls", "proof-code");
		tab.tabIndex = tab.dataset.source === name ? 0 : -1;
	}
	if(!sourceTabs.some(tab => tab.tabIndex === 0)) sourceTabs[0].tabIndex = 0;
	for(const select of document.querySelectorAll("[data-source-select]"))
		select.value = [...select.options].some(option => option.value === name) ? name : "";
};

const openChecker = (url, windowName) => {
	playgroundPanel.hidden = false;
	playgroundPanel.querySelector("b").textContent = openProofChecker(url, windowName)
		? "Interactive proof checkers" : "Popup blocked. Use a checker link below.";
};

const load = async () => {
	const loaded = await loadProofSources(new URL("./", globalThis.location.href), config);
	const audit = loaded.audit;
	sources = loaded.sources;

	renderSource(activeSource);
	for(const control of [...sourceControls, copySource]) control.disabled = false;
	await verifyProofAudit(config, sources, audit);
	auditStatus.className = "audit-value verified";
	auditStatus.textContent = "Source matches checked build";
	auditChecker.textContent = audit.checker;
	theoremCount.textContent = String(audit.theorems.length);
	leanWebUrl = buildLeanWebUrl(config, sources);
	openLeanWeb.href = leanWebUrl;
	launchLeanWeb.disabled = false;
	if("CompressionStream" in globalThis)
	{
		try
		{
			wasmUrl = await buildWasmUrl(config, sources);
			openWasm.href = wasmUrl;
			launchWasm.disabled = false;
		}
		catch
		{
			launchWasm.title = "Could not compress the workspace. Use Lean Web / Comparator.";
		}
	}
	else launchWasm.title = "This browser cannot create the compressed workspace. Use Lean Web / Comparator.";
};

for(const tab of document.querySelectorAll(".source-tab"))
{
	tab.addEventListener("click", () => renderSource(tab.dataset.source));
	tab.addEventListener("keydown", event => {
		let index = sourceTabs.indexOf(tab);
		if(event.key === "ArrowRight") index = (index + 1) % sourceTabs.length;
		else if(event.key === "ArrowLeft") index = (index + sourceTabs.length - 1) % sourceTabs.length;
		else if(event.key === "Home") index = 0;
		else if(event.key === "End") index = sourceTabs.length - 1;
		else return;
		event.preventDefault();
		sourceTabs[index].focus();
		renderSource(sourceTabs[index].dataset.source);
	});
}
for(const select of document.querySelectorAll("[data-source-select]"))
	select.addEventListener("change", () => { if(select.value) renderSource(select.value); });
copySource.addEventListener("click", async () => {
	clearTimeout(copyTimer);
	try
	{
		await navigator.clipboard.writeText(sources.get(activeSource));
		copySource.textContent = "Copied";
		copySource.title = "";
	}
	catch
	{
		copySource.textContent = "Copy failed";
		copySource.title = "Clipboard access is unavailable. Select and copy the source text.";
	}
	copyTimer = setTimeout(() => { copySource.textContent = "Copy"; }, 1200);
});
launchWasm.addEventListener("click", () => openChecker(wasmUrl, "lean-wasm-checker"));
launchLeanWeb.addEventListener("click", () => openChecker(leanWebUrl, "lean-web-comparator"));
load().catch(error => {
	auditStatus.className = "audit-value failed";
	auditStatus.textContent = "Proof receipt unavailable";
	auditStatus.title = error.message;
	sourceStats.textContent = sources.size ? sourceStats.textContent : "Source unavailable";
	if(!sources.size) code.textContent = "The Lean source could not be loaded. Reload to try again.";
});
