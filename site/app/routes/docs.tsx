/**
 * Render audience hubs using the shared documentation layout.
 *
 * @file
 */

import Documentation from "../components/Documentation";
export { meta } from "../components/Documentation";

/** Hubs have authored navigation instead of a compiled Markdown guide. */
export default function DocumentationHub()
{
	return <Documentation />;
}
