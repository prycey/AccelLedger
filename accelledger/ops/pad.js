/**
 * Automatic padding of gaps between entries.
 */

const { Transaction, Pad, Balance, Posting, EMPTY_SET } = require('../core/data');
const { Amount } = require('../core/amount');
const account = require('../core/account');
const inventory = require('../core/inventory');
const realization = require('../core/realization');
const getters = require('../core/getters');
const { FLAG_PADDING } = require('../core/flags');

class PadError extends Error {
    constructor(source, message, entry) {
        super(message);
        this.source = source;
        this.entry = entry;
    }
}

/**
 * Insert transaction entries for to fulfill a subsequent balance check.
 *
 * @param {Array} entries - A list of directives.
 * @param {Object} optionsMap - A parser options dict.
 * @returns {Array} A new list of directives, with Pad entries inserted, and a list of new errors produced.
 */
function pad(entries, optionsMap) {
    const padErrors = [];
    const pads = entries.filter(entry => entry instanceof Pad);
    const padDict = groupBy(pads, pad => pad.account);

    const byAccount = realization.postingsByAccount(entries);

    const newEntries = Object.fromEntries(pads.map(pad => [pad.id, []]));

    for (const [account, padList] of Object.entries(padDict).sort()) {
        let activePad = null;
        const postings = [];
        const isChild = account.parentMatcher(account);

        for (const [itemAccount, itemPostings] of Object.entries(byAccount)) {
            if (isChild(itemAccount)) {
                postings.push(...itemPostings);
            }
        }
        postings.sort((a, b) => a.date - b.date);

        let paddedLots = new Set();
        const padBalance = new inventory.Inventory();

        for (const entry of postings) {
            if (entry instanceof Transaction) {
                padBalance.addPosition(entry.posting);
            } else if (entry instanceof Pad && entry.account === account) {
                activePad = entry;
                paddedLots = new Set();
            } else if (entry instanceof Balance) {
                const checkAmount = entry.amount;
                const balanceAmount = padBalance.getCurrencyUnits(checkAmount.currency);
                const diffAmount = Amount.sub(balanceAmount, checkAmount);

                const tolerance = getBalanceTolerance(entry, optionsMap);

                if (Math.abs(diffAmount.number) > tolerance) {
                    if (activePad && !paddedLots.has(checkAmount.currency)) {
                        const positions = padBalance.getPositions().filter(pos => 
                            pos.units.currency === checkAmount.currency
                        );

                        for (const position of positions) {
                            if (position.cost !== null) {
                                padErrors.push(new PadError(
                                    entry.meta,
                                    `Attempt to pad an entry with cost for balance: ${padBalance}`,
                                    activePad
                                ));
                            }
                        }

                        const diffPosition = {
                            units: new Amount(
                                checkAmount.number - balanceAmount.number,
                                checkAmount.currency
                            ),
                            cost: null
                        };

                        const narration = `(Padding inserted for Balance of ${checkAmount} for difference ${diffPosition.units})`;
                        const newEntry = new Transaction(
                            {...activePad.meta},
                            activePad.date,
                            FLAG_PADDING,
                            null,
                            narration,
                            EMPTY_SET,
                            EMPTY_SET,
                            []
                        );

                        newEntry.postings.push(new Posting(
                            activePad.account,
                            diffPosition.units,
                            diffPosition.cost,
                            null,
                            null,
                            entry.meta
                        ));

                        const negDiffPosition = {
                            units: Amount.neg(diffPosition.units),
                            cost: diffPosition.cost
                        };

                        newEntry.postings.push(new Posting(
                            activePad.sourceAccount,
                            negDiffPosition.units,
                            negDiffPosition.cost,
                            null,
                            null,
                            entry.meta
                        ));

                        newEntries[activePad.id].push(newEntry);

                        const [pos] = padBalance.addPosition(diffPosition);
                        if (pos !== null && pos.isNegativeAtCost()) {
                            throw new Error(`Position held at cost goes negative: ${pos}`);
                        }
                    }

                    paddedLots.add(checkAmount.currency);
                }
            }
        }
    }

    const paddedEntries = [];
    for (const entry of entries) {
        paddedEntries.push(entry);
        if (entry instanceof Pad) {
            const entryList = newEntries[entry.id];
            if (entryList.length > 0) {
                paddedEntries.push(...entryList);
            } else {
                padErrors.push(new PadError(entry.meta, "Unused Pad entry", entry));
            }
        }
    }

    return [paddedEntries, padErrors];
}

function groupBy(array, keyFunc) {
    return array.reduce((acc, item) => {
        const key = keyFunc(item);
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(item);
        return acc;
    }, {});
}

module.exports = {
    pad,
    PadError
};