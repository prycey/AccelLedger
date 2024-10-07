/**
 * Automatic padding of gaps between entries.
 */

const { ONE, ZERO } = require('../core/number');
const { Transaction, Balance } = require('../core/data');
const amount = require('../core/amount');
const account = require('../core/account');
const realization = require('../acceledger/core/realization');
const getters = require('../core/getters');

class BalanceError extends Error {
    constructor(source, message, entry) {
        super(message);
        this.source = source;
        this.entry = entry;
    }
}

function getBalanceTolerance(balanceEntry, optionsMap) {
    if (balanceEntry.tolerance !== null) {
        return balanceEntry.tolerance;
    }

    const expo = balanceEntry.amount.number.exponent;
    if (expo < 0) {
        const tolerance = optionsMap.inferred_tolerance_multiplier * 2;
        return ONE.scaleb(expo) * tolerance;
    }

    return ZERO;
}

function check(entries, optionsMap) {
    const newEntries = [];
    const checkErrors = [];

    const realRoot = new realization.RealAccount("");

    const assertedAccounts = new Set(
        entries.filter(entry => entry instanceof Balance).map(entry => entry.account)
    );

    const assertedMatchList = Array.from(assertedAccounts).map(account.parentMatcher);

    for (const account of getters.getAccounts(entries)) {
        if (assertedAccounts.has(account) || assertedMatchList.some(match => match(account))) {
            realization.getOrCreate(realRoot, account);
        }
    }

    const openCloseMap = getters.getAccountOpenClose(entries);

    for (const entry of entries) {
        if (entry instanceof Transaction) {
            for (const posting of entry.postings) {
                const realAccount = realization.get(realRoot, posting.account);
                if (realAccount) {
                    realAccount.balance.addPosition(posting);
                }
            }
        } else if (entry instanceof Balance) {
            const expectedAmount = entry.amount;
            let open;
            try {
                [open] = openCloseMap[entry.account];
            } catch (error) {
                checkErrors.push(new BalanceError(
                    entry.meta,
                    `Invalid reference to unknown account '${entry.account}'`,
                    entry
                ));
            }

            if (expectedAmount && open && open.currencies && !open.currencies.includes(expectedAmount.currency)) {
                checkErrors.push(new BalanceError(
                    entry.meta,
                    `Invalid currency '${expectedAmount.currency}' for Balance directive`,
                    entry
                ));
            }

            const realAccount = realization.get(realRoot, entry.account);
            if (!realAccount) {
                throw new Error(`Missing ${entry.account}`);
            }
            const subtreeBalance = realization.computeBalance(realAccount, false);

            const balanceAmount = subtreeBalance.getCurrencyUnits(expectedAmount.currency);

            const diffAmount = amount.sub(balanceAmount, expectedAmount);

            const tolerance = getBalanceTolerance(entry, optionsMap);

            if (Math.abs(diffAmount.number) > tolerance) {
                checkErrors.push(new BalanceError(
                    entry.meta,
                    `Balance failed for '${entry.account}': expected ${expectedAmount} != accumulated ${balanceAmount} (${Math.abs(diffAmount.number)} ${diffAmount.number > 0 ? 'too much' : 'too little'})`,
                    entry
                ));

                entry = {...entry, meta: {...entry.meta}, diffAmount};
            }
        }

        newEntries.push(entry);
    }

    return [newEntries, checkErrors];
}

module.exports = {
    BalanceError,
    getBalanceTolerance,
    check
};