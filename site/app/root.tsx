/**
 * Render the shared document and handle client navigation without nested page shells.
 *
 * @file
 */

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Link, Links, Meta, NavLink, Outlet, Scripts, ScrollRestoration, useLocation } from "react-router";
import { assetHref } from "./urls";
import "./styles.css";

/** Keep route focus separate from hash-only changes inside a workbench. */
const SiteNavigation = () => {
	const location = useLocation();
	const previous = useRef(location.pathname);
	const mobile = useRef<HTMLDetailsElement>(null);
	useEffect(() => {
		if(!performance.getEntriesByName("site-hydrated").length) performance.mark("site-hydrated");
	}, []);
	useEffect(() => {
		if(previous.current === location.pathname) return;
		previous.current = location.pathname;
		mobile.current?.removeAttribute("open");
		const heading = document.querySelector<HTMLElement>("main h1");
		if(heading)
		{
			heading.tabIndex = -1;
			heading.focus({ preventScroll: true });
		}
	}, [location.pathname]);
	const links = <>
		<NavLink to="/" end>Home</NavLink>
		<NavLink to="/demos/">Demos</NavLink>
		<NavLink to="/docs/">Docs</NavLink>
		<a href="https://github.com/seanmorris/lean-bridge">GitHub <span aria-hidden="true">↗</span></a>
	</>;
	return <header className="site-header"><div className="site-header-inner">
		<Link className="site-brand" to="/"><b aria-hidden="true">λ</b><span>Lean Bridge</span></Link>
		<nav className="site-links" aria-label="Main navigation">{links}</nav>
		<details className="mobile-navigation" ref={mobile}><summary>Menu</summary><nav aria-label="Mobile navigation">{links}</nav></details>
	</div></header>;
};

/** Supply the common static HTML document to every route and error page. */
export const Layout = ({ children }: { children: ReactNode }) => <html lang="en">
	<head>
		<meta charSet="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta name="theme-color" content="#09111f" />
		<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ctext x='6' y='26' font-size='30' fill='%23adf7b6'%3Eλ%3C/text%3E%3C/svg%3E" />
		<Meta /><Links />
	</head>
	<body>
		<a className="skip-link" href="#main-content">Skip to content</a>
		<SiteNavigation />
		{children}
		<footer className="site-footer"><div><b>Lean Bridge</b><p>Checked Lean. Ordinary application code.</p></div>
			<div className="footer-links"><Link to="/status/">Implementation status</Link><a href={assetHref("/build-identity.json")}>Build identity</a>
				<span id="build-identity">Source {__BUILD_REVISION__.slice(0, 7)}{__BUILD_MODIFIED__ ? " + local changes" : ""}</span></div>
		</footer>
		<ScrollRestoration /><Scripts />
	</body>
</html>;

/** Render the selected prerendered or client-navigated page. */
export default function App()
{
	return <Outlet />;
}

/** Keep route failures readable instead of leaving an empty hydration shell. */
export const ErrorBoundary = () => <main id="main-content" className="site-main not-found">
	<p className="eyebrow">Page unavailable</p><h1>This page could not load.</h1>
	<p>Reload to try again, or return to the documentation.</p><Link className="action-link" to="/docs/">Open documentation →</Link>
</main>;
