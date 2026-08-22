/**
 * Renders the static verified-algorithm gallery from its checked manifest.
 *
 * @file
 */

const grid = document.querySelector("#demo-grid");
const buildIdentity = document.querySelector("#build-identity");

const loadJson = async (path, fallback) => {
	const response = await fetch(path);
	if(!response.ok) return fallback;
	return response.json();
};

const renderCard = demo => {
	const card = document.createElement("a");
	card.className = "demo-card";
	card.href = demo.entrypoint;
	card.style.setProperty("--accent", `var(--${demo.accent})`);
	const top = document.createElement("div");
	top.className = "card-top";
	const category = document.createElement("span");
	category.textContent = demo.category;
	const status = document.createElement("span");
	status.className = "status";
	status.textContent = demo.status;
	top.append(category, status);
	const title = document.createElement("h3");
	title.textContent = demo.title;
	const summary = document.createElement("p");
	summary.textContent = demo.summary;
	const theorems = document.createElement("div");
	theorems.className = "theorems";
	theorems.textContent = demo.theorems.join(" · ");
	card.append(top, title, summary, theorems);
	return card;
};

const load = async () => {
	const [manifest, build] = await Promise.all([
		loadJson("manifest.json", { demos: [] })
		, loadJson("build-identity.json", null)
	]);
	grid.replaceChildren(...manifest.demos.map(renderCard));
	buildIdentity.textContent = build
		? `Built from ${build.commit.slice(0, 12)} · ${build.generatedAt}`
		: "Local source tree · build identity is added during Pages assembly";
};

load().catch(error => {
	grid.textContent = "The demo manifest could not be loaded.";
	console.error(error);
});
