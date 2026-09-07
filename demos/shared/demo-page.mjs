/**
 * Shared interaction harness for proof-demo pages.
 *
 * @file
 */

import "./site-nav.mjs";
import "./proof-viewer.mjs";

/**
 * Attach accessible, hash-addressable tabs within one demo surface.
 *
 * @param root0 Configuration.
 * @param root0.root Element containing the tabs and panels.
 * @param {string} root0.defaultView View selected when the URL hash is unknown.
 * @param {(view: string) => void} [root0.onChange] Optional selection callback.
 * @returns {{select: (view: string, updateHash?: boolean) => boolean, view: () => string}} Tab controller.
 */
export const attachDemoTabs = ({ root = globalThis.document, defaultView, onChange = () => {} }) => {
	const tabs = [...root.querySelectorAll("[role=tab][data-view]")];
	if(tabs.length === 0) throw new Error("Demo tab harness requires at least one data-view tab");
	const views = new Set(tabs.map(tab => tab.dataset.view));
	if(!views.has(defaultView)) throw new Error(`Unknown default demo view: ${defaultView}`);
	let activeView = defaultView;

	const select = (nextView, updateHash = true) => {
		if(!views.has(nextView)) return false;
		activeView = nextView;
		for(const tab of tabs)
		{
			const selected = tab.dataset.view === activeView;
			tab.setAttribute("aria-selected", String(selected));
			tab.tabIndex = selected ? 0 : -1;
			const controls = tab.getAttribute("aria-controls");
			const panel = controls ? root.querySelector(`#${globalThis.CSS.escape(controls)}`) : null;
			if(!panel) throw new Error(`Demo tab is missing panel #${controls}`);
			panel.hidden = !selected;
		}
		if(updateHash) globalThis.history.replaceState(null, "", `#${activeView}`);
		onChange(activeView);
		return true;
	};

	for(const tab of tabs)
	{
		tab.addEventListener("click", () => select(tab.dataset.view));
		tab.addEventListener("keydown", event => {
			let target = tabs.indexOf(tab);
			if(event.key === "ArrowRight") target = (target + 1) % tabs.length;
			else if(event.key === "ArrowLeft") target = (target + tabs.length - 1) % tabs.length;
			else if(event.key === "Home") target = 0;
			else if(event.key === "End") target = tabs.length - 1;
			else return;
			event.preventDefault();
			tabs[target].focus();
			select(tabs[target].dataset.view);
		});
	}
	globalThis.addEventListener("hashchange", () => {
		if(!select(globalThis.location.hash.slice(1), false)) select(defaultView, false);
	});
	select(globalThis.location.hash.slice(1), false) || select(defaultView, false);
	return { select, view: () => activeView };
};
