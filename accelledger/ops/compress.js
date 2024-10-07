/**
 * Compress multiple entries into a single one.
 *
 * This can be used during import to compress the effective output, for accounts
 * with a large number of similar entries. For example, I had a trading account
 * which would pay out interest every single day. I have no desire to import the
 * full detail of these daily interests, and compressing these interest-only
 * entries to monthly ones made sense. This is the code that was used to carry this
 * out.
 */

const { Decimal } = require('decimal.js');
const { Amount, Posting, Transaction } = require('../core/data');

/**
 * Compress multiple transactions into single transactions.
 *
 * @param {Array} entries - A list of directives.
 * @param {Function} predicate - A function that determines if an entry should be compressed.
 * @returns {Array} A list of directives, with compressible transactions replaced by a summary equivalent.
 */
function compress(entries, predicate) {
    const newEntries = [];
    let pending = [];

    for (const entry of entries) {
        if (entry instanceof Transaction && predicate(entry)) {
            pending.push(entry);
        } else {
            if (pending.length) {
                newEntries.push(merge(pending, pending[pending.length - 1]));
                pending = [];
            }
            newEntries.push(entry);
        }
    }

    if (pending.length) {
        newEntries.push(merge(pending, pending[pending.length - 1]));
    }

    return newEntries;
}

/**
 * Merge the postings of a list of Transactions into a single one.
 *
 * @param {Array} entries - A list of directives.
 * @param {Transaction} prototypeTxn - A Transaction which is used to create the compressed Transaction instance.
 * @returns {Transaction} A new Transaction instance which contains all the postings from the input entries merged together.
 */
function merge(entries, prototypeTxn) {
    const postingsMap = new Map();

    for (const entry of entries) {
        if (entry instanceof Transaction) {
            for (const posting of entry.postings) {
                const key = new Posting(
                    posting.account,
                    new Amount(null, posting.units.currency),
                    posting.cost,
                    posting.price,
                    posting.flag,
                    null
                );
                const existingAmount = postingsMap.get(key) || new Decimal(0);
                postingsMap.set(key, existingAmount.plus(posting.units.number));
            }
        }
    }

    const newEntry = new Transaction(
        prototypeTxn.meta,
        prototypeTxn.date,
        prototypeTxn.flag,
        prototypeTxn.payee,
        prototypeTxn.narration,
        new Set(),
        new Set(),
        []
    );

    const sortedItems = Array.from(postingsMap.entries()).sort((a, b) => {
        if (a[0].account !== b[0].account) return a[0].account.localeCompare(b[0].account);
        if (a[0].units.currency !== b[0].units.currency) return a[0].units.currency.localeCompare(b[0].units.currency);
        return a[1].comparedTo(b[1]);
    });

    for (const [posting, number] of sortedItems) {
        const units = new Amount(number, posting.units.currency);
        newEntry.postings.push(new Posting(
            posting.account,
            units,
            posting.cost,
            posting.price,
            posting.flag,
            posting.meta
        ));
    }

    return newEntry;
}

module.exports = {
    compress,
    merge
};