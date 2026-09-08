/**
 * Renders the static verified-algorithm gallery from its checked manifest.
 *
 * @file
 */

import { renderGalleryCard } from "./shared/gallery-card.mjs";

const grid = document.querySelector("#demo-grid");
const buildIdentity = document.querySelector("#build-identity");

const loadJson = async (path, fallback) => {
	const response = await fetch(path);
	if(!response.ok)
	{
		if(fallback !== undefined) return fallback;
		throw new Error(`Could not load ${path}: HTTP ${response.status}`);
	}
	return response.json();
};

const load = async () => {
	const [manifest, build] = await Promise.all([
		loadJson("manifest.json")
		, loadJson("build-identity.json", null).catch(() => null)
	]);
	grid.innerHTML = manifest.demos.map(renderGalleryCard).join("");
	buildIdentity.textContent = build
		? `Built from ${build.commit.slice(0, 12)}${build.sourceState === "modified" ? " + local changes" : ""} · ${build.generatedAt}`
		: "Local source tree · build identity is added during Pages assembly";
};

load().catch(error => {
	buildIdentity.textContent = "Could not refresh gallery metadata. The published demo links remain available.";
	buildIdentity.title = error.message;
	if(!grid.children.length) grid.textContent = "The demo manifest could not be loaded. Reload to try again.";
});
