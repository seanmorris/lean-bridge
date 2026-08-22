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
const mark = document.createElement("b");
mark.className = "portfolio-mark";
mark.textContent = "λ";
const homeLabel = document.createElement("span");
homeLabel.textContent = "Verified algorithms";
home.append(mark, homeLabel);
const title = document.createElement("span");
title.className = "portfolio-current";
title.textContent = current;
nav.append(home, title);
document.body.prepend(nav);
