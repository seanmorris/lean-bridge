/**
 * Presents checked Lean sources with React-owned controls and cancellable loading.
 *
 * @file
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
	buildLeanWebUrl, buildWasmUrl, highlightSource, loadProofSources
	, openProofChecker, proofSourceNames, verifyProofAudit
} from "../../../demos/shared/proof-services.mjs";
import type { ProofConfiguration } from "../../../demos/shared/proof-services.mjs";
import "./demo-page.css";

/** Artifact names, theorem selection, and visible labels for a proof panel. */
export interface ProofViewerConfig extends ProofConfiguration {
	title?: string;
	emphasis?: string;
	description?: string;
	coreTab?: string;
	sourceLabels?: Readonly<Record<string, string>>;
}

/** Public inputs shared by standalone algorithm route modules. */
interface ProofViewerProps {
	artifactBase: string;
	config: ProofViewerConfig;
}

/** Loaded source and checker state for one mounted artifact revision. */
interface ProofState {
	phase: "waiting" | "loading" | "verified" | "failed";
	sources: Map<string, string>;
	checker: string;
	count: number;
	error: string;
	wasmUrl: string;
	leanWebUrl: string;
	wasmNote: string;
}

// Firefox otherwise restores an earlier disabled state before React hydrates.
const proofControlAttributes = { autoComplete: "off" };

/**
 * Load one immutable configuration when its proof section approaches the viewport.
 *
 * @param root0 Component properties.
 * @param root0.artifactBase Directory containing the compiled algorithm artifacts.
 * @param root0.config Source ordering, labels, and named proof guarantees.
 */
const ProofViewerMount = ({ artifactBase, config }: ProofViewerProps) => {
	const section = useRef<HTMLElement>(null);
	const activeLifetime = useRef(0);
	const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const [activeSource, setActiveSource] = useState(config.proof);
	const [copyLabel, setCopyLabel] = useState("Copy");
	const [copyTitle, setCopyTitle] = useState("");
	const [panelMessage, setPanelMessage] = useState("");
	const [state, setState] = useState<ProofState>({
		phase: "waiting", sources: new Map(), checker: "—", count: 0
		, error: "", wasmUrl: "", leanWebUrl: "", wasmNote: ""
	});
	const coreTab = config.coreTab ?? config.core;
	const tabs = [{ name: config.proof, label: "Proof" }, { name: coreTab, label: "Core" }];
	const supporting = proofSourceNames(config).filter(name => name !== config.proof && name !== coreTab);
	const source = state.sources.get(activeSource);
	const highlighted = useMemo(() => source === undefined ? "" : highlightSource(source), [source]);

	useEffect(() => {
		let disposed = false;
		let requested = false;
		let loaded = false;
		let request: AbortController | undefined;
		let observer: IntersectionObserver | undefined;
		activeLifetime.current++;
		const load = async () => {
			if(disposed || requested || loaded) return;
			requested = true;
			request = new AbortController();
			const signal = request.signal;
			setState(previous => ({ ...previous, phase: "loading", error: ""
				, wasmUrl: "", leanWebUrl: "", wasmNote: "", checker: "—", count: 0
			}));
			try
			{
				const result = await loadProofSources(artifactBase, config, signal);
				if(disposed || signal.aborted) return;
				setState(previous => ({ ...previous, sources: result.sources }));
				await verifyProofAudit(config, result.sources, result.audit);
				if(disposed || signal.aborted) return;
				const leanWebUrl = buildLeanWebUrl(config, result.sources);
				setState(previous => ({
					...previous, phase: "verified", checker: result.audit.checker
					, count: result.audit.theorems.length, leanWebUrl
				}));
				if(typeof globalThis.CompressionStream !== "function")
				{
					setState(previous => ({ ...previous,
						wasmNote: "This browser cannot create the compressed workspace. Use Lean Web / Comparator."
					}));
				}
				else
				{
					try
					{
						const wasmUrl = await buildWasmUrl(config, result.sources, signal);
						if(disposed || signal.aborted) return;
						setState(previous => ({ ...previous, wasmUrl }));
					}
					catch
					{
						if(disposed || signal.aborted) return;
						setState(previous => ({ ...previous,
							wasmNote: "Could not compress the workspace. Use Lean Web / Comparator."
						}));
					}
				}
				loaded = true;
			}
			catch(error)
			{
				if(disposed || signal.aborted) return;
				setState(previous => ({ ...previous, phase: "failed"
					, error: error instanceof Error ? error.message : String(error)
				}));
			}
			finally
			{ if(!signal.aborted) requested = false; }
		};
		const observe = () => {
			if(loaded || disposed) return;
			if(typeof globalThis.IntersectionObserver !== "function")
{ void load(); return; }
			observer = new IntersectionObserver(entries => {
				if(entries.some(entry => entry.isIntersecting))
				{
					observer?.disconnect();
					void load();
				}
			}, { rootMargin: "240px 0px" });
			if(section.current) observer.observe(section.current);
		};
		const hide = () => {
			activeLifetime.current++;
			request?.abort();
			requested = false;
			observer?.disconnect();
			clearTimeout(copyTimer.current);
		};
		const show = (event: PageTransitionEvent) => {
			if(!event.persisted) return;
			setCopyLabel("Copy");
			setCopyTitle("");
			observe();
		};
		globalThis.addEventListener("pagehide", hide);
		globalThis.addEventListener("pageshow", show);
		observe();
		return () => {
			disposed = true;
			hide();
			globalThis.removeEventListener("pagehide", hide);
			globalThis.removeEventListener("pageshow", show);
		};
	}, [artifactBase, config]);

	const copy = async () => {
		if(source === undefined) return;
		const lifetime = activeLifetime.current;
		clearTimeout(copyTimer.current);
		try
		{
			await navigator.clipboard.writeText(source);
			if(lifetime !== activeLifetime.current) return;
			setCopyLabel("Copied");
			setCopyTitle("");
		}
		catch
		{
			if(lifetime !== activeLifetime.current) return;
			setCopyLabel("Copy failed");
			setCopyTitle("Clipboard access is unavailable. Select and copy the source text.");
		}
		copyTimer.current = setTimeout(() => setCopyLabel("Copy"), 1200);
	};
	const openChecker = (url: string, name: string) => {
		if(!url) return;
		setPanelMessage(openProofChecker(url, name)
			? "Interactive proof checkers" : "Popup blocked. Use a checker link below.");
	};
	const changeTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
		let target: number;
		if(event.key === "ArrowRight") target = (index + 1) % tabs.length;
		else if(event.key === "ArrowLeft") target = (index + tabs.length - 1) % tabs.length;
		else if(event.key === "Home") target = 0;
		else if(event.key === "End") target = tabs.length - 1;
		else return;
		event.preventDefault();
		setActiveSource(tabs[target]!.name);
		section.current?.querySelectorAll<HTMLButtonElement>(".source-tab")[target]?.focus();
	};
	const available = state.sources.size > 0;
	const tabSelected = tabs.some(tab => tab.name === activeSource);
	return <section ref={section} className="proof-section" aria-labelledby="proof-title"
		data-proof-core={config.core} data-proof-module={config.proof} data-proof-namespace={config.namespace}
		data-proof-dependencies={config.dependencies.join(",")} data-comparator-theorem={config.comparator}
		data-proof-theorems={config.theorems.join(",")}>
		<div className="section-heading"><div><p className="eyebrow">Inspectable assurance</p>
			<h2 id="proof-title">{config.title ?? "The target reconstructed."}<br />
				<em>{config.emphasis ?? "The fewest edits proved."}</em></h2></div>
		<p>{config.description ?? "Lean proves that applying the returned script produces the target sequence and that no insertion/deletion script uses fewer edits."}</p></div>
		<div className="proof-grid"><div className="source-viewer">
			<div className="source-toolbar"><div className="source-pickers">
				<div className="source-tabs" role="tablist" aria-label="Lean source file">
					{tabs.map((tab, index) => <button {...proofControlAttributes} key={tab.name} type="button" role="tab"
						className={`source-tab${activeSource === tab.name ? " active" : ""}`} data-source={tab.name}
						aria-selected={activeSource === tab.name} aria-controls="proof-code" disabled={!available}
						tabIndex={activeSource === tab.name || (!tabSelected && index === 0) ? 0 : -1}
						onClick={() => setActiveSource(tab.name)} onKeyDown={event => changeTab(event, index)}>{tab.label}</button>)}
				</div>{supporting.length > 0 && <select {...proofControlAttributes} className="source-select" data-source-select aria-label="Supporting Lean source"
					disabled={!available} value={supporting.includes(activeSource) ? activeSource : ""}
					onChange={event => { if(event.target.value) setActiveSource(event.target.value); }}>
					<option value="">Supporting sources</option>
					{supporting.map(name => <option key={name} value={name}>{config.sourceLabels?.[name] ?? name}</option>)}
				</select>}</div><div className="source-meta"><span id="source-label">{activeSource}</span>
				<span id="source-stats">{source === undefined ? state.phase === "failed" ? "Source unavailable" : "Loading…"
					: `${source.split("\n").length} lines · ${new TextEncoder().encode(source).length} bytes`}</span>
				<button {...proofControlAttributes} id="copy-source" type="button" disabled={!available} title={copyTitle} onClick={() => void copy()}>{copyLabel}</button>
			</div></div><pre id="proof-code" className="proof-code" role="tabpanel" tabIndex={0}
				aria-label="Syntax-highlighted Lean source" aria-busy={state.phase === "loading"}
				dangerouslySetInnerHTML={{ __html: source === undefined
					? state.phase === "failed" ? "The Lean source could not be loaded. Reload to try again."
						: '<span class="code-loading">Loading checked source…</span>' : highlighted }} />
		</div><aside className="proof-audit"><div className="audit-mark" aria-hidden="true">✓</div>
			<p className="label">Build receipt</p><h3>Checked, then compiled.</h3>
			<p className="audit-copy">The receipt binds this exact source to the proof-checking build. It is verified again in your browser with SHA-256.</p>
			<dl><div><dt>Status</dt><dd id="audit-status" role="status" className={`audit-value ${state.phase === "verified" ? "verified" : state.phase === "failed" ? "failed" : ""}`} title={state.error}>
				{state.phase === "verified" ? "Source matches checked build" : state.phase === "failed" ? "Proof receipt unavailable" : "Verifying source…"}</dd></div>
			<div><dt>Checker</dt><dd id="audit-checker">{state.checker}</dd></div>
			<div><dt>Audited theorems</dt><dd id="theorem-count">{state.phase === "verified" ? state.count : "—"}</dd></div></dl>
			<div className="checker-actions"><button {...proofControlAttributes} id="launch-wasm" type="button" className="launch-lean"
				disabled={!state.wasmUrl} title={state.wasmNote} onClick={() => openChecker(state.wasmUrl, "lean-wasm-checker")}>
				Open Lean WASM checker <span>↗</span></button>
			<button {...proofControlAttributes} id="launch-lean-web" type="button" className="launch-lean secondary" disabled={!state.leanWebUrl}
				onClick={() => openChecker(state.leanWebUrl, "lean-web-comparator")}>Open Lean Web / Comparator <span>↗</span></button></div>
			<p className="network-note"><b>WASM:</b> wait for “Ready,” then click “Run Code”; the output prints the theorem and its axioms. <b>Lean Web:</b> inspect the separate challenge before choosing “I trust this challenge.”</p>
			{state.wasmNote && <p className="network-note" role="status">{state.wasmNote}</p>}
		</aside></div><div id="playground-panel" className="playground-panel" hidden={!panelMessage}>
			<div className="playground-toolbar"><div><b>{panelMessage || "Interactive checkers opened"}</b>
				<span>Both use the bundled core and proof.</span></div><div className="playground-links">
				<a id="open-wasm" href={state.wasmUrl || undefined} aria-disabled={!state.wasmUrl} target="_blank" rel="noopener noreferrer">Lean WASM ↗</a>
				<a id="open-lean-web" href={state.leanWebUrl || undefined} aria-disabled={!state.leanWebUrl} target="_blank" rel="noopener noreferrer">Lean Web / Comparator ↗</a>
			</div></div></div>
	</section>;
};

/**
 * Isolate asynchronous proof state when route artifact configuration changes.
 *
 * @param root0 Component properties.
 * @param root0.artifactBase Directory containing the compiled algorithm artifacts.
 * @param root0.config Source ordering, labels, and named proof guarantees.
 */
export const ProofViewer = ({ artifactBase, config }: ProofViewerProps) => {
	const identity = JSON.stringify(config);
	const stableConfig = useMemo(() => JSON.parse(identity) as ProofViewerConfig, [identity]);
	return <ProofViewerMount key={`${artifactBase}:${identity}`} artifactBase={artifactBase} config={stableConfig} />;
};
