# Changelog

All notable changes to this fork are documented in this file.

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
