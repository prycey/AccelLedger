const Decimal = require("decimal.js");

class Price {
  constructor(date, currency, amount) {
    this.date = date;
    this.currency = currency;
    this.amount = amount;
  }
}

const ONE = new Decimal(1);
const ZERO = new Decimal(0);

// Assume Price class is imported from another file
// import { Price } from './someOtherFile';

class PriceMap extends Map {
  constructor() {
    super();
    this.forwardPairs = [];
  }
}

function buildPriceMap(entries) {
  const priceEntries = entries.filter((entry) => entry instanceof Price);
  const priceMap = new Map();

  for (const price of priceEntries) {
    const baseQuote = [price.currency, price.amount.currency];
    if (!priceMap.has(baseQuote.toString())) {
      priceMap.set(baseQuote.toString(), []);
    }
    priceMap
      .get(baseQuote.toString())
      .push([price.date, new Decimal(price.amount.number)]);
  }

  const inversedUnits = [];
  for (const [baseQuote, values] of priceMap.entries()) {
    const [base, quote] = baseQuote.split(",");
    if (priceMap.has(`${quote},${base}`)) {
      inversedUnits.push([base, quote]);
    }
  }

  for (const [base, quote] of inversedUnits) {
    const bqPrices = priceMap.get(`${base},${quote}`);
    const qbPrices = priceMap.get(`${quote},${base}`);
    const remove =
      bqPrices.length < qbPrices.length ? [base, quote] : [quote, base];
    const [removeBase, removeQuote] = remove;

    const removeList = priceMap.get(`${removeBase},${removeQuote}`);
    const insertList = priceMap.get(`${removeQuote},${removeBase}`);
    priceMap.delete(`${removeBase},${removeQuote}`);

    const invertedList = removeList
      .filter(([, rate]) => !rate.equals(ZERO))
      .map(([date, rate]) => [date, ONE.div(rate)]);
    insertList.push(...invertedList);
  }

  const sortedPriceMap = new PriceMap();
  for (const [baseQuote, dateRates] of priceMap.entries()) {
    const sortedUnique = dateRates
      .sort((a, b) => a[0] - b[0])
      .filter(
        (item, index, self) =>
          index === self.findIndex((t) => t[0].getTime() === item[0].getTime())
      );
    sortedPriceMap.set(baseQuote, sortedUnique);
  }

  const forwardPairs = Array.from(sortedPriceMap.keys());
  for (const baseQuote of forwardPairs) {
    const [base, quote] = baseQuote.split(",");
    const priceList = sortedPriceMap.get(baseQuote);
    const invertedList = priceList
      .filter(([, price]) => !price.equals(ZERO))
      .map(([date, price]) => [date, ONE.div(price)]);
    sortedPriceMap.set(`${quote},${base}`, invertedList);
  }

  sortedPriceMap.forwardPairs = forwardPairs;
  return sortedPriceMap;
}

function project(
  origPriceMap,
  fromCurrency,
  toCurrency,
  baseCurrencies = null
) {
  if (fromCurrency === toCurrency) {
    return origPriceMap;
  }

  const priceMap = new Map(origPriceMap);

  const currencyPair = [fromCurrency, toCurrency];
  for (const [baseQuote, prices] of priceMap.entries()) {
    const [base, quote] = baseQuote.split(",");
    if (quote !== fromCurrency) continue;
    if (baseCurrencies && !baseCurrencies.has(base)) continue;

    const existingPrices = new Set(
      (priceMap.get(`${base},${toCurrency}`) || []).map(([date]) =>
        date.getTime()
      )
    );

    const newProjected = [];
    for (const [date, price] of prices) {
      const [rateDate, rate] = getPrice(priceMap, currencyPair, date);
      if (!rate) continue;
      if (existingPrices.has(rateDate.getTime())) continue;

      const newPrice = price.mul(rate);
      newProjected.push([date, newPrice]);
    }

    if (newProjected.length > 0) {
      const projected = priceMap.get(`${base},${toCurrency}`) || [];
      projected.push(...newProjected);
      projected.sort((a, b) => a[0] - b[0]);
      priceMap.set(`${base},${toCurrency}`, projected);

      const inverted = priceMap.get(`${toCurrency},${base}`) || [];
      inverted.push(
        ...newProjected.map(([date, rate]) => [
          date,
          rate.equals(ZERO) ? ZERO : ONE.div(rate),
        ])
      );
      inverted.sort((a, b) => a[0] - b[0]);
      priceMap.set(`${toCurrency},${base}`, inverted);
    }
  }

  return priceMap;
}

function normalizeBaseQuote(baseQuote) {
  if (typeof baseQuote === "string") {
    const [base, quote] = baseQuote.split("/");
    return [base, quote];
  }
  return baseQuote;
}

function lookupPriceAndInverse(priceMap, baseQuote) {
  const key = baseQuote.join(",");
  if (priceMap.has(key)) {
    return priceMap.get(key);
  }
  const inverseKey = baseQuote.reverse().join(",");
  if (priceMap.has(inverseKey)) {
    return priceMap.get(inverseKey);
  }
  throw new Error(`Price not found for ${baseQuote.join("/")}`);
}

function getAllPrices(priceMap, baseQuote) {
  baseQuote = normalizeBaseQuote(baseQuote);
  return lookupPriceAndInverse(priceMap, baseQuote);
}

function getLatestPrice(priceMap, baseQuote) {
  baseQuote = normalizeBaseQuote(baseQuote);
  const [base, quote] = baseQuote;

  if (!quote || base === quote) {
    return [null, ONE];
  }

  try {
    const priceList = lookupPriceAndInverse(priceMap, baseQuote);
    return priceList[priceList.length - 1] || [null, null];
  } catch (error) {
    return [null, null];
  }
}

function getPrice(priceMap, baseQuote, date = null) {
  if (!date) {
    return getLatestPrice(priceMap, baseQuote);
  }

  const [base, quote] = normalizeBaseQuote(baseQuote);
  if (!quote || base === quote) {
    return [null, ONE];
  }

  try {
    const priceList = lookupPriceAndInverse(priceMap, [base, quote]);
    const index = priceList.findIndex(([priceDate]) => priceDate > date);
    return index > 0 ? priceList[index - 1] : [null, null];
  } catch (error) {
    return [null, null];
  }
}

function getLastPriceEntries(entries, date) {
  const priceEntryMap = {};
  for (const entry of entries) {
    if (date && entry.date >= date) {
      break;
    }
    if (entry instanceof Price) {
      const baseQuote = [entry.currency, entry.amount.currency];
      priceEntryMap[baseQuote] = entry;
    }
  }
  return Object.values(priceEntryMap).sort((a, b) => a.date - b.date);
}

module.exports = {
  Price,
  getLastPriceEntries,
  PriceMap,
  buildPriceMap,
  project,
  lookupPriceAndInverse,
  normalizeBaseQuote,
  getAllPrices,
  getLatestPrice,
  getPrice,
};
