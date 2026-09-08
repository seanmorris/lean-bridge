/**
 * Hydrate the static document with development lifecycle checks enabled.
 *
 * @file
 */

import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

startTransition(() => {
	hydrateRoot(document, <StrictMode><HydratedRouter /></StrictMode>);
});
