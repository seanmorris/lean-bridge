/**
 * Load the documentation search index only when a reader uses search.
 *
 * @file
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { assetHref } from "../urls";
import { docPages } from "../../registry.mjs";
import { searchDocumentation } from "../../search.mjs";

/** Search metadata contains no executable documentation or algorithm runtime. */
type SearchEntry = { route: string; title: string; searchText: string; searchAliases?: string[] };

/** Fetch on demand, abort on navigation, and keep failed loads retryable. */
export const DocSearch = () => {
	const [active, setActive] = useState(false);
	const [query, setQuery] = useState("");
	const [entries, setEntries] = useState<SearchEntry[] | null>(null);
	const [error, setError] = useState(false);
	const [attempt, setAttempt] = useState(0);
	const input = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if(!active || entries) return;
		const controller = new AbortController();
		fetch(assetHref("/search-index.json"), { signal: controller.signal }).then(response => {
			if(!response.ok) throw new Error("Search index unavailable");
			return response.json();
		}).then((value: unknown) => {
			if(!Array.isArray(value) || !value.every(entry => entry && typeof entry.title === "string"
				&& typeof entry.searchText === "string" && docPages.some(page => page.route === entry.route)
				&& (entry.searchAliases === undefined || Array.isArray(entry.searchAliases)
					&& entry.searchAliases.every((alias: unknown) => typeof alias === "string"))))
				throw new Error("Search index is malformed");
			if(!controller.signal.aborted) setEntries(value as SearchEntry[]);
		}).catch(() => {
			if(!controller.signal.aborted) setError(true);
		});
		return () => controller.abort();
	}, [active, entries, attempt]);
	const matches = entries ? searchDocumentation(entries, query) : [];
	return <div className="doc-search"><label htmlFor="doc-search">Search documentation</label><input ref={input} id="doc-search" type="search" placeholder="Exports, packages, runtimes…" value={query} onFocus={() => setActive(true)} onChange={event => { setQuery(event.target.value); setActive(true); }} />
		{query && <div className="search-results" aria-live="polite">{error ? <p>Search could not load. <button type="button" onClick={() => { setError(false); setActive(true); setAttempt(value => value + 1); input.current?.focus(); }}>Retry search</button></p> : !entries ? <p>Loading index…</p> : matches.length ? <ul>{matches.map(entry => <li key={entry.route}><Link to={entry.route} onClick={() => setQuery("")}>{entry.title}<small>{docPages.find(page => page.route === entry.route)?.group}</small></Link></li>)}</ul> : <p>No matching pages.</p>}</div>}
	</div>;
};
