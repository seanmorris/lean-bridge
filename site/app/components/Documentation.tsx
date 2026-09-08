/**
 * Render build-compiled canonical guides with navigation, an outline, and source links.
 *
 * @file
 */

import type { ComponentProps, ComponentType } from "react";
import type { MDXComponents } from "mdx/types";
import { Link, useLocation } from "react-router";
import { pages } from "../../../build/site-content/metadata.mjs";
import { docPages } from "../../registry.mjs";
import { DocSearch } from "./DocSearch";
import { DocNavigation } from "./DocNavigation";
import NotFound from "../routes/not-found";

/** Describe each canonical document without making a runtime network request. */
export const meta = ({ location }: { location: { pathname: string } }) => [{ title: `${docPages.find(page => page.route === `${location.pathname.replace(/\/$/u, "")}/`)?.title || "Documentation"} | Lean Bridge` }];

/** Keep links between converted guides inside React and preserve external source links. */
const DocumentationLink = ({ href = "", children, ...props }: ComponentProps<"a">) => {
	const location = useLocation();
	if(!href || /^(?:[a-z]+:|\/\/|#)/iu.test(href)) return <a {...props} href={href}>{children}</a>;
	const resolved = new URL(href, `https://site.invalid${location.pathname.replace(/\/?$/u, "/")}`);
	return <Link {...props} to={`${resolved.pathname}${resolved.search}${resolved.hash}`}>{children}</Link>;
};

/** Point readers at existing guides without inventing a published package workflow. */
const Hub = ({ route }: { route: string }) => route === "/docs/consume/" ? <>
	<h1>Use a Lean package</h1><p>Start with the runtime for your application. These guides identify the supported package shapes, installation checks, and current limitations.</p>
	<h2 id="choose-a-runtime">Choose a runtime</h2><div className="guide-links"><Link to="/docs/consume/javascript-typescript/">JavaScript and TypeScript <span>Browser and server package consumption →</span></Link><Link to="/docs/consume/php/">PHP <span>PHP/Wasm package consumption →</span></Link><Link to="/docs/consume/dotnet-jvm-ruby/">.NET, JVM, and Ruby <span>Managed bindings and registry consumers →</span></Link><Link to="/docs/consume/runtimes/">All downstream runtimes <span>Compare the supported surfaces →</span></Link></div>
	<h2 id="try-an-algorithm">Try an algorithm first</h2><p>The <Link to="/demos/">demo collection</Link> exposes generic Lean algorithms through browser adapters. The demos are standalone examples, not published npm packages.</p>
</> : <>
	<h1>Publish a Lean package</h1><p>Publishing starts with a reproducible package and a consumer that can install it. Follow the implemented release pipeline from package preparation through verification and publication.</p>
	<h2 id="release-flow">Follow the release flow</h2><ol className="release-steps"><li><Link to="/docs/lean/">Define the Lean exports</Link><p>Describe the supported ABI and build the package.</p></li><li><Link to="/docs/publish/pipeline/">Prepare and verify the release</Link><p>Inspect the release plan, package evidence, and install checks.</p></li><li><Link to="/docs/consume/">Check the downstream experience</Link><p>Use the target runtime’s guide to verify consumption.</p></li></ol>
	<p>The release pipeline guide distinguishes sandbox adapters from gated production publication. See <Link to="/status/">implementation status</Link> for the current supported surfaces.</p>
</>;

/** Each route supplies its own guide chunk, ready for static rendering and hydration. */
export default function Documentation({ Content }: { Content?: ComponentType<{ components?: MDXComponents }> })
{
	const location = useLocation();
	const route = `${location.pathname.replace(/\/$/u, "")}/`;
	const entry = docPages.find(page => page.route === route);
	if(!entry) return <NotFound />;
	const metadata = pages[route];
	const headings = metadata?.headings ?? (route === "/docs/consume/" ? [{ id: "choose-a-runtime", text: "Choose a runtime", depth: 2 }, { id: "try-an-algorithm", text: "Try an algorithm first", depth: 2 }] : [{ id: "release-flow", text: "Follow the release flow", depth: 2 }]);
	return <div className="docs-layout"><aside className="docs-sidebar" aria-label="Documentation navigation"><DocSearch /><DocNavigation /></aside>
		<main className="doc-content" id="main-content"><p className="eyebrow">Documentation / {entry.group}</p><article>
			{Content ? <Content components={{ a: DocumentationLink }} /> : <Hub route={route} />}
		</article>{metadata && <footer className="doc-source"><a href={metadata.sourceUrl}>View canonical Markdown ↗</a><span>Built from {metadata.sourceSha256.slice(0, 12)}</span></footer>}</main>
		<aside className="doc-outline"><nav aria-label="On this page"><h2>On this page</h2>{headings.filter(heading => heading.depth === 2).map(heading => <a href={`#${heading.id}`} key={heading.id}>{heading.text}</a>)}</nav></aside>
	</div>;
}
