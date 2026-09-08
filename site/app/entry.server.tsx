/**
 * Finish every lazy guide before writing static HTML, including no-JavaScript readers.
 *
 * @file
 */

import { prerender } from "react-dom/static";
import { ServerRouter } from "react-router";
import type { EntryContext } from "react-router";

/** Wait for complete document markup instead of publishing hidden streaming fragments. */
export default async function handleRequest(request: Request, responseStatusCode: number, responseHeaders: Headers, routerContext: EntryContext)
{
	let renderingError: unknown;
	const { prelude, postponed } = await prerender(<ServerRouter context={routerContext} url={request.url} />, {
		signal: request.signal
		, onError: error => { renderingError = error; }
	});
	if(renderingError) throw renderingError;
	if(postponed) throw new Error("Static routes must finish rendering before publication.");
	responseHeaders.set("Content-Type", "text/html; charset=utf-8");
	return new Response(prelude, { status: responseStatusCode, headers: responseHeaders });
}
