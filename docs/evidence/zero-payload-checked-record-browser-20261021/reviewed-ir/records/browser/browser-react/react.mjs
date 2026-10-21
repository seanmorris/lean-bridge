/**
 * Installed calls in React effects, with retired-result suppression.
 *
 * @file
 */
import { StrictMode, createElement as element, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { executeCorpus } from "./javascript.mjs";
import { loadApi, request } from "./package.mjs";

const audit = globalThis.corpusLifecycle = { effects: 0, cleanups: 0, ignored: 0, commits: 0 };
const Panel = () => {
	const [status, setStatus] = useState("loading");
	const [text, setText] = useState("");
	useEffect(() => {
		let retired = false;
		audit.effects++;
		void loadApi().then(api => {
			if(retired)
			{ audit.ignored++; return; }
			globalThis.corpusResult = { schemaVersion: 1, profile: request.profile
				, module: request.module, realm: "window"
				, results: executeCorpus(request, api) };
			setText(String(++audit.commits));
			setStatus("ready");
		}).catch(error => {
			if(retired)
			{ audit.ignored++; return; }
			setText(error.message); setStatus("error");
		});
		return () => { retired = true; audit.cleanups++; };
	}, []);
	return element("pre", { id: "result", "data-status": status }, text);
};
const App = () => {
	const [shown, setShown] = useState(true);
	return element("main", null
		, element("button", { id: "toggle", onClick: () => setShown(value => !value) }, "Toggle")
		, shown ? element(Panel) : null);
};
createRoot(document.querySelector("#root")).render(element(StrictMode, null, element(App)));
