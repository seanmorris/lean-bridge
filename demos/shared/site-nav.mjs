/**
 * Installs consistent gallery navigation on each standalone demo page.
 *
 * @file
 */

const current = document.documentElement.dataset.demoTitle || document.title;
const nav = document.createElement("nav");
nav.className = "portfolio-nav";
nav.setAttribute("aria-label", "Verified algorithm gallery");
const home = document.createElement("a");
home.href = "../";
home.textContent = "λ Verified algorithms";
const title = document.createElement("span");
title.textContent = current;
nav.append(home, title);
document.body.prepend(nav);
