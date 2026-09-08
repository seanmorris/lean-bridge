/**
 * Installs consistent gallery navigation on each standalone demo page.
 *
 * @file
 */

const current = document.documentElement.dataset.demoTitle || document.title;
const base = document.documentElement.dataset.siteBase;
if(base && (!/^\/(?:[A-Za-z0-9._~-]+\/)*$/u.test(base)
	|| base.split("/").some(part => part === "." || part === "..")))
	throw new Error("Invalid published site base.");
const nav = document.createElement("nav");
nav.className = "portfolio-nav";
nav.setAttribute("aria-label", "Lean Bridge navigation");
const home = document.createElement("a");
home.href = base || "../";
home.className = "portfolio-home";
home.setAttribute("aria-label", "Lean Bridge home");
const mark = document.createElement("b");
mark.className = "portfolio-mark";
mark.textContent = "λ";
mark.setAttribute("aria-hidden", "true");
const homeLabel = document.createElement("span");
homeLabel.textContent = "Lean Bridge";
home.append(mark, homeLabel);
const links = document.createElement("div");
links.className = "portfolio-links";
for(const [label, href] of [
	["Home", base || "../"]
	, ["Demos", base ? `${base}demos/` : "../"]
	, ["Docs", base ? `${base}docs/` : "../../build/github-pages/docs/"]
]){
	const link = document.createElement("a");
	link.href = href;
	link.textContent = label;
	links.append(link);
}
const title = document.createElement("span");
title.className = "portfolio-current";
title.textContent = current;
nav.append(home, title, links);
document.body.prepend(nav);
