/**
 * Installs the site header on each standalone demo page.
 *
 * @file
 */

const base = document.documentElement.dataset.siteBase;
if(base && (!/^\/(?:[A-Za-z0-9._~-]+\/)*$/u.test(base)
	|| base.split("/").some(part => part === "." || part === "..")))
	throw new Error("Invalid published site base.");
const header = document.createElement("header");
header.className = "site-header";
const inner = document.createElement("div");
inner.className = "site-header-inner";
const home = document.createElement("a");
home.href = base || "../";
home.className = "site-brand";
const mark = document.createElement("b");
mark.textContent = "λ";
mark.setAttribute("aria-hidden", "true");
const homeLabel = document.createElement("span");
homeLabel.textContent = "Lean Bridge";
home.append(mark, homeLabel);
const destinations = [
	["Home", base || "../"]
	, ["Demos", base ? `${base}demos/` : "../"]
	, ["Docs", base ? `${base}docs/` : "../../build/github-pages/docs/"]
	, ["GitHub", "https://github.com/seanmorris/lean-bridge"]
];
/**
 * Build matching desktop and mobile links without a framework dependency.
 *
 * @param {string} label Navigation's accessible label.
 * @returns {HTMLElement} Navigation containing the shared site destinations.
 */
const navigation = label => {
	const nav = document.createElement("nav");
	nav.setAttribute("aria-label", label);
	for(const [text, href] of destinations)
	{
		const link = document.createElement("a");
		link.href = href;
		link.textContent = text;
		if(text === "Demos") link.setAttribute("aria-current", "page");
		if(text === "GitHub")
		{
			link.textContent += " ";
			const arrow = document.createElement("span");
			arrow.textContent = "↗";
			arrow.setAttribute("aria-hidden", "true");
			link.append(arrow);
		}
		nav.append(link);
	}
	return nav;
};
const links = navigation("Main navigation");
links.className = "site-links";
const mobile = document.createElement("details");
mobile.className = "mobile-navigation";
const summary = document.createElement("summary");
summary.textContent = "Menu";
mobile.append(summary, navigation("Mobile navigation"));
inner.append(home, links, mobile);
header.append(inner);
document.body.prepend(header);
