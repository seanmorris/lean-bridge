/**
 * Present exact-text editing and Lean's shortest scripts with route-owned effects.
 *
 * @file
 */

import { useEffect, useRef, useState } from "react";
import { PRESETS, tokenize, textareaValue } from "../../../demos/lean-myers/scenario.mjs";
import { createEditorSession, getBrowserEditorSession } from "../../../demos/lean-myers/editor-session.mjs";
import type { EditorSession, EditorSide } from "../../../demos/lean-myers/editor-session.mjs";
import { attachExactEditor } from "../../../demos/lean-myers/editor-binding.mjs";
import type { EditorBinding } from "../../../demos/lean-myers/editor-binding.mjs";
import { createComparisonController } from "../../../demos/lean-myers/comparison-controller.mjs";
import type { ComparisonController, ComparisonState, DiffRuntime } from "../../../demos/lean-myers/comparison-controller.mjs";
import type { ComparisonMode, PreviewLine } from "../../../demos/lean-myers/view-model.mjs";
import "./myers.css";

const plural = (count: number, singular: string) => `${count} ${singular}${count === 1 ? "" : "s"}`;
const sides: EditorSide[] = ["before", "after"];
const toneClass = (kind: number | undefined) => kind === 1 ? "char-removed" : kind === 2 ? "char-added" : undefined;

/**
 * Render one physical line using only Lean's returned edit decisions.
 *
 * @param root0 Cell presentation properties.
 * @param root0.lines Exact physical lines and character segments.
 * @param root0.index Original line index or an empty aligned cell.
 * @param root0.changed Whether the line script marks this row changed.
 * @param root0.side Original or target column.
 * @param root0.mode Line or code-point comparison.
 */
function DiffCell({ lines, index, changed, side, mode }: {
	lines: PreviewLine[]; index: number | null; changed: boolean; side: EditorSide; mode: ComparisonMode;
}) {
	const tone = side === "before" ? "removed" : "added";
	if(index === null) return <div className="diff-cell empty" aria-label={`No corresponding ${side} line`}><span className="line-number">—</span></div>;
	const line = lines[index];
	return <div className={`diff-cell${changed && mode === "lines" ? ` ${tone}-line` : ""}`}>
		<span className="line-number" aria-label={`${side} line ${index + 1}`}>{index + 1}</span>
		<span className="line-marker" aria-hidden="true">{mode === "lines" && changed ? side === "before" ? "−" : "+" : "·"}</span>
		<pre className="line-content">{mode === "characters" ? line.segments?.map((segment, position) =>
			<span key={position} className={toneClass(segment.kind)}>{segment.text}</span>) : <span>{line.text}</span>}
		<span className={`ending${line.ending !== "LF" ? " special" : ""}${mode === "lines" && changed ? ` ${tone}` : ""}`}
			title={line.ending === "No newline" ? "This line has no terminal newline" : `Original line ending: ${line.ending}`}>
			{mode === "characters" && line.terminator ? <><span>↵ </span>{Array.from(line.terminator).map((point, position) =>
				<span key={position} className={toneClass(line.endingKinds?.[position])}>{point === "\r" ? "CR" : "LF"}</span>)}</>
				: line.ending === "No newline" ? "∅ No newline" : `↵ ${line.ending}`}
		</span>
		</pre>
	</div>;
}

/**
 * Mount exact editors and disposable compiled comparisons within the site shell.
 *
 * @param root0 Route asset configuration.
 * @param root0.artifactBase Published directory containing the unchanged runtime.
 */
export default function MyersWorkbench({ artifactBase }: { artifactBase: string })
{
	const [snapshot, setSnapshot] = useState(() => createEditorSession().getSnapshot());
	const [comparison, setComparison] = useState<ComparisonState>({ status: "pending" });
	const session = useRef<EditorSession | null>(null);
	const controller = useRef<ComparisonController | null>(null);
	const beforeElement = useRef<HTMLTextAreaElement>(null);
	const afterElement = useRef<HTMLTextAreaElement>(null);
	const bindings = useRef<Partial<Record<EditorSide, EditorBinding>>>({});

	useEffect(() => {
		const currentSession = getBrowserEditorSession();
		session.current = currentSession;
		let alive = true;
		let pageHidden = false;
		const composing = new Set<EditorSide>();
		const base = new URL(artifactBase, globalThis.location.href);
		const currentController = createComparisonController({
			loadRuntime: () => import(/* @vite-ignore */ new URL("runtime.mjs", base).href) as Promise<DiffRuntime>
			, onState: state => { if(alive) setComparison(state); }
		});
		controller.current = currentController;
		const reconcileActivity = () => {
			if(document.hidden || pageHidden || composing.size) currentController.suspend();
			else currentController.resume();
		};
		const unsubscribe = currentSession.subscribe(() => {
			const next = currentSession.getSnapshot();
			setSnapshot(next);
			currentController.schedule(next);
		});
		for(const side of sides)
		{
			const element = side === "before" ? beforeElement.current : afterElement.current;
			if(!element) continue;
			bindings.current[side] = attachExactEditor({
				element, session: currentSession, side
				, onComposition: active => {
					if(active) composing.add(side); else composing.delete(side);
					reconcileActivity();
				}
			});
		}
		setSnapshot(currentSession.getSnapshot());
		currentController.schedule(currentSession.getSnapshot(), true);
		if(document.hidden) currentController.suspend();
		const hide = () => { pageHidden = true; currentController.suspend(); };
		const show = (event: PageTransitionEvent) => {
			if(!event.persisted) return;
			pageHidden = false;
			reconcileActivity();
		};
		document.addEventListener("visibilitychange", reconcileActivity);
		globalThis.addEventListener("pagehide", hide);
		globalThis.addEventListener("pageshow", show);
		return () => {
			alive = false;
			unsubscribe();
			currentController.dispose();
			for(const binding of Object.values(bindings.current)) binding?.dispose();
			bindings.current = {};
			controller.current = null;
			session.current = null;
			document.removeEventListener("visibilitychange", reconcileActivity);
			globalThis.removeEventListener("pagehide", hide);
			globalThis.removeEventListener("pageshow", show);
		};
	}, [artifactBase]);

	const resetEditors = () => {
		for(const binding of Object.values(bindings.current)) binding?.sync();
		if(session.current) controller.current?.schedule(session.current.getSnapshot(), true);
	};
	const changeMode = (mode: ComparisonMode) => {
		session.current?.setMode(mode);
		if(session.current) controller.current?.schedule(session.current.getSnapshot(), true);
	};
	const history = (side: EditorSide, direction: number) => {
		session.current?.undo(side, direction);
		bindings.current[side]?.sync(true);
	};
	const failed = comparison.status === "error";
	const pending = comparison.status === "pending";
	const result = comparison.status === "error" ? undefined : comparison.result;
	const ready = comparison.status === "ready";
	const limit = failed && comparison.error instanceof RangeError;
	const errorMessage = failed ? comparison.error instanceof Error ? comparison.error.message : String(comparison.error) : "";
	const mode = snapshot.mode;
	const units = mode === "lines" ? "line" : "character";
	const resultTitle = failed ? limit ? "This comparison has too many items." : "The comparison did not finish."
		: !ready ? "Finding the fewest edits…" : result!.answer.distance ? `${plural(result!.answer.distance, "edit")}. No shorter script exists.` : "The versions match. No edits needed.";
	const previewTitle = failed ? "Edit the input to continue." : !result ? "Two lines change. The rest stays."
		: result.answer.distance ? result.input.mode === "lines" ? "Changed lines, with their original context." : "The edits inside each line." : "Every item is shared.";
	const runtimeStatus = failed ? limit ? "Text exceeds this demo's comparison limit" : "Lean/Wasm could not complete the comparison"
		: !ready ? "Comparing updated text with Lean…" : `Lean/Wasm ready · ${result!.milliseconds.toFixed(2)} ms ${units} solve`;

	return <>
		<header className="hero"><div><p className="eyebrow"><span className="pulse" /> Lean 4 → WebAssembly</p><h1>Compare two versions.<br /><em>Find the fewest edits.</em></h1></div><p className="lede">A diff keeps the shared text and identifies what to remove or add. Myers finds a shortest sequence of those edits, whether the items are lines of code, characters, or another kind of token.</p></header>
		<section className="reading-guide" aria-labelledby="guide-title"><div><p className="label">How to read it</p><h2 id="guide-title">Keep, remove,<br /><em>or insert.</em></h2></div><ol><li><span>1</span><div><b>Edit either version</b><p>The compiled Lean solver updates the comparison as you type. Unchanged text stays visible for context.</p></div></li><li><span>2</span><div><b>Choose the unit</b><p>Line mode compares whole lines. Character mode exposes the smaller edits within them.</p></div></li><li><span>3</span><div><b>Count removals and additions</b><p>A replacement costs two edits: remove the old item, then insert the new one. Matching items cost nothing.</p></div></li></ol></section>
		<section className="theme-lab diff-lab" aria-labelledby="lab-title">
			<div className="lab-heading"><div><p className="label">Interactive proof adapter</p><h2 id="lab-title">Text comparison workbench</h2></div><p id="runtime-status" className={`runtime-status${failed ? " failed" : ""}`} role="status">{runtimeStatus}</p></div>
			<div className="diff-workbench">
				<div className="result-summary"><div><p className="label">Shortest insertion / deletion script</p><h3 id="result-title">{resultTitle}</h3><p id="result-copy">{failed ? errorMessage : !ready ? "The comparison updates as you type. No Run button is needed."
					: mode === "lines" ? "The total counts line removals and additions. A changed line can appear opposite its replacement, but still costs two edits."
						: "The total counts individual Unicode code-point removals and additions. Highlighted characters come from that shortest script; Lean's line comparison aligns the rows."}</p></div>
				<dl className="summary-metrics"><div><dt>Minimum edits</dt><dd id="edit-count">{ready ? result!.answer.distance : "—"}</dd></div><div><dt>Removed</dt><dd id="delete-count">{ready ? result!.details.removed : "—"}</dd></div><div><dt>Added</dt><dd id="insert-count">{ready ? result!.details.added : "—"}</dd></div></dl>
				</div>
				<div className="diff-toolbar"><label className="preset-label" htmlFor="example">Example<select id="example" value={snapshot.preset} onChange={event => {
					const preset = PRESETS.find(item => item.id === event.target.value);
					if(preset)
					{ session.current?.preset(preset); resetEditors(); }
				}}>{PRESETS.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}<option value="custom" hidden>Custom text</option></select></label>
				<div className="mode-controls" role="group" aria-label="Comparison unit"><button type="button" data-mode="lines" aria-pressed={mode === "lines"} onClick={() => changeMode("lines")}>Lines</button><button type="button" data-mode="characters" aria-pressed={mode === "characters"} onClick={() => changeMode("characters")}>Characters</button></div>
				<button id="swap-text" className="secondary" type="button" onClick={() => { session.current?.swap(); resetEditors(); }}>Swap versions <span aria-hidden="true">⇄</span></button>
				</div>
				<p id="mode-help" className="mode-help">{mode === "lines" ? "Each exact line, including its ending, is one item. Replacing a line counts as one removal plus one addition."
					: "Characters are Unicode code points, not joined symbols. A combined accent or emoji can contain several. Replacing one code point costs two edits."}</p>
				<div className="text-editors">{sides.map(side => <section key={side} className="text-editor">
					<div className="editor-heading"><label htmlFor={`${side}-text`}>{side === "before" ? "Before" : "After"}</label><span id={`${side}-meta`}>{plural(tokenize(snapshot[side], "lines").length, "line")} · {Array.from(snapshot[side]).length} code points</span></div>
					<div className="editor-actions" role="group" aria-label={`${side === "before" ? "Before" : "After"} edit history`}><button type="button" className="secondary" data-undo={side} disabled={!snapshot.history[side].undo} onClick={() => history(side, -1)}>Undo</button><button type="button" className="secondary" data-redo={side} disabled={!snapshot.history[side].redo} onClick={() => history(side, 1)}>Redo</button><span title="Undo retains up to 100 edits and 8 MiB per version. Oldest history is dropped first; current text is never truncated.">Edits stay in this tab.</span></div>
					<textarea ref={side === "before" ? beforeElement : afterElement} id={`${side}-text`} defaultValue={textareaValue(PRESETS[0][side])} rows={8} spellCheck={false} autoCapitalize="off" autoComplete="off" aria-describedby="input-note" aria-label={`${side === "before" ? "Before" : "After"} text`} />
				</section>)}</div>
				<p id="input-note" className="input-note">Spaces, tabs, accents, and line endings are significant. Newline badges below distinguish LF, CRLF, CR, and a missing terminal newline.</p>
				<div className="preview-heading"><div><p className="label">Aligned comparison</p><h3 id="preview-title">{previewTitle}</h3></div><div className="diff-legend"><span><i className="removed" aria-hidden="true">−</i>Removed</span><span><i className="added" aria-hidden="true">+</i>Added</span><span><i className="kept" aria-hidden="true">·</i>Kept</span></div></div>
				<div className="preview-columns" aria-hidden="true"><span>Before</span><span>After</span></div>
				<div id="diff-preview" className="diff-preview" tabIndex={0} role="region" aria-label="Aligned before and after comparison" aria-busy={pending}>
					{failed ? <p className="preview-error">{errorMessage}</p> : result ? result.preview.rows.length ? result.preview.rows.map((row, index) => <div key={index} className="diff-row"><DiffCell lines={result.preview.beforeLines} index={row.before} changed={row.changed} side="before" mode={result.input.mode} /><DiffCell lines={result.preview.afterLines} index={row.after} changed={row.changed} side="after" mode={result.input.mode} /></div>)
						: <p className="preview-empty">Both versions are empty. There is nothing to remove or add.</p> : <p className="preview-empty">Lean is preparing the first comparison.</p>}
				</div>
				<div className={`verification-row${failed ? " failed" : pending ? " pending" : ""}`}><span id="replay-mark" className="replay-mark" aria-hidden="true">{failed ? "!" : ready ? "✓" : "…"}</span><div><b id="replay-title">{failed ? "No new script was returned" : ready ? "Script reproduces After exactly." : "Checking the updated script"}</b><p id="replay-copy">{failed ? "Both input strings remain intact. Shorten them or choose line mode; the demo never truncates your text."
					: ready ? `The browser replayed all ${result!.answer.operations.length} operations and recovered the exact target string, including its whitespace and line endings.`
						: "The previous preview stays visible until Lean finishes the new comparison."}</p></div><span id="kept-count" className="kept-count">{ready ? `${result!.details.kept} ${mode === "lines" ? "lines" : "code points"} kept` : "— kept"}</span></div>
				<p id="interaction-status" className="sr-only" role="status" aria-live="polite">{ready ? `${plural(result!.answer.distance, "edit")}: ${result!.details.removed} removed and ${result!.details.added} added. The script reconstructs the target exactly.` : ""}</p>
				{failed && !limit && <button className="retry-comparison" type="button" onClick={() => { if(session.current) controller.current?.schedule(session.current.getSnapshot(), true); }}>Retry comparison</button>}
			</div>
		</section>
	</>;
}
