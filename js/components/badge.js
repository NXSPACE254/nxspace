/**
 * ==========================================================================
 * File: badge.js
 * Description: Reusable Badge Component
 * ==========================================================================
 */

const COLORS = [
    "primary",
    "secondary",
    "success",
    "warning",
    "danger",
    "info"
];

const SIZES = [
    "sm",
    "md",
    "lg"
];

/**
 * Create Badge Component
 *
 * @param {Object} options
 * @param {string} options.text
 * @param {string} options.color
 * @param {string} options.size
 * @param {boolean} options.outline
 *
 * @returns {HTMLElement}
 */
export function createBadge({
    text = "",
    color = "primary",
    size = "md",
    outline = false
} = {}) {

    const badge = document.createElement("span");

    badge.classList.add("badge");

    badge.classList.add(
        COLORS.includes(color)
            ? `badge-${color}`
            : "badge-primary"
    );

    badge.classList.add(
        SIZES.includes(size)
            ? `badge-${size}`
            : "badge-md"
    );

    if (outline) {
        badge.classList.add("badge-outline");
    }

    badge.textContent = text;

    return badge;
}