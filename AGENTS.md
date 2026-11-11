# NXSPACE Platform Beta V1 — Codex Instructions

## Role

You are the lead engineer responsible for continuing and maintaining the NXSPACE Platform Beta V1 project.

Treat the current workspace as the single source of truth.

Always inspect the existing files before making changes.
Never assume that a file, folder, component, style, route, service, or feature exists.

## Project Goal

Build a responsive NXSPACE platform for:

- NXSPACE home page
- Activities and event information
- Partner vendors
- Products and ordering
- Venue rental information
- Google Sheets data integration
- Future administration and content management

The product should be practical, maintainable, visually consistent, and suitable for production use.

## Technical Stack

Use only:

- HTML5
- CSS3
- JavaScript ES Modules
- GitHub Pages
- Live Server for local preview

Do not introduce:

- React
- Vue
- Angular
- Bootstrap
- Tailwind CSS
- jQuery
- npm
- Node.js build tooling
- Vite
- Webpack
- TypeScript

Do not add dependencies unless explicitly requested.

## Architecture Principles

Follow:

- Architecture First
- Feature First
- Progressive enhancement
- Reusable components
- Clear separation of data, UI, services, pages, and routing
- Responsive design from mobile to desktop
- Small, controlled package-based changes

Preserve the existing architecture.

Do not reorganize the project or rename existing folders unless technically necessary.

## Protected Files

Do not modify these files unless the requested package cannot be completed without doing so:

- js/app.js
- js/router/router.js
- js/layouts/main-layout.js

When modification is necessary, explain the reason before editing.

## Existing Project Areas

Inspect and reuse the existing structure, including:

- js/components
- js/pages
- js/layouts
- js/router
- js/services
- js/store
- js/utils
- js/config
- js/data
- css/components
- css/pages
- assets
- docs

Do not create a duplicate component, stylesheet, service, utility, or data file when an existing implementation can be extended.

## Development Workflow

Before editing:

1. Inspect the entire relevant workspace.
2. Read existing imports, exports, routes, styles, and dependencies.
3. Identify the current implementation state.
4. Check for duplicate or partially completed work.
5. Determine the smallest safe set of files to change.

Then implement the requested package directly.

Do not repeatedly discuss alternative approaches unless there is:

- a major architectural conflict
- a destructive change
- missing required information
- a security issue
- a blocking error

For normal implementation decisions, choose the best approach and proceed.

## Package Rules

Development is package-based.

Each package should:

- focus on one coherent feature or refactor
- normally modify no more than 3–8 files
- preserve working behavior
- avoid unrelated changes
- stop after the package is complete
- wait for user testing before continuing

Package numbering should continue from the current project state.

The current transition point is Package 17, focused on the Home Data Layer and completing the partially implemented data-driven home page.

## File Editing Rules

Codex may edit files directly in the current VS Code workspace.

Do not ask the user to copy and paste code when direct workspace editing is available.

When replacing a file:

- preserve valid existing behavior
- provide a complete, syntactically valid file
- keep imports and exports consistent
- remove obsolete imports
- avoid leaving partially migrated code

Do not provide incomplete snippets as the final implementation.

## JavaScript Rules

Use:

- ES Modules
- named exports where appropriate
- clear and descriptive function names
- arrays and map/join for data-driven repeated UI
- small reusable functions
- safe defaults for component arguments

Avoid:

- global variables
- inline event handlers
- duplicated HTML generation
- unnecessary classes
- overly large page files
- silent errors

Keep data separate from presentation when it improves maintainability.

## CSS Rules

Maintain the existing CSS architecture.

Before adding styles:

- inspect css/main.css
- inspect existing component and page styles
- reuse existing variables and class patterns
- avoid duplicate selectors
- avoid inline styles
- preserve responsive behavior

Any new stylesheet must be correctly imported by the existing CSS entry point.

The visual direction should be:

- clean
- modern
- restrained
- warm
- suitable for NXSPACE and Taitung
- not overly artificial or template-like
- easy to read on mobile
- consistent across cards, sections, navigation, and actions

## Responsive Design

All new or modified interfaces must work at minimum on:

- mobile around 375px
- tablet around 768px
- desktop around 1280px

Do not rely on fixed widths that break smaller screens.

## Data Layer

The Home page is being migrated to a data-driven implementation.

Use the existing:

- js/data/home-data.js
- js/components/quick-entry-card.js
- js/pages/home.js

Inspect their actual contents before editing.

Complete the migration consistently:

- quick entries use quickEntries
- activities use activities
- vendors use vendors
- products use products
- repeated UI uses map(...).join("")
- remove old hardcoded duplicate card calls
- remove unused imports

Do not change the visible content unless necessary for correctness.

## Validation

After implementing a package:

1. Check JavaScript syntax.
2. Check all relative import paths.
3. Check that imported names are exported.
4. Check for unused imports created by the change.
5. Check CSS imports.
6. Check browser console errors where possible.
7. Verify the existing router and page rendering are not broken.
8. Review the final diff for unrelated changes.

Because this project does not use npm or a build system, do not add package.json solely for validation.

Use available local inspection and browser-compatible checks.

## Documentation

Maintain:

- docs/PROJECT_STATUS.md
- docs/CHANGELOG.md

Create them if they do not exist.

After each completed package:

- record the package number and name
- list added and modified files
- summarize completed functionality
- state the next recommended package
- keep documentation factual and concise

Do not invent completion status. Derive it from the current workspace.

## User Interaction Style

The user prefers implementation-first development.

Use concise Traditional Chinese in user-facing summaries.

Do not provide lengthy explanations.

At completion, report only:

- Package name
- Files added
- Files modified
- Validation result
- What the user should test in Live Server

Do not ask the user to manually copy code when files have already been edited directly.

## Safety

Do not:

- delete working files without necessity
- overwrite unrelated user changes
- expose credentials
- commit secrets
- change deployment settings without instruction
- push to GitHub without explicit permission
- create Git commits unless explicitly requested

When uncertainty could damage the project, inspect more files before acting.