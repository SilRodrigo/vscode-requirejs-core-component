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

- New setting (onlyNavigateToFile) to decide whether to do a final search on the landing page.

## [0.0.18] - 2017-13-03
### Changed

- Module path is now set relative to workspace root with "requireModuleSupport.modulePath" without leading and trailing slashes. This also fixed OS path separator related issues.
- Fixed an undefined position causing runtime error.

## [0.0.16] - 2017-13-03
### Changed
- User is warned when there is not a found definition.

## [0.0.15] - 2017-13-03
### Changed

- Removed code eval.
- Fixed multiline module name / function argument list problem.

### Added
- Added support for directly used require statements such as require('...').use()
- Added support for modules not having a name.

## [0.0.11] - 2017-28-02
### Changed

- Added repository field & reference to github.
- Activate extension only for js files.

## [0.0.10] - 2017-17-02
### Changed

- Changed description.

## [0.0.9] - 2017-16-02
### Changed
- Fixed a bug when a module dependency is used without being defined in function arguments.

## [0.0.8] - 2017-16-02
### Added
- Better instantiation support.
