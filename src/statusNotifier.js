const { window } = require('vscode');

/**
 * Places an item with an icon and a short text to the status bar of the VS
 * Code application window. Detailed text can be displayed when hovering
 * above the status bar item with the mouse cursor.
 */
class StatusNotifier {
  /**
   * Initializes a new instance.
   */
  constructor () {
    this.statusBarItem = window.createStatusBarItem();
  }

  /**
   * Shows a new status bar item.
   * @returns {void} Nothing.
   */
  show () {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
    this.statusBarItem.show();
  }

  /**
   * Schedules hiding the status bar item in a couple of seconds.
   * @returns {void} Nothing.
   */
  hide () {
    this.timeout = setTimeout(() => {
      this.statusBarItem.hide();
      this.timeout = undefined;
    }, 3000);
  }

  /**
   * Fills content of the the status bar item.
   * @param {string} icon An Opticon icon identifier without the "opticon-" prefix.
   * @param {string} summary A short text to show directly in the status bar.
   * @param {string} details A long text to show as a tooltip, when hovering above the status bar item.
   * @returns {void} Nothing.
   */
  notify (icon, summary, details) {
    this.statusBarItem.text = '$(' + icon + ') ' + summary;
    this.statusBarItem.tooltip = details;
  }

  /**
   * Disposes of disposable child objects.
   * @returns {void} Nothing.
   */
  dispose () {
    this.statusBarItem.dispose();
  }
}

module.exports = StatusNotifier;
