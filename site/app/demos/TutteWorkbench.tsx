/**
 * Linked geometric and electrical views of an exactly checked construction.
 *
 * @file
 */
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { PRESETS, certificateInput, circuitLayout, createScene, findCompoundPart, wirePoints } from "../../../demos/lean-tutte/scenario.mjs";
import { availableScales } from "../../../demos/lean-tutte/constructions.mjs";
import type { Checker, CertificateResult } from "../../../demos/lean-tutte/runtime.mjs";
import "./tutte.css";

const colors = ["#86d9c2", "#e9bf76", "#aaa4ed", "#79c9e6", "#e79d99", "#b3d080", "#dfb0df", "#f2d99f", "#83b5e4", "#aca6db", "#e7aa7d", "#97c2ac"];
const steps = ["One square, one wire", "Why the lengths balance", "What makes it simple?"];
const simplePresets = PRESETS.filter(item => item.kind === "simple");
const orders = [...new Set(simplePresets.map(item => item.order))];
type Scene = ReturnType<typeof createScene>;

/** Reachability for highlighting; the Lean checker verifies every deletion pair. */
function components(scene: Scene, removed: number[])
{
	const groups = new Map<number, number>();
	const links = [...scene.tiles.map(tile => [tile.top, tile.bottom]), [0, scene.nodes.length - 1]];
	let count = 0;
	for(const node of scene.nodes)
	{
		if(removed.includes(node.id) || groups.has(node.id)) continue;
		const queue = [node.id]; groups.set(node.id, count++);
		for(const current of queue)
			for(const [a, b] of links)
			{
				const next = current === a ? b : current === b ? a : -1;
				if(next >= 0 && !removed.includes(next) && !groups.has(next))
				{ groups.set(next, count - 1); queue.push(next); }
			}
	}
	return { groups, count };
}

/** Keep all diagram controls operable with either a pointer or a keyboard. */
function activate(event: KeyboardEvent<SVGGElement>, action: () => void)
{
	if(event.key === "Enter" || event.key === " ")
	{ event.preventDefault(); action(); }
}

/** React owns selection, animation, and the lifetime of a loaded checker. */
export default function TutteWorkbench({ artifactBase }: { artifactBase: string })
{
	const [presetId, setPresetId] = useState("moron");
	const [scale, setScale] = useState(1);
	const [step, setStep] = useState(0);
	const [tileId, setTileId] = useState(0);
	const [nodeId, setNodeId] = useState(3);
	const [broken, setBroken] = useState<number | null>(null);
	const [removed, setRemoved] = useState<number[]>([]);
	const [overlay, setOverlay] = useState(false);
	const [playing, setPlaying] = useState(false);
	const [checker, setChecker] = useState<Checker | null>(null);
	const [loadError, setLoadError] = useState("");
	const [attempt, setAttempt] = useState(0);
	const [checked, setChecked] = useState<{ key: string; result: CertificateResult } | null>(null);
	const presetIndex = Math.max(0, PRESETS.findIndex(item => item.id === presetId));
	const preset = PRESETS[presetIndex];
	const scales = availableScales(preset);
	const scene = useMemo(() => createScene(preset, scale), [preset, scale]);
	const diagram = useMemo(() => circuitLayout(scene), [scene]);
	const compound = useMemo(() => findCompoundPart(scene), [scene]);
	const connected = useMemo(() => components(scene, removed), [scene, removed]);
	const key = `${presetId}:${scale}:${broken}`;
	const result = checked?.key === key ? checked.result : null;
	const tile = scene.tiles[tileId] ?? scene.tiles[0];
	const node = scene.nodes[nodeId] ?? scene.nodes[1];
	const incoming = scene.tiles.filter(square => square.bottom === node.id);
	const outgoing = scene.tiles.filter(square => square.top === node.id);
	const terms = (tiles: typeof scene.tiles) => tiles.map(s => s.side + (broken === s.id ? 1 : 0)).join(" + ");
	const zoom = Math.min(326 / scene.width, 326 / scene.height);
	const offsetX = (420 - scene.width * zoom) / 2, offsetY = (420 - scene.height * zoom) / 2;
	const tx = (x: number) => offsetX + x * zoom, ty = (y: number) => offsetY + y * zoom;
	const gy = (id: number) => diagram.nodes[id].y;
	const gx = (id: number) => diagram.nodes[id].x;
	const selectedWire = (square: typeof tile) => step === 0 ? square.id === tile.id : step === 1 ? square.top === node.id || square.bottom === node.id : true;
	const changePreset = (id: string) => {
		const next = PRESETS.find(item => item.id === id);
		if(!next) return;
		setPresetId(id); setScale(previous => Math.min(previous, availableScales(next).at(-1) ?? 1));
		setTileId(0); setNodeId(3); setBroken(null); setRemoved([]); setPlaying(false);
	};
	const chooseStep = (value: number) => { setStep(value); setPlaying(false); setBroken(null); setRemoved([]); };
	const chooseNode = (id: number) => {
		if(step === 2) setRemoved(previous => previous.includes(id) ? previous.filter(n => n !== id) : previous.length < 2 ? [...previous, id] : previous);
		else if(id > 0 && id < scene.nodes.length - 1)
		{ setNodeId(id); setStep(1); setPlaying(false); setBroken(null); }
	};

	useEffect(() => {
		let active = true;
		setLoadError("");
		const runtimeUrl = new URL(`${artifactBase}runtime.mjs`, globalThis.location.href);
		if(attempt) runtimeUrl.searchParams.set("retry", String(attempt));
		void import(/* @vite-ignore */ runtimeUrl.href).then(module => module.createChecker()).then((loaded: Checker) => {
			if(active) setChecker(() => loaded);
		}).catch(error => { if(active) setLoadError(error instanceof Error ? error.message : String(error)); });
		return () => { active = false; };
	}, [artifactBase, attempt]);
	useEffect(() => {
		if(!checker) return;
		try
		{ setChecked({ key, result: checker(certificateInput(scene, broken)) }); }
		catch(error)
		{ setLoadError(error instanceof Error ? error.message : String(error)); }
	}, [checker, scene, broken, key]);
	useEffect(() => {
		if(!playing) return;
		const timer = setTimeout(() => {
			setStep(Math.min(2, step + 1));
			if(step >= 1) setPlaying(false);
		}, 5500);
		const hide = () => { if(document.hidden) setPlaying(false); };
		document.addEventListener("visibilitychange", hide);
		return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", hide); };
	}, [playing, step]);

	return <>
		<header className="hero">
			<div><p className="eyebrow">Tutte’s squared rectangles · Lean 4 → WebAssembly</p><h1>A rectangle.<br /><em>A circuit in disguise.</em></h1></div>
			<p className="lede">Unequal squares fit exactly. Replace each square with a wire, and the fit becomes an electrical law. Follow the construction, then try to break it.</p>
		</header>
		<section className="tutte-lab" aria-label="Squared rectangle visual proof">
			<div className="tutte-toolbar">
				<div className="tutte-construction"><label htmlFor="tutte-construction">Construction · {simplePresets.length} simple tilings + compound comparison</label>
					<div className="tutte-construction-picker">
						<button className="secondary" aria-label="Previous construction" disabled={presetIndex === 0} onClick={() => changePreset(PRESETS[presetIndex - 1].id)}>←</button>
						<select id="tutte-construction" aria-label="Construction" value={presetId} onChange={e => changePreset(e.target.value)}>
							{orders.map(order => <optgroup key={order} label={`${order} squares · simple perfect`}>{simplePresets.filter(item => item.order === order).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}
							<optgroup label="Compound comparison">{PRESETS.filter(item => item.kind === "compound").map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>
						</select>
						<button className="secondary" aria-label="Next construction" disabled={presetIndex === PRESETS.length - 1} onClick={() => changePreset(PRESETS[presetIndex + 1].id)}>→</button>
					</div>
				</div>
				<label htmlFor="tutte-scale">Voltage scale<select id="tutte-scale" aria-label="Voltage scale" title="Only scales within the checker's 256-unit coordinate limit are shown." value={scale} onChange={e => { setScale(Number(e.target.value)); setBroken(null); }}>{scales.map(value => <option key={value} value={value}>{value}× · {preset.height * value} V</option>)}</select></label>
				<button className="tutte-play secondary" onClick={() => {
					if(playing) setPlaying(false);
					else
					{ chooseStep(0); setPlaying(true); }
				}}>{playing ? "Pause walkthrough" : "Play walkthrough"}</button>
			</div>
			<ol className="tutte-steps">{steps.map((label, index) => <li key={label}><button aria-current={step === index ? "step" : undefined} onClick={() => chooseStep(index)}><span>{index + 1}</span>{label}</button></li>)}</ol>
			<div className="tutte-body">
				<div className="tutte-diagrams">
					<figure><figcaption><b>The rectangle</b><span>{scene.width} × {scene.height} · {scene.tiles.length} squares</span></figcaption>
						<svg viewBox="0 0 420 420" role="group" aria-label="Select a square to inspect its wire">
							<rect x={tx(0)} y={ty(0)} width={scene.width * zoom} height={scene.height * zoom} className="rectangle-frame" />
							{scene.tiles.map(square => {
								const active = selectedWire(square), side = square.side + (broken === square.id ? 1 : 0);
								return <g key={square.id} role="button" tabIndex={0} aria-label={`Square ${square.side}, select wire ${square.id + 1}`} aria-pressed={tile.id === square.id}
									onClick={() => { setTileId(square.id); if(step !== 0) chooseStep(0); }} onKeyDown={event => activate(event, () => { setTileId(square.id); chooseStep(0); })}
									className={`tutte-square${active ? " selected" : " dim"}${broken === square.id ? " broken" : ""}`} style={{ "--square": colors[square.id] } as CSSProperties}>
									<rect x={tx(square.x)} y={ty(square.y)} width={side * zoom} height={side * zoom} />
									{square.side * zoom > 20 && <text x={tx(square.x + square.side / 2)} y={ty(square.y + square.side / 2)}>{side}</text>}
								</g>;
							})}
							{overlay && <g className="tile-overlay">{scene.tiles.map(square => <polyline key={square.id} points={wirePoints(scene, square).map(([x, y]) => `${tx(x)},${ty(y)}`).join(" ")} />)}{scene.nodes.map(seam => <circle key={seam.id} cx={tx((seam.left + seam.right) / 2)} cy={ty(seam.y)} r={4} />)}</g>}
							{step === 1 && <g className="selected-seam"><path d={`M${tx(node.left)},${ty(node.y)} H${tx(node.right)}`} /><text x={tx(node.left) - 10} y={ty(node.y)}>{node.label}</text></g>}
							{step === 2 && compound && <rect className="compound-outline" x={tx(compound.left)} y={ty(compound.top)} width={compound.width * zoom} height={compound.height * zoom} />}
						</svg>
						<label className="overlay-toggle"><input type="checkbox" checked={overlay} onChange={e => setOverlay(e.target.checked)} />Overlay the wires on the squares</label>
					</figure>
					<figure><figcaption><b>The Smith diagram</b><span>{scene.nodes.length} junctions · {scene.tiles.length} unit resistors</span></figcaption>
						<svg viewBox="0 0 420 420" role="group" aria-label={step === 2 ? "Remove up to two junctions to test connectivity" : "Select a wire or an internal junction"}>
							<path className={`battery-edge${step === 2 && (removed.includes(0) || removed.includes(scene.nodes.length - 1)) ? " removed" : ""}`} d={`M${gx(0)},${gy(0)} H385 V${gy(scene.nodes.length - 1)} H${gx(scene.nodes.length - 1)}`} />
							<text className="battery-label" transform="translate(404 206) rotate(-90)">{step === 2 ? "external pole-to-pole edge" : `${scene.height} V supply · ${scene.width} A total`}</text>
							{scene.tiles.map(square => {
								const { x, labelY, points } = diagram.wires[square.id];
								const path = `M${points.map(point => point.join(",")).join(" L")}`;
								const absent = step === 2 && (removed.includes(square.top) || removed.includes(square.bottom));
								const color = step === 2 ? colors[(connected.groups.get(square.top) ?? 0) * 2] : colors[square.id];
								return <g key={square.id} role="button" tabIndex={step === 2 ? -1 : 0} aria-label={`Wire ${square.id + 1}, ${square.side} amps, one ohm`} aria-pressed={square.id === tile.id}
									onClick={() => { if(step !== 2)
									{ setTileId(square.id); chooseStep(0); } }} onKeyDown={event => activate(event, () => { setTileId(square.id); chooseStep(0); })}
									className={`tutte-wire${selectedWire(square) ? " selected" : " dim"}${absent ? " removed" : ""}`} style={{ "--square": color } as CSSProperties}>
									<path className="wire-hit" d={path} /><path className="wire-line" d={path} />
									{step < 2 && selectedWire(square) && <path className="wire-motion" d={path} />}
									{step < 2 && <g className="wire-value"><rect x={x - 14} y={labelY - 10} width={28} height={20} rx={3} /><text x={x} y={labelY}>{square.side + (broken === square.id ? 1 : 0)}</text></g>}
								</g>;
							})}
							{scene.nodes.map(seam => <g key={seam.id} role="button" tabIndex={step < 2 && (seam.id === 0 || seam.id === scene.nodes.length - 1) ? -1 : 0} aria-disabled={step < 2 && (seam.id === 0 || seam.id === scene.nodes.length - 1)} aria-label={`Junction ${seam.label}, ${seam.potential} volts${step === 2 ? removed.includes(seam.id) ? ", restore" : ", remove" : seam.id === 0 || seam.id === scene.nodes.length - 1 ? ", supply terminal" : ", inspect balance"}`}
								aria-pressed={step === 2 ? removed.includes(seam.id) : node.id === seam.id}
								onClick={() => chooseNode(seam.id)} onKeyDown={event => activate(event, () => chooseNode(seam.id))}
								className={`tutte-node${step === 1 && node.id === seam.id ? " selected" : ""}${removed.includes(seam.id) ? " removed" : ""}`}
								style={{ "--square": colors[(connected.groups.get(seam.id) ?? 0) * 2] } as CSSProperties}>
								<circle cx={gx(seam.id)} cy={gy(seam.id)} r={13} /><text x={gx(seam.id)} y={gy(seam.id)}>{removed.includes(seam.id) ? "×" : seam.label}</text>
								{step < 2 && <text className="potential-label" x={38} y={gy(seam.id)}>{seam.potential} V</text>}
							</g>)}
						</svg>
						<p className="diagram-hint">{step === 2 ? `${removed.length}/2 junctions removed. Click a removed junction to restore it.` : "Numbers on wires are currents. Every resistor is 1 Ω."}</p>
					</figure>
				</div>
				<aside className="tutte-inspector" aria-label="Construction explanation">
					<p className="eyebrow">Step {step + 1} / 3</p>
					{step === 0 && <><h2>A square is a<br />one-ohm wire.</h2><p>Its top and bottom meet two horizontal seams. Those seams become junctions; height becomes voltage.</p>
						<div className="tutte-equation"><span>Voltage drop ÷ resistance = current</span><b>{scene.nodes[tile.top].potential} − {scene.nodes[tile.bottom].potential} = {tile.side}</b><span>{tile.side} V ÷ 1 Ω = {tile.side} A = square side</span></div>
						<div className="tile-picker" aria-label="Select a square by side length">{scene.tiles.map(square => <button key={square.id} aria-pressed={tile.id === square.id} style={{ "--square": colors[square.id] } as CSSProperties} onClick={() => setTileId(square.id)}>{square.side}</button>)}</div>
						<p>Select any size above, including squares too small to label in the drawing. Scaling the supply scales every square, without changing the network.</p>
					</>}
					{step === 1 && <><h2>Nothing accumulates<br />at a seam.</h2><label>Inspect junction<select value={node.id} onChange={e => { setNodeId(Number(e.target.value)); setBroken(null); }}>{scene.nodes.slice(1, -1).map(seam => <option key={seam.id} value={seam.id}>{seam.label} · {seam.potential} V</option>)}</select></label>
						<div className="tutte-equation"><span>Above the seam = below the seam</span><b>{terms(incoming)} {broken === null ? "=" : "≠"} {terms(outgoing)}</b><span>{result ? `${result.balances[node.id].incoming} A in · ${result.balances[node.id].outgoing} A out` : "Checking exact currents…"}</span></div>
						<p>The squares above and below span the same horizontal length. Their sides add to the same total. This is Kirchhoff’s current law.</p><p>Around a closed circuit, voltage changes cancel because you return to the same height.</p>
						<button className={broken === null ? "secondary" : ""} disabled={!checker} onClick={() => setBroken(broken === null ? incoming[0].id : null)}>{broken === null ? `Enlarge the ${incoming[0].side}-square by 1` : "Restore the exact fit"}</button>
						{broken !== null && <p className="failure-copy">The enlarged square overlaps its neighbors. Its side no longer equals the voltage drop, and this junction no longer balances.</p>}
					</>}
					{step === 2 && <><h2>{compound ? <>A rectangle<br />inside the rectangle.</> : <>No smaller<br />rectangle to lift out.</>}</h2><p><b>Simple</b> means no proper group of two or more squares forms another rectangle. <b>Perfect</b> means all side lengths differ. These are separate properties.</p>
						<p>{compound ? `The outline encloses ${compound.ids.length} squares forming a ${compound.width} × ${compound.height} rectangle. This example is perfect, but compound.` : "Lean checks every group of squares. None forms a proper rectangular sub-tiling."}</p>
						<div className="tutte-equation"><span>Add the external edge, then remove junctions</span><b data-testid="connectivity">{connected.count === 1 ? "Still connected" : `${connected.count} separate pieces`}</b><span>{result ? result.threeConnected ? "Lean checked every removal of 0, 1, or 2 junctions." : "This network has a separating pair." : "Checking the junction-removal cases…"}</span></div>
						<div className="tutte-actions"><button className="secondary" onClick={() => setRemoved([])} disabled={removed.length === 0}>Restore junctions</button>{compound ? <button onClick={() => setRemoved([0, scene.nodes.length - 2])}>Show the separating pair</button> : <button onClick={() => changePreset("compound")}>Compare a compound rectangle</button>}</div>
					</>}
					{step < 2 && <button className="next-proof-step" onClick={() => chooseStep(step + 1)}>{step === 0 ? "See why the lengths balance →" : "See what simple means →"}</button>}
				</aside>
			</div>
			<div className={`tutte-verdict${result && (!result.tiling || !result.electrical) ? " failed" : ""}`} role="status" aria-live="polite">
				{loadError ? <><b>Lean checker unavailable: {loadError}</b><button onClick={() => setAttempt(value => value + 1)}>Retry checker</button></> : !result ? <b>Loading the compiled Lean checker…</b> : <><b>{result.tiling && result.electrical ? "✓ Lean accepts this construction" : "× Lean rejects this construction"}</b><span>{result.tiling ? "Exact tiling" : "Tiling fails"} · {result.electrical ? "Currents balance" : "Electrical equations fail"}{result.tiling && result.electrical ? ` · ${result.simple ? "Simple" : "Compound"} · ${result.perfect ? "Perfect" : "Repeated sizes"}` : ""}</span></>}
			</div>
		</section>
		<section className="tutte-theorem"><div><p className="eyebrow">The Brooks–Smith–Stone–Tutte construction</p><h2>Fit is conservation.</h2></div><div><p>Horizontal seams become vertices. Squares become unit-resistance edges. Voltage drops give square heights; currents give square widths. Ohm’s law makes the two equal, and Kirchhoff’s law makes neighboring rows fit.</p><p>For a simple perfect squared rectangle, adding the external edge between the poles gives a planar, 3-connected graph. The converse construction uses a plane electrical network with the poles on one face to recover a squared rectangle; zero-current edges must be treated as degeneracies, not positive squares.</p><p>The {simplePresets.length} simple examples come from <a href="https://www.squaring.net/sq/sr/spsr/spsr.html" target="_blank" rel="noreferrer">the low-order catalogue</a>, ordered by square count, then width and height. The page generates their coordinates from Bouwkamp codes; rotations and resized copies do not count as additional examples.</p><p>Lean checks the tiling, currents, simplicity, and vertex-removal cases shown here. The general planar-network correspondence is explained visually, not formalized in this demo. <a href="https://carlo-hamalainen.net/stuff/Brooks,%20Smith,%20Stone,%20Tutte%20-%20The%20dissection%20of%20rectangles%20into%20squares%20(1940).pdf" target="_blank" rel="noreferrer">Read the 1940 paper ↗</a></p></div></section>
	</>;
}
