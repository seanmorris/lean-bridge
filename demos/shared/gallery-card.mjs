/**
 * Render escaped gallery markup for both static publishing and browser refreshes.
 *
 * @file
 */

const escapeHtml = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
	.replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/**
 * Create one manifest-backed demo link without executable markup from metadata.
 *
 * @param demo Validated gallery manifest entry.
 * @returns {string} Escaped card HTML.
 */
export const renderGalleryCard = demo => {
	if(!/^lean-[a-z0-9-]+\/$/u.test(demo.entrypoint)) throw new Error("Invalid demo entrypoint");
	if(!/^[a-z]+$/u.test(demo.accent)) throw new Error("Invalid demo accent");
	return `<a class="demo-card" href="${demo.entrypoint}" style="--accent: var(--${demo.accent})">`
		+ `<div class="card-top"><span>${escapeHtml(demo.category)}</span>`
		+ `<span class="status">${escapeHtml(demo.status)}</span></div>`
		+ `<h3>${escapeHtml(demo.title)}</h3><p>${escapeHtml(demo.summary)}</p>`
		+ `<div class="theorems">${escapeHtml(demo.theorems.join(" · "))}</div></a>`;
};
