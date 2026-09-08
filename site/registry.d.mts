/**
 * Types the browser-safe documentation and demo route registry.
 *
 * @file
 */

/** Describes one existing algorithm demonstration and its retained artifacts. */
export interface Demo
{
	/** Stable directory and algorithm identifier from the gallery manifest. */
	slug: string;
	/** Human-readable algorithm title. */
	title: string;
	/** Application category displayed on gallery cards. */
	category: string;
	/** Manifest availability state. */
	status: string;
	/** Manifest summary shared by gallery entries. */
	summary: string;
	/** Retained standalone directory relative to the published artifact root. */
	entrypoint: string;
	/** Named guarantees selected by the manifest. */
	theorems: readonly string[];
	/** Gallery color token. */
	accent: string;
	/** Preferred user-facing route without the deployment prefix. */
	canonicalPage: string;
	/** Stable raw source, receipt, and runtime artifact directory. */
	artifactBase: string;
	/** Framework hosting the current interactive page. */
	renderingMode: 'react' | 'standalone';
}

/** Associates a public route with its canonical Markdown source or React hub. */
export interface DocPage
{
	/** Stable generated module identifier. */
	id: string;
	/** Public route without the deployment prefix. */
	route: string;
	/** Canonical Markdown path, or null for an authored React hub. */
	source: string | null;
	/** Navigation and page metadata title. */
	title: string;
	/** Audience group used by documentation navigation. */
	group: string;
}

export const demos: readonly Demo[];
export const docPages: readonly DocPage[];
export const prerenderPaths: readonly string[];
export const documentationImages: Readonly<Record<string, string>>;
