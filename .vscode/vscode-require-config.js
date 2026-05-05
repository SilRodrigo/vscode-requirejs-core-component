/**
 * RequireJS Configuration File
 * 
 * This file defines the paths to your AMD modules.
 * The extension uses this to resolve module definitions and navigate between files.
 * 
 * You can define:
 * - Single paths: 'Alias': 'path/to/module/web'
 * - Array paths (with fallback): 'Alias': ['primary/path', 'fallback/path']
 *   The extension will check each path in order and use the first one that exists.
 */

require.config({
    paths: {
        // Custom vendor modules
        Vendor_Sales: 'app/design/frontend/Vendor/theme/Vendor_Sales/web',
        Vendor_Core: 'app/code/Vendor/Core/view/frontend/web',

        // With fallback arrays - useful when modules exist in multiple places
        // The extension will look for the primary path first, then fallback to secondary
        Vendor_Catalog: [
            'vendor/vendor-name/module-catalog/view/frontend/web',
            'app/design/frontend/Vendor/theme/Vendor_Catalog/web'
        ],
        Magento_Ui: [
            'vendor/magento/module-ui/view/frontend/web',
            'app/design/frontend/Vendor/theme/Magento_Ui/web'
        ],
        Magento_Customer: [
            'vendor/magento/module-customer/view/frontend/web',
            'app/design/frontend/Vendor/theme/Magento_Customer/web'
        ],
        Magento_Checkout: [
            'vendor/magento/module-checkout/view/frontend/web',
            'app/design/frontend/Vendor/theme/Magento_Checkout/web'
        ],
    }
})