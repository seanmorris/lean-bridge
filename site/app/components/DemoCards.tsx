/**
 * Render the single demo registry without changing standalone artifact URLs.
 *
 * @file
 */

import { Link } from "react-router";
import { demos } from "../../registry.mjs";
import { assetHref } from "../urls";

/** Keep React navigation for ported demos and ordinary links for standalone pages. */
export const DemoCards = ({ query = "" }: { query?: string }) => {
	const filtered = demos.filter(demo => `${demo.title} ${demo.category} ${demo.summary}`.toLowerCase().includes(query.toLowerCase()));
	return <div className="demo-grid" id="demo-grid">
		{filtered.map((demo, index) => {
			const content = <><div className="card-meta"><span>{demo.category}</span><span>{String(index + 1).padStart(2, "0")}</span></div>
				<h3>{demo.title}</h3><p>{demo.summary}</p><div className="theorem-list">{demo.theorems.slice(0, 2).map(name => <code key={name}>{name}</code>)}</div>
				<span className="card-action">Open demo <span aria-hidden="true">↗</span></span></>;
			return <article className={`demo-card accent-${demo.accent}`} key={demo.slug}>
				{demo.renderingMode === "react" ? <Link to={demo.canonicalPage}>{content}</Link> : <a href={assetHref(demo.canonicalPage)}>{content}</a>}
			</article>;
		})}
		{filtered.length === 0 && <p role="status">No demos match “{query}”. Try an algorithm name or a category.</p>}
	</div>;
};
