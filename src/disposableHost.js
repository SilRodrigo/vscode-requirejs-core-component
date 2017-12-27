function addDisposable (owner, disposable) {
	if (!owner.disposables) {
		owner.disposables = [];
	}
	owner.disposables.push(disposable);
}

function hostOrCreateDisposable (owner, name, Type, instance) {
	if (instance) {
		owner[name] = instance;
	} else {
		const disposable = new Type();

		owner[name] = disposable;
		addDisposable(disposable);
	}
}

function disposeAll (owner) {
	if (owner.disposables) {
		let disposable;

		while ((disposable = owner.disposables.pop())) {
			disposable.dispose();
		}
	}
}

module.exports = {
	addDisposable: addDisposable,
	hostOrCreateDisposable: hostOrCreateDisposable,
	disposeAll: disposeAll
};
