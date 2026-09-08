/**
 * Consume the author's installed archive through React effects and a module worker.
 *
 * @file
 */

import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { calculate, loadLean } from "./lean";
import type { Answer, Inputs } from "./lean";

interface Observation { effects: number; cleanups: number; commits: number; ignored: number; }
declare global { interface Window { componentConsumer: Observation; } }
window.componentConsumer = { effects: 0, cleanups: 0, commits: 0, ignored: 0 };

type ResultState = { status: "loading" } | {status: "ready"; answer: Answer} | {status: "error"; error: string};
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

/** Present loading and failures without leaving an empty component. */
function Result({ state, id }: {state: ResultState; id: string})
{
	return <p id={id} role="status" data-status={state.status}>{state.status === "loading" ? "Loading Lean component…"
		: state.status === "error" ? state.error : `Sum: ${state.answer.sum}. Empty string: ${state.answer.empty}.`}</p>;
}

/** Ignore a retired effect without discarding the shared module instance. */
function LeanResult({ input }: {input: Inputs})
{
	const [state, setState] = useState<ResultState>({ status: "loading" });
	useEffect(() => {
		let active = true;
		window.componentConsumer.effects++;
		setState({ status: "loading" });
		loadLean().then(api => {
			if(!active)
			{ window.componentConsumer.ignored++; return; }
			const answer = calculate(api, input);
			window.componentConsumer.commits++;
			setState({ status: "ready", answer });
		}).catch(error => {
			if(!active)
			{ window.componentConsumer.ignored++; return; }
			setState({ status: "error", error: errorMessage(error) });
		});
		return () => { active = false; window.componentConsumer.cleanups++; };
	}, [input]);
	return <Result state={state} id="lean-result" />;
}

/** Terminate each owned worker when the input changes or the component leaves. */
function WorkerResult({ input }: {input: Inputs})
{
	const [state, setState] = useState<ResultState>({ status: "loading" });
	useEffect(() => {
		let active = true;
		setState({ status: "loading" });
		const worker = new Worker(new URL("./lean-worker.ts", import.meta.url), { type: "module" });
		worker.onmessage = event => {
			if(!active) return;
			setState(event.data.ok ? { status: "ready", answer: event.data.result }
				: { status: "error", error: event.data.error });
		};
		worker.onerror = event => {
			if(active) setState({ status: "error", error: event.message || "The Lean worker could not load." });
		};
		worker.postMessage(input);
		return () => { active = false; worker.onmessage = null; worker.onerror = null; worker.terminate(); };
	}, [input]);
	return <Result state={state} id="worker-result" />;
}

/** Expose edits and explicit mount controls for the runnable documentation example. */
function App()
{
	const [mounted, setMounted] = useState(true);
	const [workerMounted, setWorkerMounted] = useState(false);
	const [left, setLeft] = useState("20");
	const [right, setRight] = useState("22");
	const [text, setText] = useState("");
	const [input, setInput] = useState<Inputs>({ left: "20", right: "22", text: "" });
	return <>
		<h1>Use an installed Lean component</h1>
		<p>This app imports <code>add</code> and <code>isEmpty</code> from <code>onboarding-small</code>.</p>
		<form onSubmit={event => { event.preventDefault(); setInput({ left, right, text }); }}>
			<label>Left <input id="left" inputMode="numeric" value={left} onChange={event => setLeft(event.target.value)} /></label>
			<label>Right <input id="right" inputMode="numeric" value={right} onChange={event => setRight(event.target.value)} /></label>
			<label>Text <input id="text" value={text} onChange={event => setText(event.target.value)} /></label>
			<button id="calculate" type="submit">Calculate</button>
		</form>
		<button id="toggle-component" type="button" onClick={() => setMounted(value => !value)}>{mounted ? "Unmount component" : "Mount component"}</button>
		{mounted && <LeanResult input={input} />}
		<button id="toggle-worker" type="button" onClick={() => setWorkerMounted(value => !value)}>{workerMounted ? "Stop worker" : "Start worker"}</button>
		{workerMounted && <WorkerResult input={input} />}
	</>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
