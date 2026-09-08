/**
 * Bind the canonical publish-pages guide to its statically rendered route.
 *
 * @file
 */

import Content from "../../../../build/site-content/publish-pages.mjs";
import Documentation from "../../components/Documentation";
export { meta } from "../../components/Documentation";

/** Load only this guide's compiled content when its route is visited. */
export default function Guide()
{
	return <Documentation Content={Content} />;
}
