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
import { DocSidebar } from "./DocSidebar";
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

/** Each route supplies its own guide chunk, ready for static rendering and hydration. */
export default function Documentation({ Content }: { Content: ComponentType<{ components?: MDXComponents }> })
{
	const location = useLocation();
	const route = `${location.pathname.replace(/\/$/u, "")}/`;
	const entry = docPages.find(page => page.route === route);
	if(!entry) return <NotFound />;
	const metadata = pages[route];
	const headings = metadata?.headings ?? [];
	const sequence = entry.legacy ? [] : docPages.filter(page => page.group === entry.group && !page.legacy);
	const position = sequence.findIndex(page => page.route === route);
	const previous = sequence[position - 1];
	const next = sequence[position + 1];
	return <div className="docs-layout"><DocSidebar />
		<main className="doc-content" id="main-content"><p className="eyebrow">Documentation / {entry.group}</p><article>
			<Content components={{ a: DocumentationLink }} />
		</article>{(previous || next) && <nav className="doc-pagination" aria-label="Continue reading">
			{previous && <Link to={previous.route} rel="prev"><span>← Previous in {entry.group}</span>{previous.title}</Link>}
			{next && <Link to={next.route} rel="next"><span>Next in {entry.group} →</span>{next.title}</Link>}
		</nav>}{metadata && <footer className="doc-source"><a href={metadata.sourceUrl}>View canonical Markdown ↗</a><span>Built from {metadata.sourceSha256.slice(0, 12)}</span></footer>}</main>
		<aside className="doc-outline"><nav aria-label="On this page"><h2>On this page</h2>{headings.filter(heading => heading.depth === 2).map(heading => <a href={`#${heading.id}`} key={heading.id}>{heading.text}</a>)}</nav></aside>
	</div>;
}
