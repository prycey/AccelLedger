const Decimal = require("decimal.js");
const { Amount, Cost, Position } = require("./amount");
const prices = require("./prices");

function getUnits(pos) {
  if (!(pos instanceof Position) && pos.constructor.name !== "Posting") {
    throw new Error("Expected Position or Posting");
  }
  return pos.units;
}

function getCost(pos) {
  if (!(pos instanceof Position) && pos.constructor.name !== "Posting") {
    throw new Error("Expected Position or Posting");
  }
  const cost = pos.cost;
  if (cost instanceof Cost && cost.number instanceof Decimal) {
    return new Amount(cost.number.times(pos.units.number), cost.currency);
  } else {
    return pos.units;
  }
}

function getWeight(pos) {
  if (!(pos instanceof Position) && pos.constructor.name !== "Posting") {
    throw new Error("Expected Position or Posting");
  }
  const units = pos.units;
  const cost = pos.cost;

  if (cost instanceof Cost && cost.number instanceof Decimal) {
    return new Amount(cost.number.times(pos.units.number), cost.currency);
  } else {
    let weight = units;
    if (!(pos instanceof Position) && pos.price) {
      const price = pos.price;
      if (price) {
        const convertedNumber =
          price.number === "MISSING" || units.number === "MISSING"
            ? "MISSING"
            : price.number.times(units.number);
        weight = new Amount(convertedNumber, price.currency);
      }
    }
    return weight;
  }
}

function getValue(pos, priceMap, date = null, outputDatePrices = null) {
  if (!(pos instanceof Position) && pos.constructor.name !== "Posting") {
    throw new Error("Expected Position or Posting");
  }
  const units = pos.units;
  const cost = pos.cost;

  const valueCurrency =
    (cost instanceof Cost && cost.currency) ||
    (pos.price && pos.price.currency) ||
    null;

  if (typeof valueCurrency === "string") {
    const baseQuote = [units.currency, valueCurrency];
    const [priceDate, priceNumber] = prices.getPrice(priceMap, baseQuote, date);
    if (outputDatePrices) {
      outputDatePrices.push([priceDate, priceNumber]);
    }
    if (priceNumber !== null) {
      return new Amount(units.number.times(priceNumber), valueCurrency);
    }
  }

  return units;
}

function convertPosition(pos, targetCurrency, priceMap, date = null) {
  const cost = pos.cost;
  const valueCurrency =
    (cost instanceof Cost && cost.currency) ||
    (pos.price && pos.price.currency) ||
    null;
  return convertAmount(pos.units, targetCurrency, priceMap, date, [
    valueCurrency,
  ]);
}

function convertAmount(amt, targetCurrency, priceMap, date = null, via = null) {
  const baseQuote = [amt.currency, targetCurrency];
  const [, rate] = prices.getPrice(priceMap, baseQuote, date);
  if (rate !== null) {
    return new Amount(amt.number.times(rate), targetCurrency);
  } else if (via) {
    for (const impliedCurrency of via) {
      if (impliedCurrency === targetCurrency) continue;
      const baseQuote1 = [amt.currency, impliedCurrency];
      const [, rate1] = prices.getPrice(priceMap, baseQuote1, date);
      if (rate1 !== null) {
        const baseQuote2 = [impliedCurrency, targetCurrency];
        const [, rate2] = prices.getPrice(priceMap, baseQuote2, date);
        if (rate2 !== null) {
          return new Amount(
            amt.number.times(rate1).times(rate2),
            targetCurrency
          );
        }
      }
    }
  }

  return amt;
}

module.exports = {
  getUnits,
  getCost,
  getWeight,
  getValue,
  convertPosition,
  convertAmount,
};
