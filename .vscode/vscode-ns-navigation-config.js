/**
 * NS Navigation Configuration File
 * 
 * Maps scope roots (modules that use this.useNs) to their corresponding NS components.
 * This allows the extension to navigate from ns.* members to the configured NS component.
 * 
 * scopeRoot: Module path or array of paths where useNs is called (longest prefix wins)
 * nsComponent: Module path of the NS component to navigate to
 */

module.exports = {
  mappings: [
    // Example 1: Single scope for a module
    // When you're in Vendor_Module/js/view/form and click ns.statusOptions,
    // it will navigate to Vendor_Shared/js/ns-component
    {
      scopeRoot: "Vendor_Module/js/view/form",
      nsComponent: "Vendor_Shared/js/ns-component"
    },

    // Example 2: Multiple scopes with array (child folders)
    // All child modules under view/form/** will use the same NS component
    {
      scopeRoot: [
        "Vendor_Module/js/view/form",
        "Vendor_Module/js/view/form/sections",
        "Vendor_Module/js/view/form/items"
      ],
      nsComponent: "Vendor_Shared/js/ns-component"
    },

    // Example 3: Different scope with different NS component
    // Modal dialogs might use a different NS component
    {
      scopeRoot: "Vendor_Module/js/view/modal",
      nsComponent: "Vendor_Shared/js/modal-ns-component"
    },

    // Example 4: Generic fallback for entire vendor namespace
    // This acts as a catch-all; more specific rules above will match first
    {
      scopeRoot: "Vendor_Module",
      nsComponent: "Vendor_Shared/js/default-ns-component"
    }
  ]
};
