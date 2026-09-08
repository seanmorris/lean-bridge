/**
 * Bind the canonical lean-first-component guide to its statically rendered route.
 *
 * @file
 */

import Content from "../../../../build/site-content/lean-first-component.mjs";
import Documentation from "../../components/Documentation";
export { meta } from "../../components/Documentation";

/** Load only this guide's compiled content when its route is visited. */
export default function Guide()
{
	return <Documentation Content={Content} />;
}
