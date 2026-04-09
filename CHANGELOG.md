# Changelog

All notable changes to this fork are documented in this file.

## [1.0.3] - 2026-04-09

### Added

- Mixin navigation support: Go to Definition now works within mixin files for `this.*` members and `target.extend` calls.
- Automatic reverse lookup from mixin file to its mapped target component via local `requirejs-config.js`.
- Member resolution fallback: mixin locals → target → parent chain (same as core component).

## [1.0.2] - 2026-04-08

### Added

- CodeLens labels displaying count of mixins overriding each method (`Mixins: N`).
- Visual highlights on methods overridden by applied mixins with hover details showing mixin list.
- New parser helper to collect method definitions from `.extend({...})` objects.
- New setting: `requireModuleSupport.enableMixinCodeLensProvider` (default: true).
- New setting: `requireModuleSupport.enableMixinDecorations` (default: true).

### Changed

- Extracted shared applied-mixins lookup logic to reusable helper module.
- Reused shared mixin discovery in `Show Applied Mixins`, CodeLens provider, and visual decorations.

## [1.0.1] - 2026-04-01

### Added

- New command: Show Applied Mixins.
- The command scans all `requirejs-config.js` files in the workspace and lists mixins applied to the current module.
- Quick Pick navigation to open the selected mixin file.

### Changed

- The Show Applied Mixins command is shown in context menu and command palette only for files recognized as Core Component modules (`.extend(...)`).

## [1.0.0] - 2026-03-31

### Fork

- Forked from the original RequireJS extension line.
- This fork is maintained by Rodrigo Silva.
- Focus shifted to Magento 2 Core Component development patterns.

### Added

- Improved module path navigation to land on `.extend(...)` in target modules.
- `_super` navigation across parent chain (up to 3 inheritance levels).
- `this.member` resolution across inheritance (up to 3 levels) with priority:
    1. `defaults`
    2. `declareObservables`
    3. methods
- Better support for Core Component-style overrides and inherited lookups.

### Notes

- Versioning for this fork starts at `1.0.0`.
