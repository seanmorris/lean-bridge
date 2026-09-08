/**
 * Provide a real static not-found document and a client-side unknown-route view.
 *
 * @file
 */

import { Link } from "react-router";

/** Keep the page title clear when a URL has no published route. */
export const meta = () => [{ title: "Page not found | Lean Bridge" }];

/** Recover through real navigation links even with JavaScript disabled. */
export default function NotFound()
{
	return <main className="site-main not-found" id="main-content"><p className="eyebrow">404 / Page not found</p><h1>There is no page at this address.</h1><p>The documentation or demo gallery may have what you need.</p><div className="hero-actions"><Link className="action-link" to="/docs/">Open documentation →</Link><Link to="/demos/">Browse demos →</Link></div></main>;
}
