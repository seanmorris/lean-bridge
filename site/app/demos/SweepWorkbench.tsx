/**
 * Render exact Lean frame pairs with route-owned motion, editing, and solver lifetimes.
 *
 * @file
 */

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { WORLD, BODY_COLORS } from "../../../demos/lean-sweep-and-prune/scenario.mjs";
import { createSceneSession, getBrowserSceneSession } from "../../../demos/lean-sweep-and-prune/scene-session.mjs";
import type { SceneSession } from "../../../demos/lean-sweep-and-prune/scene-session.mjs";
import { createFrameController } from "../../../demos/lean-sweep-and-prune/frame-controller.mjs";
import type { ReadyFrame, SweepRuntime } from "../../../demos/lean-sweep-and-prune/frame-controller.mjs";
import "./sweep.css";

type Direction = "left" | "right" | "up" | "down";
interface Drag { id: number; pointerId: number; offsetX: number; offsetY: number; }
interface Activity { playing: boolean; active: boolean; drag: number | null; scan: number; }
interface Actions {
	select(id: number, focus?: boolean): void;
	start(event: ReactPointerEvent<SVGSVGElement>): void;
	move(event: ReactPointerEvent<SVGSVGElement>): void;
	finish(pointerId?: number): void;
	nudge(direction: Direction, amount?: number): void;
	toggle(): void;
	step(): void;
	axis(axis: number): void;
	replay(): void;
	generate(example?: boolean): void;
}
const pairList = (values: Uint32Array | undefined): [number, number][] => {
	const pairs: [number, number][] = [];
	if(values) for(let index = 0; index < values.length; index += 2) pairs.push([values[index], values[index + 1]]);
	return pairs;
};
const pairKey = (left: number, right: number) => `${Math.min(left, right)}:${Math.max(left, right)}`;
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
const colorStyle = (id: number) => ({ "--body-color": BODY_COLORS[id % BODY_COLORS.length] }) as CSSProperties;

/**
 * Keep the SVG and controls React-owned while each effect owns its pending work.
 *
 * @param root0 Published artifact configuration.
 * @param root0.artifactBase Directory containing the unchanged solver.
 */
export default function SweepWorkbench({ artifactBase }: {artifactBase: string})
{
	const [snapshot, setSnapshot] = useState(() => createSceneSession().getSnapshot());
	const [frame, setFrame] = useState<ReadyFrame | null>(null);
	const [frameNumber, setFrameNumber] = useState(0);
	const [failure, setFailure] = useState("");
	const [activity, setActivity] = useState<Activity>({ playing: false, active: false, drag: null, scan: 1 });
	const [announcement, announce] = useState("");
	const scene = useRef<SVGSVGElement>(null);
	const seedInput = useRef<HTMLInputElement>(null);
	const session = useRef<SceneSession | null>(null);
	const actions = useRef<Actions | null>(null);

	useEffect(() => {
		const svg = scene.current;
		if(!svg) return;
		const currentSession = getBrowserSceneSession();
		session.current = currentSession;
		const reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
		let alive = true;
		let pageHidden = false;
		let inView = true;
		let playing = false;
		let ready = false;
		let drag: Drag | null = null;
		let handle = 0;
		let lastTime = 0;
		let lastMotion = 0;
		let scan = 1;
		let sweepStart = 0;
		let inputRevision = currentSession.getSnapshot().revision;
		const active = () => alive && !pageHidden && !document.hidden && inView;
		const moving = () => active() && playing && !drag;
		const renderActivity = () => { if(alive) setActivity({ playing, active: moving(), drag: drag?.id ?? null, scan }); };
		const pause = () => { playing = false; lastTime = 0; lastMotion = 0; renderActivity(); };
		const base = new URL(artifactBase, globalThis.location.href);
		const controller = createFrameController({
			loadRuntime: () => import(/* @vite-ignore */ new URL("runtime.mjs", base).href) as Promise<SweepRuntime>
			, onState: state => {
				if(!alive) return;
				if(state.status === "error")
				{
					ready = false;
					pause();
					setFailure(state.error instanceof Error ? state.error.message : String(state.error));
				}
				else
				{
					ready = true;
					setFailure("");
					setFrame(state);
					setFrameNumber(value => value + 1);
				}
			}
		});
		const unsubscribe = currentSession.subscribe(() => {
			const next = currentSession.getSnapshot();
			setSnapshot(next);
			if(next.revision !== inputRevision)
			{
				inputRevision = next.revision;
				controller.request(next);
			}
		});
		const requestTick = () => { if(!handle && active()) handle = globalThis.requestAnimationFrame(tick); };
		const tick = (time: number) => {
			handle = 0;
			if(!active()) return;
			if(moving() && !controller.isBusy() && time - lastMotion >= 30)
			{
				currentSession.advance(Math.min(.05, (time - (lastMotion || lastTime || time)) / 1000));
				lastMotion = time;
			}
			lastTime = time;
			if(scan < 1)
			{ scan = Math.min(1, (time - sweepStart) / 1400); renderActivity(); }
			if(moving() || scan < 1) requestTick();
		};
		const replay = () => {
			sweepStart = performance.now();
			scan = reducedMotion.matches ? 1 : 0;
			renderActivity();
			requestTick();
		};
		const select = (id: number, focus = false) => {
			currentSession.select(id);
			if(focus) svg.querySelector<SVGGElement>(`[data-body="${id}"]`)?.focus({ preventScroll: true });
		};
		const point = (event: ReactPointerEvent<SVGSVGElement>) => {
			const matrix = svg.getScreenCTM();
			if(!matrix) return null;
			const location = svg.createSVGPoint();
			location.x = event.clientX;
			location.y = event.clientY;
			return location.matrixTransform(matrix.inverse());
		};
		const finish = (pointerId = drag?.pointerId) => {
			if(!drag || drag.pointerId !== pointerId) return;
			const { id } = drag;
			drag = null;
			if(svg.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId);
			const label = currentSession.getSnapshot().bodies[id]?.label;
			currentSession.update({ hint: `Box ${label} placed. Use the arrow keys for a precise adjustment.` });
			renderActivity();
			announce(`Box ${label} placed.`);
		};
		actions.current = {
			select, finish, replay
			, start: event => {
				const node = (event.target as Element).closest<SVGGElement>("[data-body]");
				if(!ready || !active() || !node || event.button !== 0 || drag) return;
				const location = point(event);
				if(!location) return;
				event.preventDefault();
				pause();
				const id = Number(node.dataset.body);
				select(id, true);
				const body = currentSession.getSnapshot().bodies[id];
				drag = { id, pointerId: event.pointerId, offsetX: location.x - body.x, offsetY: location.y - body.y };
				svg.setPointerCapture(event.pointerId);
				currentSession.update({ hint: `Moving ${body.label}. Lean updates its candidate and overlap pairs as you drag.` });
				renderActivity();
			}
			, move: event => {
				if(!drag || event.pointerId !== drag.pointerId) return;
				const location = point(event);
				if(location) currentSession.move(drag.id, location.x - drag.offsetX, location.y - drag.offsetY);
			}
			, nudge: (direction, amount = 6) => {
				if(!ready) return;
				pause();
				const { bodies, selected } = currentSession.getSnapshot();
				const body = bodies[selected];
				currentSession.move(selected, body.x + (direction === "left" ? -amount : direction === "right" ? amount : 0), body.y + (direction === "up" ? -amount : direction === "down" ? amount : 0));
				currentSession.update({ hint: `Box ${body.label} moved ${direction}. Touching an edge counts as overlap.` });
			}
			, toggle: () => {
				if(!ready) return;
				playing = !playing;
				lastTime = performance.now();
				lastMotion = 0;
				renderActivity();
				requestTick();
				announce(playing ? "Motion playing. Drag a box to pause." : "Motion paused. You can still drag any box.");
			}
			, step: () => {
				if(ready && !playing)
				{ currentSession.advance(.4); announce("Advanced the scene by four tenths of a second."); }
			}
			, axis: axis => {
				if(currentSession.getSnapshot().axis === axis) return;
				currentSession.update({ axis }, true);
				replay();
				announce(`Sweeping ${axis === 0 ? "X horizontally" : "Y vertically"}. Final overlap pairs do not depend on this choice.`);
			}
			, generate: example => {
				if(!example && !seedInput.current?.reportValidity()) return;
				finish();
				pause();
				ready = false;
				setFrame(null);
				setFrameNumber(0);
				if(example) currentSession.reset(); else currentSession.generate();
				replay();
				const next = currentSession.getSnapshot();
				announce(example ? "Six-box example restored. A and B are candidates; C and D overlap." : `Generated ${next.bodies.length} boxes with seed ${next.seed}. Motion is paused.`);
			}
		};
		const reconcile = () => {
			if(handle) globalThis.cancelAnimationFrame(handle);
			handle = 0;
			lastTime = 0;
			lastMotion = 0;
			if(pageHidden || document.hidden) controller.suspend(); else controller.resume();
			if(active())
			{
				sweepStart = performance.now() - scan * 1400;
				requestTick();
			}
			else finish();
			renderActivity();
		};
		const observer = new globalThis.IntersectionObserver(entries => { inView = entries[0].isIntersecting; reconcile(); }, { threshold: 0 });
		const hide = () => { pageHidden = true; reconcile(); };
		const show = (event: PageTransitionEvent) => {
			if(event.persisted)
			{ pageHidden = false; reconcile(); }
		};
		const changeMotion = () => {
			if(reducedMotion.matches)
			{ pause(); scan = 1; renderActivity(); }
		};
		document.addEventListener("visibilitychange", reconcile);
		globalThis.addEventListener("pagehide", hide);
		globalThis.addEventListener("pageshow", show);
		reducedMotion.addEventListener("change", changeMotion);
		observer.observe(svg);
		setSnapshot(currentSession.getSnapshot());
		controller.request(currentSession.getSnapshot());
		if(document.hidden) controller.suspend();
		replay();
		return () => {
			alive = false;
			if(handle) globalThis.cancelAnimationFrame(handle);
			controller.dispose();
			unsubscribe();
			if(drag && svg.hasPointerCapture(drag.pointerId)) svg.releasePointerCapture(drag.pointerId);
			if(drag) currentSession.update({ hint: `Box ${currentSession.getSnapshot().bodies[drag.id].label} placed. Use the arrow keys for a precise adjustment.` });
			drag = null;
			observer.disconnect();
			document.removeEventListener("visibilitychange", reconcile);
			globalThis.removeEventListener("pagehide", hide);
			globalThis.removeEventListener("pageshow", show);
			reducedMotion.removeEventListener("change", changeMotion);
			session.current = null;
			actions.current = null;
		};
	}, [artifactBase]);

	const displayed = frame?.input.bodies ?? snapshot.bodies;
	const axis = frame?.input.axis ?? snapshot.axis;
	const axisName = axis === 0 ? "X" : "Y";
	const extent = axis === 0 ? WORLD.width : WORLD.height;
	const selected = Math.min(snapshot.selected, displayed.length - 1);
	const selectedBody = displayed[selected];
	const candidates = pairList(frame?.answer.candidates);
	const overlaps = pairList(frame?.answer.overlaps);
	const confirmed = new Set(overlaps.map(pair => pairKey(...pair)));
	const selectedPairs = candidates.filter(pair => pair.includes(selected));
	const related = new Set([selected, ...selectedPairs.flat()]);
	const overlapping = new Set(overlaps.flat());
	const links = candidates.filter(pair => snapshot.allLinks || pair.includes(selected));
	const scanning = activity.scan < 1;
	const position = activity.scan * extent;
	const activeSpans = displayed.filter(body => {
		const start = axis === 0 ? body.x : body.y;
		return scanning && start <= position && position <= start + (axis === 0 ? body.width : body.height);
	});
	const activeIds = new Set(activeSpans.map(body => body.id));
	const allCount = displayed.length * (displayed.length - 1) / 2;
	const ready = !!frame && !failure;
	const dragged = activity.drag === null ? null : snapshot.bodies[activity.drag];
	const summary = `Box ${selectedBody.label}: ${plural(selectedPairs.length, "candidate")}, ${plural(selectedPairs.filter(pair => confirmed.has(pairKey(...pair))).length, "overlap")}.`;

	return <>
		<header className="hero"><div><p className="eyebrow"><span className="pulse" /> Lean 4 → WebAssembly</p><h1>Move the boxes.<br /><em>Skip impossible pairs.</em></h1></div><p className="lede">A game can have thousands of objects, but most are nowhere near each other. Sweep-and-prune uses one axis to discard separated pairs, then checks the remaining boxes on every axis.</p></header>
		<section className="reading-guide" aria-labelledby="guide-title"><div><p className="label">How to read it</p><h2 id="guide-title">One axis first.<br /><em>Every axis next.</em></h2></div><ol><li><span>1</span><div><b>Drag any box</b><p>Start with A and B. Their horizontal spans overlap, but there is a gap between them vertically.</p></div></li><li><span>2</span><div><b>Follow the projection</b><p>The strip places each box on the chosen axis. Overlapping spans become candidate pairs.</p></div></li><li><span>3</span><div><b>Check the other axis</b><p>C and D overlap in both directions. Lean keeps that pair and rejects candidates that still have a gap.</p></div></li></ol></section>
		<section className="theme-lab sweep-lab" aria-labelledby="lab-title">
			<div className="lab-heading"><div><p className="label">Interactive proof adapter</p><h2 id="lab-title">Collision pair workbench</h2></div><p id="runtime-status" className={`runtime-status${failure ? " failed" : ""}`} role="status">{failure || (ready ? "Lean/Wasm ready · exact current-frame pairs" : "Loading Lean/Wasm…")}</p></div>
			<div className="sweep-workbench">
				<div className="pair-funnel" aria-label="Pair reduction"><div><span>All possible pairs</span><b id="all-count">{frame ? allCount : "—"}</b></div><i aria-hidden="true">→</i><div className="candidate-metric"><span id="candidate-label">{axisName}-axis candidates</span><b id="candidate-count">{frame ? candidates.length : "—"}</b></div><i aria-hidden="true">→</i><div className="overlap-metric"><span>Overlapping boxes</span><b id="overlap-count">{frame ? overlaps.length : "—"}</b></div><p id="reduction-note">{frame ? `The ${axisName} sweep skips ${plural(allCount - candidates.length, "pair")}. Lean checks the remaining ${candidates.length} on both axes.` : "Lean checks the scene before showing any pair."}</p></div>
				<div className="sweep-layout"><div className="scene-panel">
					<div className="scene-heading"><span id="scene-state" className={activity.active ? "running" : undefined}><i />{dragged ? `Moving ${dragged.label} · release to place` : activity.active ? "Playing · drag to pause" : activity.playing ? "Motion suspended while offscreen" : "Paused · drag a box"}</span><span id="frame-number">Frame {frameNumber}</span></div>
					<div className="scene-wrap"><svg ref={scene} id="scene" className={`scene${dragged ? " dragging" : ""}`} viewBox="0 0 900 480" aria-label="Movable rectangles. Tab to a box and use arrow keys to move it." role="group"
						onPointerDown={event => actions.current?.start(event)} onPointerMove={event => actions.current?.move(event)} onPointerUp={event => actions.current?.finish(event.pointerId)} onPointerCancel={event => actions.current?.finish(event.pointerId)} onLostPointerCapture={event => actions.current?.finish(event.pointerId)}>
						<defs><pattern id="scene-grid" width="45" height="40" patternUnits="userSpaceOnUse"><path d="M 45 0 L 0 0 0 40" fill="none" stroke="#23364b" strokeWidth="1" /></pattern></defs><rect width="900" height="480" fill="url(#scene-grid)" />
						<g id="axis-shading">{frame && <rect className="axis-band" x={axis === 0 ? selectedBody.x : 0} y={axis === 0 ? 0 : selectedBody.y} width={axis === 0 ? selectedBody.width : WORLD.width} height={axis === 0 ? WORLD.height : selectedBody.height} />}</g>
						<g id="pair-links">{links.map(([left, right]) => <line key={pairKey(left, right)} data-pair={pairKey(left, right)} className={`pair-link${confirmed.has(pairKey(left, right)) ? " confirmed" : ""}${activeIds.has(left) && activeIds.has(right) ? " sweep-active" : ""}`} x1={displayed[left].x + displayed[left].width / 2} y1={displayed[left].y + displayed[left].height / 2} x2={displayed[right].x + displayed[right].width / 2} y2={displayed[right].y + displayed[right].height / 2} />)}</g>
						<g id="overlap-regions">{overlaps.filter(pair => snapshot.allLinks || pair.includes(selected)).map(([left, right]) => {
							const a = displayed[left]; const b = displayed[right]; const x = Math.max(a.x, b.x); const y = Math.max(a.y, b.y);
							return <rect key={pairKey(left, right)} className="overlap-region" x={x} y={y} width={Math.min(a.x + a.width, b.x + b.width) - x} height={Math.min(a.y + a.height, b.y + b.height) - y} />;
						})}</g>
						<g id="bodies">{displayed.map(body => <g key={body.id} data-body={body.id} tabIndex={0} role="button" style={colorStyle(body.id)} transform={`translate(${body.x} ${body.y})`} aria-pressed={body.id === selected} aria-label={`Box ${body.label}, left ${body.x}, top ${body.y}. ${overlapping.has(body.id) ? "Overlapping another box. " : ""}Use arrow keys to move.`} className={`body${body.id === selected ? " is-selected" : ""}${overlapping.has(body.id) ? " is-overlapping" : ""}${!snapshot.allLinks && !related.has(body.id) ? " dimmed" : ""}`} onFocus={() => { if(body.id !== snapshot.selected) actions.current?.select(body.id); }} onKeyDown={event => {
							if(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
							{ event.preventDefault(); actions.current?.select(body.id); actions.current?.nudge(event.key.slice(5).toLowerCase() as Direction, event.shiftKey ? 24 : 3); }
							else if(event.key === "Enter" || event.key === " ")
							{ event.preventDefault(); actions.current?.select(body.id); }
						}}><rect className="body-box" width={body.width} height={body.height} rx="3" /><text className="body-label" x={body.width / 2} y={body.height / 2}>{body.label}</text></g>)}</g>
						<g id="drag-preview">{dragged && <rect className="drag-outline" x={Math.round(dragged.x)} y={Math.round(dragged.y)} width={dragged.width} height={dragged.height} rx="3" />}</g>
					</svg><div id="scene-hint" className="scene-hint">{snapshot.hint}</div></div>
					<div className="scene-legend"><span><i className="candidate-link" />Candidate on chosen axis</span><span><i className="overlap-link" />Overlap on every axis</span><span className="legend-note">Touching edges count as overlap.</span></div>
					<div className="projection-heading"><div><p className="label">The one-dimensional sweep</p><h3 id="projection-title">{axis === 0 ? "Horizontal spans, left to right" : "Vertical spans, top to bottom"}</h3></div><button id="replay-sweep" className="secondary" type="button" onClick={() => actions.current?.replay()}>Replay sweep <span aria-hidden="true">→</span></button></div>
					<div id="projection" className="projection" role="region" aria-label="Body spans on the selected axis"><div className="projection-scale"><span>0</span><span>{axis === 0 ? "X → 900" : "Y ↓ 480"}</span></div>{displayed.map(body => <div key={body.id} style={colorStyle(body.id)} className={`projection-lane${body.id === selected ? " is-selected" : ""}${!snapshot.allLinks && !related.has(body.id) ? " dimmed" : ""}${activeIds.has(body.id) ? " sweep-active" : ""}`}><button type="button" data-select={body.id} aria-label={`Inspect box ${body.label}`} onClick={() => actions.current?.select(body.id, true)}>{body.label}</button><div className="projection-track"><div className="projection-span" style={{ left: `${(axis === 0 ? body.x : body.y) / extent * 100}%`, width: `${(axis === 0 ? body.width : body.height) / extent * 100}%` }} /></div></div>)}<div className="projection-scan" hidden={!scanning || !frame} style={{ left: `calc(43px + (100% - 59px) * ${activity.scan})` }} /></div>
					<p id="sweep-status" className="sweep-status">{!frame ? "Replay the cursor to follow active spans." : scanning ? `At ${axisName} ${Math.round(position)}: ${activeSpans.length ? `${activeSpans.slice(0, 5).map(body => body.label).join(", ")}${activeSpans.length > 5 ? ` + ${activeSpans.length - 5} more` : ""} active` : "no active spans"}.` : `Scan complete: ${plural(candidates.length, "axis candidate")} returned by Lean.`}</p>
					<p id="projection-note" className="projection-note">{axis === 0 ? "Each row shows the same box flattened onto X. Vertical position is ignored in this first pass." : "Each row plots a box's vertical span from top (left end) to bottom (right end). Horizontal position is ignored in this first pass."}</p>
				</div><aside className="scene-controls" aria-label="Scene controls">
					<div className="motion-controls"><button id="toggle-motion" className="play-button" type="button" disabled={!ready} onClick={() => actions.current?.toggle()}><span aria-hidden="true">{activity.playing ? "Ⅱ" : "▶"}</span>{activity.playing ? "Pause motion" : "Play motion"}</button><button id="step-motion" className="secondary" type="button" disabled={!ready || activity.playing} onClick={() => actions.current?.step()}>Step <span aria-hidden="true">▹</span></button></div>
					<p className="motion-note">Boxes pass through each other. This demo finds pairs; it does not simulate a collision response.</p>
					<div className="control-section"><p className="label">Choose the sweep axis</p><div className="axis-controls" role="group" aria-label="Sweep axis">{[0, 1].map(value => <button key={value} type="button" data-axis={value} aria-pressed={snapshot.axis === value} onClick={() => actions.current?.axis(value)}>{value === 0 ? "X" : "Y"} <span>{value === 0 ? "horizontal" : "vertical"}</span></button>)}</div><p className="control-note">Changing the axis can change the candidate count. The final overlap pairs stay the same.</p></div>
					<div className="control-section selected-panel"><label className="label" htmlFor="selected-body">Inspect a box</label><div className="selection-controls"><select id="selected-body" value={snapshot.selected} aria-describedby="selection-help" onChange={event => actions.current?.select(Number(event.target.value))}>{snapshot.bodies.map(body => <option key={body.id} value={body.id}>Box {body.label}</option>)}</select><button id="show-all" className="secondary" type="button" aria-pressed={snapshot.allLinks} onClick={() => session.current?.update({ allLinks: !snapshot.allLinks })}>{snapshot.allLinks ? "All links ✓" : "All links"}</button></div><p id="selection-help" className="control-note">Select a box to focus its links. Arrow keys move the focused box; Shift moves farther.</p><div id="selection-summary" className="selection-summary">{frame ? summary : "Checking A's neighbors…"}</div><ul id="selected-pairs" className="selected-pairs">{selectedPairs.map(pair => <li key={pairKey(...pair)}><span className={`pair-badge${confirmed.has(pairKey(...pair)) ? " confirmed" : ""}`}>{pair.map(id => displayed[id].label).join("·")}</span><span>{confirmed.has(pairKey(...pair)) ? "Overlaps on X and Y" : `Gap on ${axis === 0 ? "Y" : "X"}; rejected`}</span></li>)}{frame && !selectedPairs.length && <li>No span overlaps on {axisName}. Lean skips all {displayed.length - 1} pairs for this box.</li>}</ul><div className="nudge-controls" role="group" aria-label="Move selected box">{(["left", "up", "down", "right"] as Direction[]).map((direction, index) => <button key={direction} data-nudge={direction} className="secondary" type="button" disabled={!ready} aria-label={`Move selected box ${direction}`} onClick={() => actions.current?.nudge(direction)}>{["←", "↑", "↓", "→"][index]}</button>)}</div></div>
					<div className="control-section scene-generator"><p className="label">Try another arrangement</p><label htmlFor="scene-seed">Seed<input ref={seedInput} id="scene-seed" type="number" min="0" max="4294967295" step="1" required value={snapshot.seed} onInput={event => session.current?.update({ seed: event.currentTarget.value, seedEdited: true })} onChange={event => session.current?.update({ seed: event.target.value, seedEdited: true })} onKeyDown={event => { if(event.key === "Enter") actions.current?.generate(); }} /></label><label htmlFor="body-count">Boxes<select id="body-count" value={snapshot.count} onChange={event => session.current?.update({ count: Number(event.target.value) })}>{[6, 12, 18, 24].map(count => <option key={count} value={count}>{count} boxes</option>)}</select></label><div className="scene-actions"><button id="new-scene" type="button" onClick={() => actions.current?.generate()}>New scene ↻</button><button id="reset-scene" className="secondary" type="button" onClick={() => actions.current?.generate(true)}>Example</button></div><p id="seed-note" className="control-note">{snapshot.seedNote}</p></div>
				</aside></div>
				<div className="frame-receipt"><span className="frame-check" aria-hidden="true">{failure ? "!" : "✓"}</span><div><b id="frame-title">{failure ? "The current frame did not finish." : "Every displayed pair comes from compiled Lean."}</b><p id="frame-copy">{failure ? "No browser fallback decides the pairs. Reload to try the compiled solver again." : "The browser moves the boxes and draws the scene. Lean returns the candidate pairs and the exact current-frame overlaps."}</p></div><span id="frame-time">{frame ? `${frame.milliseconds < .01 ? "<0.01" : frame.milliseconds.toFixed(2)} ms` : "— ms"}</span></div>
				<p id="interaction-status" className="sr-only" role="status" aria-live="polite">{announcement}</p>
			</div>
		</section>
	</>;
}
