/**
 * Render the canonical concepts guide in the shared documentation shell.
 *
 * @file
 */

import Content from "../../../../build/site-content/concepts.mjs";
import Documentation from "../../components/Documentation";
export { meta } from "../../components/Documentation";

/** Load this guide's static content without an algorithm runtime. */
export default function Guide()
{
	return <Documentation Content={Content} />;
}
