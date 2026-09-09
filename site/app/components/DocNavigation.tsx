/**
 * Keep one guide navigation tree open on desktop and collapsible on small screens.
 *
 * @file
 */

import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import { NavLink } from "react-router";
import { docPages } from "../../registry.mjs";

const groups = [...new Set(docPages.map(page => page.group))];

/** Native details leave every guide available before hydration and without JavaScript. */
export const DocNavigation = () => {
	const disclosure = useRef<HTMLDetailsElement>(null);
	const mobile = useRef<MediaQueryList | null>(null);
	useEffect(() => {
		const element = disclosure.current;
		if(!element) return;
		const query = globalThis.matchMedia("(max-width: 760px)");
		mobile.current = query;
		const update = () => {
			const focusIsInside = element.querySelector("nav")?.contains(globalThis.document.activeElement);
			element.open = !query.matches;
			if(query.matches && focusIsInside) element.querySelector("summary")?.focus({ preventScroll: true });
		};
		update();
		query.addEventListener("change", update);
		return () => {
			query.removeEventListener("change", update);
			mobile.current = null;
		};
	}, []);
	const navigate = (event: MouseEvent<HTMLElement>) => {
		if(!mobile.current?.matches || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
		if(!(event.target instanceof Element) || !event.target.closest("a")) return;
		const element = disclosure.current;
		if(!element) return;
		element.open = false;
		element.querySelector("summary")?.focus({ preventScroll: true });
	};
	return <details className="doc-navigation" ref={disclosure} open>
		<summary>Browse guides</summary>
		<nav aria-label="Guides" onClick={navigate}>{groups.map(group => <section key={group}>
			<h2>{group}</h2>{docPages.filter(page => page.group === group && !page.legacy).map(page =>
				<NavLink end key={page.route} to={page.route}>{page.title}</NavLink>)}
		</section>)}</nav>
	</details>;
};
