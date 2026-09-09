/**
 * Mount scoped canvas, grid, and graph controllers into React-owned page markup.
 *
 * @file
 */

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createWorkbenchScope } from "../../../demos/shared/workbench-scope.mjs";
import "./demo-page.css";
import "./workbench-page.css";

const sessions = new Map<string, object>();

/** Route-owned inputs; no DOM nodes, prepared Wasm handles, or running playback. */
interface WorkbenchHostProps { artifactBase: string; children: ReactNode; }

/**
 * Load only on the client and release resources even when initialization is pending.
 */
export function WorkbenchHost({ artifactBase, children }: WorkbenchHostProps)
{
	const root = useRef<HTMLDivElement>(null);
	const [attempt, setAttempt] = useState(0);
	const [error, setError] = useState("");
	useEffect(() => {
		const element = root.current;
		if(!element) return;
		const scope = createWorkbenchScope(element, {
			remember: (value: object) => { sessions.set(artifactBase, value); }
			, fail: (failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure))
		});
		for(const leaf of element.querySelectorAll("[data-workbench-leaf]")) leaf.replaceChildren();
		const url = new URL(`${artifactBase}workbench.mjs`, globalThis.location.href);
		if(attempt) url.searchParams.set("retry", String(attempt));
		void import(/* @vite-ignore */ url.href).then(module => {
			if(scope.active) return module.mountWorkbench(element, scope, structuredClone(sessions.get(artifactBase) ?? {}));
		}).catch(scope.fail);
		return () => scope.dispose();
	}, [artifactBase, attempt]);
	return <>
		{error && <div className="workbench-error" role="alert"><p>Could not load the Lean workbench: {error}</p><button type="button" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Retry workbench</button></div>}
		<div ref={root} key={attempt} className="workbench-host">{children}</div>
	</>;
}
