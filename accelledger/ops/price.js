/**
 * Price-related operations for AccelLedger.
 */

const { Decimal } = require('decimal.js');

class PriceMap {
    constructor() {
        this.prices = new Map();
    }

    add(date, base, quote, price) {
        const key = `${base},${quote}`;
        if (!this.prices.has(key)) {
            this.prices.set(key, new Map());
        }
        this.prices.get(key).set(date.getTime(), new Decimal(price));
    }

    get(date, base, quote) {
        const key = `${base},${quote}`;
        const pricesForPair = this.prices.get(key);
        if (!pricesForPair) return null;

        // Find the closest date that's not after the given date
        const timestamp = date.getTime();
        let closestDate = null;
        let closestPrice = null;

        for (const [priceDate, price] of pricesForPair.entries()) {
            if (priceDate <= timestamp && (!closestDate || priceDate > closestDate)) {
                closestDate = priceDate;
                closestPrice = price;
            }
        }

        return closestPrice;
    }

    get_latest(base, quote) {
        const key = `${base},${quote}`;
        const pricesForPair = this.prices.get(key);
        if (!pricesForPair) return null;

        let latestDate = null;
        let latestPrice = null;

        for (const [priceDate, price] of pricesForPair.entries()) {
            if (!latestDate || priceDate > latestDate) {
                latestDate = priceDate;
                latestPrice = price;
            }
        }

        return latestPrice;
    }
}

function build_price_map(entries) {
    const priceMap = new PriceMap();
    for (const entry of entries) {
        if (entry.type === 'price') {
            priceMap.add(entry.date, entry.currency, entry.amount.currency, entry.amount.number);
        }
    }
    return priceMap;
}

function find_price(entries, date, base, quote) {
    const priceMap = build_price_map(entries);
    return priceMap.get(date, base, quote);
}

function find_latest_price(entries, base, quote) {
    const priceMap = build_price_map(entries);
    return priceMap.get_latest(base, quote);
}

module.exports = {
    PriceMap,
    build_price_map,
    find_price,
    find_latest_price
};