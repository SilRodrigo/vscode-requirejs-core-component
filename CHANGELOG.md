# Changelog

All notable changes to this fork are documented in this file.

## [1.0.6] - 2026-05-15

### Fixed

- XML Layout CodeLens now correctly distinguishes items with the same name at different nesting levels using full ancestry path (e.g. `customer` vs `action-container/filter/customer`).
- Override count and navigation no longer bleed across items that share a name but live at different depths in the XML hierarchy.

### Changed

- `findChildrenItems` now returns a `path` field (ancestor item names joined by `/`) in addition to `name` and `line`.
- Override map is keyed by full path instead of name, preventing false matches.
- CodeLens command arguments and QuickPick labels now use the full item path for disambiguation.

## [1.0.5] - 2026-05-05

### Added

- NS component navigation: Go to Definition now supports `ns.*` members within `this.useNs(callback)` contexts.
- NS Navigation Configuration file (`vscode-ns-navigation-config.js`) for mapping scope roots to NS components.
- New setting `requireModuleSupport.nsNavigationConfigFile` to enable/configure NS navigation.
- Context-aware detection of `useNs` callbacks via AST traversal to avoid false positives.
- Scope matching with longest-prefix precedence: more specific scope roots take priority.
- NS component paths are resolved using the same RequireJS alias rules (including array fallback).
- `self = this` alias navigation: Go to Definition on `self.member` (or any variable assigned `this`) behaves the same as `this.member`, supporting arbitrary alias names.
- XML Layout CodeLens: shows override count above `<item>` children inside Magento 2 layout XML files.
- Click on XML Layout CodeLens opens a QuickPick list of overriding files and navigates to the overriding item.
- Blue highlight decoration on `<item>` lines that have overrides in other layout files.
- Go to Definition on `<referenceBlock name="...">` navigates to the matching `<block>` definition in other XML files.
- New setting `requireModuleSupport.enableXmlLayoutCodeLensProvider` to enable/disable XML Layout CodeLens (default: `true`).
- New setting `requireModuleSupport.xmlLayoutPaths` to configure glob patterns for scanning XML layout files.

## [1.0.4] - 2026-04-27

### Added

- Support for multiple path entries per alias in `require.config({ paths })`.
- Ordered fallback resolution for aliases configured as arrays: first existing file is selected.
- Go to Definition for RequireJS module paths in XML files.
- `Go to Definition Module` command now resolves module paths in XML too.
- Autocomplete for module paths now aggregates suggestions from all configured alias paths.
- Go to Definition now returns multiple results when the same module path exists in more than one alias target path.

### Changed

- Reverse module-path detection now supports aliases declared with multiple base paths.
- Definition provider registration now includes XML documents.
- Extension activation now includes `onLanguage:xml`.
- Module path resolution now exposes ordered candidate paths for both single and multiple alias mappings.

## [1.0.3] - 2026-04-09

* Do not let invalid code break reference lookup ([d69371d](https://github.com/prantlf/vscode-requirejs/commit/d69371d35f1d8c7b7972859ba31bd9ba3f897d24))



## [2.1.1](https://github.com/prantlf/vscode-requirejs/compare/v2.1.0...v2.1.1) (2022-08-08)


### Bug Fixes

* Deploy the language pack as a bundle ([8d1d74b](https://github.com/prantlf/vscode-requirejs/commit/8d1d74b9535d0c9ac215cb5454c7e4266cb6ee69))
* Implement pluralisation for localised strings ([0a3bc52](https://github.com/prantlf/vscode-requirejs/commit/0a3bc5284ed02f3d938a0ce408336185c2480b24))



# [2.1.0](https://github.com/prantlf/vscode-requirejs/compare/v2.0.0...v2.1.0) (2022-08-02)


### Bug Fixes

* Change the key of renameExportedSymbol to crtl+f2 ([ea2c7c9](https://github.com/prantlf/vscode-requirejs/commit/ea2c7c995275f1e93d245544f4ff2ad8c8892ee5))


### Features

* Add Czech localisation ([4dbb9ce](https://github.com/prantlf/vscode-requirejs/commit/4dbb9cecdd115e9b6dd78f581a84c7df371495f7))



# [2.0.0](https://github.com/prantlf/vscode-requirejs/compare/v1.0.2...v2.0.0) (2022-07-31)


### Bug Fixes

* Make RequireJS config paths relative to workspace file ([dcfd8fa](https://github.com/prantlf/vscode-requirejs/commit/dcfd8fa65438a5b6012b1ba7e9939616be059502))


### BREAKING CHANGES

* If you used multi-root workspaces, you will need to modify paths in variables `requireModuleSupport.modulePath` and `requireModuleSupport.configFile` to be relative to the directory with the `.code-workspace` file. Because the support for multi-root workspaces wasn't complete, you had to use paths relative to a workspace folder. If the workspace folders had different directory nesting level in relation to the workspace root, it was impossible to configure RequireJS properly. The easiest solution is placing the RequireJS config file next to the `.code-workspace` file and setting `requireModuleSupport.modulePath` to `"."` and `requireModuleSupport.configFile` to the RequireJS config file name.

Paths inside the RequireJS config file are always supposed to be relative to the workspace root, which has not changed.



## [1.0.2](https://github.com/prantlf/vscode-requirejs/compare/v1.0.1...v1.0.2) (2022-07-17)

### Bug Fixes

* Recognise identifiers in object destructuring ([2532bed](https://github.com/prantlf/vscode-requirejs/commit/2532bed6a8f9c4bd86c104138eee410f331c1ef1))
* Support named imports ([5f7c2a2](https://github.com/prantlf/vscode-requirejs/commit/5f7c2a29904faf1b53c7c02082e8c6fe73011535))

## [1.0.1](https://github.com/prantlf/vscode-requirejs/compare/v1.0.0...v1.0.1) (2022-07-10)

### Bug Fixes

* Fix extension title and logo.

## 1.0.0 (2022-07-10)

Fork the original project and rewrite it to parse sources to AST and traverse it instead of using regexp matching.

* Autocomplete module names when typing.
* Show module paths when hovering above module names.
* Rename imported and exported symbols.
* Support module formats CJS, AMD, UMD and ES.
* Support modern JavaScript (ES2021).

The new extension might behave differently than the original one, but it should follow the language more correctly.

## [0.1.9] - 2017-22-12
### Added

- Added support for comments in require dependency list. Special thanks to [prantlf](https://github.com/prantlf)
- Fixed problem navigating to an inline require statement's module.

## [0.1.7] - 2017-21-12
### Added

- Added RequireJS config file support. Special thanks to [prantlf](https://github.com/prantlf)

## [0.1.6] - 2017-29-08
### Changed

- Added patreon URL

## [0.1.4] - 2017-15-08
### Changed

- Fixed a bug causing definition navigation.
- Improved constructor search. It was previously matching partial words and was not case sensitive resulting in inifinite loops.

## [0.1.2] - 2017-14-08
### Changed

- Fixed a bug causing 100% CPU usage when trying to navigate on a property assigned the the main object such as `el = el.offsetParent`.

## [0.1.1] - 2017-07-08
### Changed

- Now, the extension only runs for JavaScript files.

## [0.1.0] - 2017-05-08
### Added

- Added support for multiple require/define statements in a single file.
- This version covers all important use cases.

## [0.0.33] - 2017-20-07
### Changed

- CommonJS style requires inside the requireJS blocks are now supported.

        define(function(require) {
            var moduleB = require('moduleB')
            moduleB.prop
        })

## [0.0.32] - 2017-06-07
### Changed

- Fixed a bug causing navigation error when the variable name includes the constructor name.

## [0.0.31] - 2017-05-07
### Changed

- Fixed potential run-time error sources.

## [0.0.30] - 2017-18-06
### Added

- Handle relative paths and unknown modules.

## [0.0.29] - 2017-26-05
### Added

- Multiline statement and space support added.

## [0.0.28] - 2017-20-03
### Changed

- Fixed 100% CPU usage problem.
- Resolved a console error.
- Fixed bugs preventing the last search on target module.

## [0.0.23] - 2017-15-03
### Changed

- Changed logo for larger display.

## [0.0.21] - 2017-14-03
### Changed

- Can navigate to modules via strings in module name list.

## [0.0.20] - 2017-14-03
### Changed

- Imported module does not have to be used with new keyword anymore.
- Simple comments does not interfere with definition navigation.
- Fixed a problem causing navigation error in some cases.

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
