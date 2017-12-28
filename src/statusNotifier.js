const { window } = require('vscode');

class StatusNotifier {
	/**
		 * Initializes a new instance.
		 */
	constructor () {
		this.statusBarItem = window.createStatusBarItem();
	}

	/**
		 * Shows a new status bar item.
		 * @returns {Void} Nothing.
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
		 * @returns {Void} Nothing.
		 */
	hide () {
		this.timeout = setTimeout(() => {
			this.statusBarItem.hide();
			this.timeout = undefined;
		}, 3000);
	}

	/**
		 * Fills content of the the status bar item.
		 * @param {String} icon An Opticon icon identifier without the "opticon-" prefix.
		 * @param {String} summary A short text to show directly in the status bar.
		 * @param {String} details A long text to show as a tooltip, when hovering above the status bar item.
		 * @returns {Void} Nothing.
		 */
	notify (icon, summary, details) {
		this.statusBarItem.text = '$(' + icon + ') ' + summary;
		this.statusBarItem.tooltip = details;
	}

	/**
		 * Disposes of disposable child objects.
		 * @returns {Void} Nothing.
		 */
	dispose () {
		this.statusBarItem.dispose();
	}
}

module.exports = StatusNotifier;
