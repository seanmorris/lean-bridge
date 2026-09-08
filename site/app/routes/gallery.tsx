/**
 * Browse the algorithm collection using the same registry as the published routes.
 *
 * @file
 */

import { useState } from "react";
import { DemoCards } from "../components/DemoCards";

/** Describe the searchable algorithm gallery. */
export const meta = () => [{ title: "Verified demos | Lean Bridge" }];

/** Filter the prerendered collection after hydration. */
export default function Gallery()
{
	const [query, setQuery] = useState("");
	return <main id="main-content" className="site-main gallery-page"><header className="page-intro"><p className="eyebrow">Lean 4 → WebAssembly</p><h1>Algorithms you can run and inspect.</h1><p className="lede">Twelve interactive implementations, each with checked Lean proofs and a browser benchmark.</p></header>
		<label className="gallery-search">Find a demo<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Algorithm, category, or use case" /></label>
		<DemoCards query={query} /><noscript><p>The complete collection is listed above. Enable JavaScript to run an interactive demo.</p></noscript>
	</main>;
}
