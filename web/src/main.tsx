import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Browser page translators (e.g. Chrome's) replace text nodes, which makes React's removeChild/insertBefore throw
// and blanks the page. Make those two calls tolerant so the app keeps working under translation.
const originalRemoveChild = Node.prototype.removeChild;
Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
  if (child.parentNode !== this) return child;
  return originalRemoveChild.call(this, child) as T;
};
const originalInsertBefore = Node.prototype.insertBefore;
Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
  if (referenceNode && referenceNode.parentNode !== this) return newNode;
  return originalInsertBefore.call(this, newNode, referenceNode) as T;
};

// On phones every table.data is shown as one card per row (styles.css). Each cell needs its column's name for that,
// so copy the header text into a data-label on every cell, for tables already on the page and any that appear later.
function labelTables() {
  for (const table of document.querySelectorAll<HTMLTableElement>("table.data")) {
    const heads = [...table.querySelectorAll("thead th")].map((th) => th.textContent?.trim() ?? "");
    if (!heads.length) continue;
    for (const row of table.querySelectorAll("tbody tr"))
      [...row.children].forEach((cell, i) => {
        if (heads[i] && cell.getAttribute("data-label") !== heads[i]) cell.setAttribute("data-label", heads[i]);
      });
  }
}
let labelQueued = false;
new MutationObserver(() => {
  if (labelQueued) return;
  labelQueued = true;
  requestAnimationFrame(() => {
    labelQueued = false;
    labelTables();
  });
}).observe(document.body, { childList: true, subtree: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
