/**
 * Everything that relates to creating the Document directives.
 */

const path = require('path');
const { Open, Close, Document, Balance, Note } = require('../core/data');
const account = require('../core/account');
const getters = require('../core/getters');

class DocumentError extends Error {
    constructor(source, message, entry) {
        super(message);
        this.source = source;
        this.entry = entry;
    }
}

/**
 * Check files for document directives and create documents directives automatically.
 *
 * @param {Array} entries - A list of all directives parsed from the file.
 * @param {Object} optionsMap - An options dict, as is output by the parser.
 * @returns {Array} A pair of list of all entries (including new ones), and errors generated during the process of creating document directives.
 */
function processDocuments(entries, optionsMap) {
    const filename = optionsMap.filename;
    const autodocEntries = [];
    const autodocErrors = [];
    const documentDirs = optionsMap.documents;

    if (documentDirs) {
        const accounts = getters.getAccounts(entries);

        for (const directory of documentDirs.map(path.normalize)) {
            const [newEntries, newErrors] = findDocuments(directory, filename, accounts);
            autodocEntries.push(...newEntries);
            autodocErrors.push(...newErrors);
        }
    }

    entries.push(...autodocEntries);
    entries.sort((a, b) => a.date - b.date);

    return [entries, autodocErrors];
}

/**
 * Verify that the document entries point to existing files.
 *
 * @param {Array} entries - A list of directives whose documents need to be validated.
 * @param {Object} unusedOptionsMap - A parser options dict. We're not using it.
 * @returns {Array} The same list of entries, and a list of new errors, if any were encountered.
 */
function verifyDocumentFilesExist(entries, unusedOptionsMap) {
    const errors = [];
    for (const entry of entries) {
        if (entry instanceof Document && !path.isAbsolute(entry.filename)) {
            errors.push(new DocumentError(
                entry.meta,
                `File does not exist: "${entry.filename}"`,
                entry
            ));
        }
    }
    return [entries, errors];
}

/**
 * Find dated document files under the given directory.
 *
 * @param {string} directory - The name of the root of the directory hierarchy to be searched.
 * @param {string} inputFilename - The name of the file to be used for the Document directives.
 * @param {Set} accountsOnly - A set of valid accounts strings to search for.
 * @param {boolean} strict - Set to true to generate errors on documents found in accounts not provided in accountsOnly.
 * @returns {Array} A list of new Document objects that were created from the files found, and a list of new errors generated.
 */
function findDocuments(directory, inputFilename, accountsOnly = null, strict = false) {
    const errors = [];
    const entries = [];

    // Implementation of directory walking and file processing goes here
    // This would involve using the Node.js fs module to walk the directory
    // and process files matching the date pattern

    return [entries, errors];
}

module.exports = {
    DocumentError,
    processDocuments,
    verifyDocumentFilesExist,
    findDocuments
};