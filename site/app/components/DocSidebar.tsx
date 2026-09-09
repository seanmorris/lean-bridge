/**
 * Retain the guide rail's independent scroll offset within the current tab.
 *
 * @file
 */

import { useLayoutEffect, useRef } from "react";
import { assetHref } from "../urls";
import { DocNavigation } from "./DocNavigation";
import { DocSearch } from "./DocSearch";

let rememberedTop: number | undefined;

/** Restore before paint on route changes and retain the position through reloads. */
export const DocSidebar = () => {
	const rail = useRef<HTMLElement>(null);
	useLayoutEffect(() => {
		const element = rail.current;
		if(!element) return;
		const desktop = globalThis.matchMedia("(min-width: 761px)");
		const key = `lean-bridge:docs-sidebar-scroll:${assetHref("/")}`;
		let frame: number | undefined;
		let restoring = false;
		if(rememberedTop === undefined)
		{
			rememberedTop = 0;
			try
			{
				const stored = Number(globalThis.sessionStorage.getItem(key));
				if(Number.isFinite(stored) && stored >= 0) rememberedTop = stored;
			}
			catch { /* Tab memory still works when storage is unavailable. */ }
		}
		const save = () => {
			if(!desktop.matches || restoring || !element.isConnected) return;
			// WebKit can collapse the rail before updating this media query object.
			if(element.scrollHeight <= element.clientHeight) return;
			rememberedTop = Math.max(0, element.scrollTop);
			try
			{ globalThis.sessionStorage.setItem(key, String(rememberedTop)); }
			catch { /* A storage failure must not interrupt guide navigation. */ }
		};
		const restore = () => {
			if(desktop.matches) element.scrollTop = rememberedTop ?? 0;
		};
		const resize = () => {
			if(frame !== undefined) globalThis.cancelAnimationFrame(frame);
			restoring = true;
			frame = globalThis.requestAnimationFrame(() => {
				// Let the mobile disclosure reopen before measuring the desktop rail.
				restore();
				restoring = false;
				frame = undefined;
			});
		};
		restore();
		element.addEventListener("scroll", save, { passive: true });
		element.addEventListener("click", save, true);
		globalThis.addEventListener("pagehide", save);
		desktop.addEventListener("change", resize);
		return () => {
			save();
			if(frame !== undefined) globalThis.cancelAnimationFrame(frame);
			element.removeEventListener("scroll", save);
			element.removeEventListener("click", save, true);
			globalThis.removeEventListener("pagehide", save);
			desktop.removeEventListener("change", resize);
		};
	}, []);
	return <aside className="docs-sidebar" ref={rail} aria-label="Documentation navigation"><DocSearch /><DocNavigation /></aside>;
};
