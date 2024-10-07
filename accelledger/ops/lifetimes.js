/**
 * Given a AccelLedger ledger, compute time intervals where we hold each commodity.
 *
 * This script computes, for each commodity, which time intervals it is required at.
 * This can then be used to identify a list of dates at which we need to fetch prices
 * in order to properly fill the price database.
 */

const { Transaction, Open, Close, Balance, Note, Document, Pad, Custom } = require('../core/data');
const inventory = require('../core/inventory');

const ONEDAY = 24 * 60 * 60 * 1000; // One day in milliseconds

/**
 * Given a list of directives, figure out the life of each commodity.
 *
 * @param {Array} entries - A list of directives.
 * @returns {Object} A map of (currency, cost-currency) commodity strings to lists of [start, end] Date pairs.
 */
function getCommodityLifetimes(entries) {
    const lifetimes = {};
    let commodities = new Set();
    const balances = {};

    for (const entry of entries) {
        if (!(entry instanceof Transaction)) continue;

        let commoditiesChanged = false;
        for (const posting of entry.postings) {
            const balance = balances[posting.account] || new inventory.Inventory();
            const commoditiesBefore = balance.currencyPairs();
            balance.addPosition(posting);
            const commoditiesAfter = balance.currencyPairs();
            
            if (!setsEqual(commoditiesBefore, commoditiesAfter)) {
                commoditiesChanged = true;
            }
            
            balances[posting.account] = balance;
        }

        if (commoditiesChanged) {
            const newCommodities = new Set(
                Object.values(balances).flatMap(inv => inv.currencyPairs())
            );

            for (const currency of difference(newCommodities, commodities)) {
                if (!lifetimes[currency]) lifetimes[currency] = [];
                lifetimes[currency].push([entry.date, null]);
            }

            for (const currency of difference(commodities, newCommodities)) {
                const lifetime = lifetimes[currency];
                const [beginDate] = lifetime.pop();
                lifetime.push([beginDate, new Date(entry.date.getTime() + ONEDAY)]);
            }

            commodities = newCommodities;
        }
    }

    return lifetimes;
}

/**
 * Compress a list of date pairs to ignore short stretches of unused days.
 *
 * @param {Array} intervals - A list of pairs of Date instances.
 * @param {number} numDays - The number of unused days to require for intervals to be distinct, to allow a gap.
 * @returns {Array} A new list of intervals where some intervals may have been joined.
 */
function compressIntervalsDays(intervals, numDays) {
    const ignoreInterval = numDays * ONEDAY;
    const newIntervals = [];
    let [lastBegin, lastEnd] = intervals[0];

    for (let i = 1; i < intervals.length; i++) {
        const [dateBegin, dateEnd] = intervals[i];
        if (dateBegin - lastEnd < ignoreInterval) {
            lastEnd = dateEnd;
        } else {
            newIntervals.push([lastBegin, lastEnd]);
            [lastBegin, lastEnd] = [dateBegin, dateEnd];
        }
    }
    newIntervals.push([lastBegin, lastEnd]);

    return newIntervals;
}

/**
 * Trim a list of date pairs to be within a start and end date.
 *
 * @param {Array} intervals - A list of pairs of Date instances
 * @param {Date} trimStart - An inclusive starting date.
 * @param {Date} trimEnd - An exclusive ending date.
 * @returns {Array} A list of new intervals (pairs of [Date, Date]).
 */
function trimIntervals(intervals, trimStart = null, trimEnd = null) {
    if (trimStart && trimEnd && trimEnd < trimStart) {
        throw new Error("Trim end date is before start date");
    }

    return intervals.reduce((newIntervals, [dateBegin, dateEnd]) => {
        if (trimStart && trimStart > dateBegin) {
            dateBegin = trimStart;
        }
        if (trimEnd) {
            if (!dateEnd || trimEnd < dateEnd) {
                dateEnd = trimEnd;
            }
        }

        if (!dateEnd || dateBegin <= dateEnd) {
            newIntervals.push([dateBegin, dateEnd]);
        }

        return newIntervals;
    }, []);
}

/**
 * Compress a lifetimes map to ignore short stretches of unused days.
 *
 * @param {Object} lifetimesMap - A map of currency intervals as returned by getCommodityLifetimes.
 * @param {number} numDays - The number of unused days to ignore.
 * @returns {Object} A new map of lifetimes where some intervals may have been joined.
 */
function compressLifetimesDays(lifetimesMap, numDays) {
    return Object.fromEntries(
        Object.entries(lifetimesMap).map(
            ([currencyPair, intervals]) => [currencyPair, compressIntervalsDays(intervals, numDays)]
        )
    );
}

// Helper functions
function setsEqual(a, b) {
    return a.size === b.size && [...a].every(value => b.has(value));
}

function difference(setA, setB) {
    return new Set([...setA].filter(x => !setB.has(x)));
}

module.exports = {
    getCommodityLifetimes,
    compressIntervalsDays,
    trimIntervals,
    compressLifetimesDays
};