const Decimal = require("decimal.js");
const { Amount, Cost, Position } = require("./position");
const { ZERO, same_sign } = require("./number");
const convert = require("./convert");

const ASSERTS_TYPES = false;

class MatchResult {
  static CREATED = new MatchResult("CREATED");
  static REDUCED = new MatchResult("REDUCED");
  static AUGMENTED = new MatchResult("AUGMENTED");
  static IGNORED = new MatchResult("IGNORED");

  constructor(name) {
    this.name = name;
  }
}

class Inventory extends Map {
  constructor(positions = null) {
    super();
    if (positions) {
      if (positions instanceof Map || positions instanceof Inventory) {
        for (const [key, value] of positions) {
          this.set(key, value);
        }
      } else {
        for (const position of positions) {
          this.addPosition(position);
        }
      }
    }
  }

  [Symbol.iterator]() {
    return this.values();
  }

  toString(dformat = null, parens = true) {
    const positionStrings = Array.from(this.values())
      .sort()
      .map((pos) => pos.toString(dformat));
    const joined = positionStrings.join(", ");
    return parens ? `(${joined})` : joined;
  }

  isEmpty() {
    return this.size === 0;
  }

  clone() {
    return new Inventory(this);
  }

  isSmall(tolerances) {
    if (typeof tolerances === "object") {
      for (const position of this.values()) {
        const tolerance = tolerances[position.units.currency] || ZERO;
        if (position.units.number.abs().gt(tolerance)) {
          return false;
        }
      }
      return true;
    } else {
      return !Array.from(this.values()).some((position) =>
        position.units.number.abs().gt(tolerances)
      );
    }
  }

  isMixed() {
    const signsMap = new Map();
    for (const position of this.values()) {
      const sign = position.units.number.gte(ZERO);
      const prevSign = signsMap.get(position.units.currency);
      if (prevSign !== undefined && sign !== prevSign) {
        return true;
      }
      signsMap.set(position.units.currency, sign);
    }
    return false;
  }

  isReducedBy(ramount) {
    if (ramount.number.eq(ZERO)) {
      return false;
    }
    for (const position of this.values()) {
      const units = position.units;
      if (
        ramount.currency === units.currency &&
        !same_sign(ramount.number, units.number)
      ) {
        return true;
      }
    }
    return false;
  }

  neg() {
    const newInventory = new Inventory();
    for (const [key, position] of this) {
      newInventory.set(key, position.neg());
    }
    return newInventory;
  }

  abs() {
    const newInventory = new Inventory();
    for (const [key, position] of this) {
      newInventory.set(key, position.abs());
    }
    return newInventory;
  }

  mul(scalar) {
    const newInventory = new Inventory();
    for (const [key, position] of this) {
      newInventory.set(key, position.mul(scalar));
    }
    return newInventory;
  }

  currencies() {
    return new Set(Array.from(this.keys()).map(([currency, _]) => currency));
  }

  costCurrencies() {
    return new Set(
      Array.from(this.keys())
        .filter(([_, cost]) => cost !== null)
        .map(([_, cost]) => cost.currency)
    );
  }

  currencyPairs() {
    return new Set(
      Array.from(this.values()).map((position) => position.currencyPair())
    );
  }

  getPositions() {
    return Array.from(this.values());
  }

  getOnlyPosition() {
    if (this.size > 0) {
      if (this.size > 1) {
        throw new Error(
          `Inventory has more than one expected position: ${this}`
        );
      }
      return this.values().next().value;
    }
    return null;
  }

  getCurrencyUnits(currency) {
    let totalUnits = ZERO;
    for (const position of this.values()) {
      if (position.units.currency === currency) {
        totalUnits = totalUnits.plus(position.units.number);
      }
    }
    return new Amount(totalUnits, currency);
  }

  split() {
    const perCurrencyDict = new Map();
    for (const position of this.values()) {
      const currency = position.units.currency;
      if (!perCurrencyDict.has(currency)) {
        perCurrencyDict.set(currency, new Inventory());
      }
      perCurrencyDict.get(currency).addPosition(position);
    }
    return Object.fromEntries(perCurrencyDict);
  }

  reduce(reducer, ...args) {
    const inventory = new Inventory();
    for (const position of this.values()) {
      inventory.addAmount(reducer(position, ...args));
    }
    return inventory;
  }

  average() {
    const groups = new Map();
    for (const position of this.values()) {
      const key = `${position.units.currency},${
        position.cost ? position.cost.currency : "null"
      }`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(position);
    }

    const averageInventory = new Inventory();
    for (const positions of groups.values()) {
      const totalUnits = positions.reduce(
        (sum, pos) => sum.plus(pos.units.number),
        ZERO
      );
      if (totalUnits.eq(ZERO)) continue;

      const currency = positions[0].units.currency;
      const unitsAmount = new Amount(totalUnits, currency);

      const costCurrency = positions[0].cost
        ? positions[0].cost.currency
        : null;
      if (costCurrency) {
        const totalCost = positions.reduce(
          (sum, pos) => sum.plus(convert.getCost(pos).number),
          ZERO
        );
        const costNumber = totalUnits.eq(ZERO)
          ? new Decimal("Infinity")
          : totalCost.div(totalUnits);
        const minDate = positions.reduce((min, pos) => {
          const posDate = pos.cost ? pos.cost.date : null;
          return posDate && (!min || posDate < min) ? posDate : min;
        }, null);
        const cost = new Cost(costNumber, costCurrency, minDate, null);
        averageInventory.addAmount(unitsAmount, cost);
      } else {
        averageInventory.addAmount(unitsAmount);
      }
    }

    return averageInventory;
  }

  addAmount(units, cost = null) {
    if (ASSERTS_TYPES) {
      if (!(units instanceof Amount)) {
        throw new Error(`Internal error: ${units} (type: ${typeof units})`);
      }
      if (cost !== null && !(cost instanceof Cost)) {
        throw new Error(`Internal error: ${cost} (type: ${typeof cost})`);
      }
    }

    const key = `${units.currency},${cost ? cost.toString() : "null"}`;
    const pos = this.get(key);

    let booking;
    if (pos) {
      booking = !same_sign(pos.units.number, units.number)
        ? MatchResult.REDUCED
        : MatchResult.AUGMENTED;

      const number = pos.units.number.plus(units.number);
      if (number.eq(ZERO)) {
        this.delete(key);
      } else {
        this.set(key, new Position(new Amount(number, units.currency), cost));
      }
    } else {
      if (units.number.eq(ZERO)) {
        booking = MatchResult.IGNORED;
      } else {
        this.set(key, new Position(units, cost));
        booking = MatchResult.CREATED;
      }
    }

    return [pos, booking];
  }

  addPosition(position) {
    if (ASSERTS_TYPES) {
      if (!position.units || !("cost" in position)) {
        throw new Error(`Invalid type for position: ${position}`);
      }
      if (position.cost !== null && !(position.cost instanceof Cost)) {
        throw new Error(`Invalid type for cost: ${position.cost}`);
      }
    }
    return this.addAmount(position.units, position.cost);
  }

  addInventory(other) {
    if (this.isEmpty()) {
      for (const [key, value] of other) {
        this.set(key, value);
      }
    } else {
      for (const position of other.getPositions()) {
        this.addPosition(position);
      }
    }
    return this;
  }

  add(other) {
    const newInventory = this.clone();
    newInventory.addInventory(other);
    return newInventory;
  }

  static fromString(string) {
    const newInventory = new Inventory();
    const positionStrs =
      string.match(/([-+]?[0-9,.]+\s+[A-Z]+\s*(?:{[^}]*})?)\s*,?\s*/g) || [];
    for (const positionStr of positionStrs) {
      newInventory.addPosition(Position.fromString(positionStr));
    }
    return newInventory;
  }
}

function checkInvariants(inv) {
  const lots = new Set(
    Array.from(inv.values()).map((pos) => `${pos.units.currency},${pos.cost}`)
  );
  if (lots.size !== inv.size) {
    throw new Error(`Invalid inventory: ${inv}`);
  }
  for (const pos of inv.values()) {
    if (pos.units.number.eq(ZERO)) {
      throw new Error(`Invalid position size: ${pos}`);
    }
  }
  return true;
}

module.exports = {
  Inventory,
  MatchResult,
  checkInvariants,
};
