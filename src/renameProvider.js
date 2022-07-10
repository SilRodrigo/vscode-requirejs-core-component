const { WorkspaceEdit } = require('vscode');
const ReferenceProvider = require('./referenceProvider');
const { hostOrCreateDisposable, disposeAll } = require('./disposableHost');

/**
 * Provides support for renaming identifiers, of either objects or member
 * properties or methods, across all RequireJS modules.
 */
class RenameProvider {
  /**
   * Initializes a new instance.
   * @param {ReferenceProvider} referenceProvider Provider looking up all identifier references.
   */
  constructor (referenceProvider) {
    hostOrCreateDisposable(this, 'referenceProvider', ReferenceProvider, referenceProvider);
  }

  /**
   * Provide a set of editing objects to perform for renaming an identifier.
   * @param {TextDocument} document The document in which the command was invoked.
   * @param {Position} position The position at which the command was invoked.
   * @param {string} newName New identifier name.
   * @param {CancellationToken} cancellationToken A cancellation token.
   * @returns {Promise} Resolves with an array of editing objects.
   */
  provideRenameEdits (document, position, newName, cancellationToken) {
    return this.referenceProvider.provideReferences(document, position, {}, cancellationToken)
      .then(references => {
        let edit;

        if (references) {
          edit = new WorkspaceEdit();
          references.forEach(reference =>
            edit.replace(reference.uri, reference.range, newName));
        }

        return edit;
      });
  }

  /**
   * Disposes of disposable child objects.
   * @returns {void} Nothing.
   */
  dispose () {
    disposeAll(this);
  }
}

module.exports = RenameProvider;
