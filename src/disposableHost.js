/**
	 * Adds an object, which should be disposed of later to the `disposables` array on the owner object.
	 * @param {Object} owner An object carrying disposable sub-objects in the `disposables` array.
	 * @param {Object} disposable Object, which should be disposed of later.
	 * @returns {Void} Nothing.
	 */
function addDisposable (owner, disposable) {
	if (!owner.disposables) {
		owner.disposables = [];
	}
	owner.disposables.push(disposable);
}

/**
	 * Adds an object instance as a sub-object property to the owner object.
	 * If an existing instance is specified, if will just create a property with it.
	 * If not, a new instance is created and scheduled for a later disposal.
	 * @param {Object} owner An object carrying disposable sub-objects in the `disposables` array.
	 * @param {String} name name of the property on the owner object to carry the new object instance.
	 * @param {Function} Type Function object to create a new instance of, if the specific instance is undefined.
	 * @param {Object} instance A new object instance, if available.
	 * @returns {Void} Nothing.
	 */
function hostOrCreateDisposable (owner, name, Type, instance) {
	if (instance) {
		owner[name] = instance;
	} else {
		const disposable = new Type();

		owner[name] = disposable;
		addDisposable(disposable);
	}
}

/**
	 * Disposes all objects from the `disposables` array on the owner object.
	 * @param {Object} owner An object carrying disposable sub-objects in the `disposables` array.
	 * @returns {Void} Nothing.
	 */
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
