/**
 * @file button.js
 * @description Reusable Button component for NXSPACE Platform Beta V1.
 * @module components/button
 */

/**
 * Creates a reusable button component.
 *
 * @param {Object} options
 * @param {string} options.text
 * @param {"primary"|"secondary"} [options.variant="primary"]
 * @param {"button"|"submit"|"reset"} [options.type="button"]
 * @param {boolean} [options.disabled=false]
 * @param {string} [options.className=""]
 * @returns {HTMLButtonElement}
 */
export function createButton({
  text = "",
  variant = "primary",
  type = "button",
  disabled = false,
  className = ""
} = {}) {

  const button = document.createElement("button");

  button.type = type;
  button.disabled = disabled;
  button.textContent = text;

  button.className = [
    "btn",
    `btn-${variant}`,
    className
  ]
    .filter(Boolean)
    .join(" ");

  return button;

}