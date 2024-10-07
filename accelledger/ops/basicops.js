/**
 * Basic filtering and aggregation operations on lists of entries.
 * 
 * This module contains some common basic operations on entries that are complex
 * enough not to belong in core/data.js.
 */

const data = require('../core/data');

/**
 * Yield all the entries which have the given tag.
 * 
 * @param {string} tag - The tag we are interested in.
 * @param {Array} entries - List of entries to filter.
 * @yields {Object} Every entry in 'entries' that tags to 'tag'.
 */
function* filterTag(tag, entries) {
    for (const entry of entries) {
        if (entry instanceof data.Transaction && entry.tags && entry.tags.has(tag)) {
            yield entry;
        }
    }
}

/**
 * Yield all the entries which have the given link.
 * 
 * @param {string} link - The link we are interested in.
 * @param {Array} entries - List of entries to filter.
 * @yields {Object} Every entry in 'entries' that links to 'link'.
 */
function* filterLink(link, entries) {
    for (const entry of entries) {
        if (entry instanceof data.Transaction && entry.links && entry.links.has(link)) {
            yield entry;
        }
    }
}

/**
 * Group the list of entries by link.
 * 
 * @param {Array} entries - A list of directives/transactions to process.
 * @returns {Object} A map of link-name to list of entries.
 */
function groupEntriesByLink(entries) {
    const linkGroups = new Map();
    for (const entry of entries) {
        if (!(entry instanceof data.Transaction) || !entry.links) continue;
        for (const link of entry.links) {
            if (!linkGroups.has(link)) {
                linkGroups.set(link, []);
            }
            linkGroups.get(link).push(entry);
        }
    }
    return linkGroups;
}

/**
 * Compute the intersection of the accounts on the given entries.
 * 
 * @param {Array} entries - A list of Transaction entries to process.
 * @returns {Set} A set of strings, the names of the common accounts from these entries.
 */
function getCommonAccounts(entries) {
    if (!entries.every(entry => entry instanceof data.Transaction)) {
        throw new Error("All entries must be Transactions");
    }

    if (entries.length < 2) {
        return entries.length ? new Set(entries[0].postings.map(posting => posting.account)) : new Set();
    }

    let intersection = new Set(entries[0].postings.map(posting => posting.account));
    for (let i = 1; i < entries.length; i++) {
        const accounts = new Set(entries[i].postings.map(posting => posting.account));
        intersection = new Set([...intersection].filter(x => accounts.has(x)));
        if (intersection.size === 0) break;
    }
    return intersection;
}

module.exports = {
    filterTag,
    filterLink,
    groupEntriesByLink,
    getCommonAccounts
};