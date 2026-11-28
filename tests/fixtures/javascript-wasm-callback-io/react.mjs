/** @file Observe shared runtime retirement in an installed React application's click handlers. */
import React, {useState} from "react";
import {flushSync} from "react-dom";
import {createRoot} from "react-dom/client";
import {exercise} from "./calls.mjs";
import {load} from "./loaders.mjs";

/**
 * Enter a callback from one click, then retry the peer component from another.
 *
 * @param options - Callback behavior, load order and verified diagnostic module.
 */
export const runUI = async options => {
	const view = globalThis.document.querySelector("#trap"), root = createRoot(view);
	const done = Promise.withResolvers(), retry = Promise.withResolvers();
	const App = () => {
		const [status, setStatus] = useState("Run");
		const handle = async () => {
			try
			{
				if(status === "Run")
				{
					const report = await exercise(options, load);
					flushSync(() => setStatus("Runtime retired"));
					done.resolve(report);
				}
				else
				{
					const io = await load(options.ioName);
					try
					{ io.add(1); }
					catch(error)
					{
						if(!(error instanceof Error) || !/retired|poisoned/iu.test(error.message)) throw error;
						flushSync(() => setStatus("Peer update refused"));
						retry.resolve(); return;
					}
					throw new Error("React updated a retired peer");
				}
			}
			catch(error)
			{ (status === "Run" ? done : retry).reject(error); }
		};
		return React.createElement("button", {onClick: handle}, status);
	};
	try
	{
		flushSync(() => root.render(React.createElement(App)));
		const button = view.querySelector("button"), labels = [button.textContent];
		button.click();
		const common = await done.promise;
		labels.push(button.textContent); button.click(); await retry.promise;
		return {common, labels: [...labels, button.textContent]};
	}
	finally
	{ flushSync(() => root.unmount()); }
};
