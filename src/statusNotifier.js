const vscode = require('vscode');

class StatusNotifier {
	constructor () {
		this.statusBarItem = vscode.window.createStatusBarItem();
	}

	show () {
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = undefined;
		}
		this.statusBarItem.show();
	}

	hide () {
		this.timeout = setTimeout(() => {
			this.statusBarItem.hide();
			this.timeout = undefined;
		}, 3000);
	}

	notify (icon, summary, details) {
		this.statusBarItem.text = '$(' + icon + ') ' + summary;
		this.statusBarItem.tooltip = details;
	}

	dispose () {
		this.statusBarItem.dispose();
	}
}

module.exports = StatusNotifier;
