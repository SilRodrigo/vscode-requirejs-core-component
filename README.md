# CoreComponent Module Support

CoreComponent Module Support is a VS Code extension focused on Magento 2 projects that use AMD modules and the Core Component pattern.

It improves navigation across module inheritance and helps developers move faster in frontend codebases with deep extension chains.

## Fork Notice

This repository is a fork of the original RequireJS extension work.

Original base and inspiration:
- Require Module Support by Ali Naci Erdem
- RequireJS Module Support by Ferdinand Prantl

This fork is maintained by Rodrigo Silva and is focused on Magento 2 Core Component workflows.

## Main Features

- Go to definition for AMD module paths in `define` and `require`.
- Go to symbol definitions across modules.
- Module path completion and hover support.
- Rename imported and exported symbols.
- Core Component specific navigation enhancements:
  - Navigate from module path to `.extend(...)` declaration in the target module.
  - Navigate from `_super` to the overridden method in the parent chain.
  - Navigate `this.member` across inheritance with fallback order:
    1. `defaults`
    2. `declareObservables`
    3. methods

## Magento 2 Core Component Focus

The extension is optimized for patterns commonly used in Magento 2 frontend modules, including:

- `Component.extend({...})` style inheritance.
- Parent method resolution for overrides.
- Cross-file lookup of properties and methods inherited from base components.

## Installation

Install from a local VSIX package:

```bash
code --install-extension ./vscode-requirejs-1.0.1.vsix --force
```

If your VSIX file has a different name, replace it in the command above.

## Configuration

All extension settings are prefixed with `requireModuleSupport.`.

Common settings:

- `enableDefinitionProvider`
- `enableReferenceProvider`
- `enableCompletionItemProvider`
- `enableHoverProvider`
- `enableRenameProvider`
- `configFile`
- `modulePath`
- `onlyNavigateToFile`
- `lookupMaxLevels`
- `observableDeclarationMethodNames`

Core Component navigation settings:

- `requireModuleSupport.lookupMaxLevels`
  - Controls max parent-chain depth used for inherited lookups (`this.member`, `_super`, and inherited identifier fallback).
  - Example: `3`
- `requireModuleSupport.observableDeclarationMethodNames`
  - Method names where assignments like `this.member = ...` are treated as observable declarations.
  - Example: `["declareObservables"]`
- `requireModuleSupport.mixinConfigSearchPatterns`
  - Workspace-relative glob patterns used to find `requirejs-config.js` files when listing applied mixins.
  - Default: `["app/design/frontend/**/requirejs-config.js"]`
  - Example: `["app/design/frontend/**/requirejs-config.js", "app/code/**/requirejs-config.js"]`

Conventions that are fixed (not configurable):

- Inheritance is detected through `.extend(...)`.
- Parent override navigation uses `_super`.
- Member fallback order remains: `defaults` -> observable declarations -> methods.

You can set these in VS Code settings JSON.

### `.vscode/settings.json`

This file tells the extension where the RequireJS configuration file is located.

```json
{
  "requireModuleSupport.configFile": ".vscode/vscode-require-config.js"
}
```

### `.vscode/vscode-require-config.js`

This file should expose the RequireJS paths used by the Magento 2 frontend being developed.

```javascript
(function (require) {
  (function () {
    require.config({
      paths: {
        Vendor_Core: 'vendor/vendor-name/module-core/view/frontend/web',
        Vendor_Feature: 'app/design/frontend/Vendor/theme/Vendor_Feature/web',
        Vendor_Shared: 'app/code/Vendor/Shared/view/frontend/web'
      }
    })
  })()
})(require)
```

Adjust the aliases and paths to match the modules available in your Magento 2 codebase.

## Show Applied Mixins Requirement

For `Show Applied Mixins` to work correctly and open the selected mixin files, the involved module aliases must be resolvable through `requireModuleSupport.configFile`.

In practice, this means:

- the current module must be reachable through the RequireJS paths configured in `.vscode/vscode-require-config.js`
- the mixin module paths found in `requirejs-config.js` must also be mapped there

If the aliases are not configured, the extension may still detect the mixin relationship, but it will not be able to resolve and open the target file reliably.

## Development

Build the extension output:

```bash
npx gulp default
```

Create a VSIX package:

```bash
npx @vscode/vsce package
```

## License

Copyright (c) 2026 Rodrigo Silva<br>
Copyright (c) 2020-2022 Ferdinand Prantl<br>
Copyright (c) 2020      Ali Naci Erdem

Licensed under the [MIT license].

[MIT license]: ./LICENSE
