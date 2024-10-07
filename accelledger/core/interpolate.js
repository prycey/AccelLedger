// Code used to automatically complete postings without positions.

const Decimal = require("decimal.js");

// Simulating Python's collections.namedtuple
class BalanceError {
  constructor(source, message, entry) {
    this.source = source;
    this.message = message;
    this.entry = entry;
  }
}

// Simulating Python's collections.defaultdict
class DefaultDict extends Map {
  constructor(defaultFactory) {
    super();
    this.defaultFactory = defaultFactory;
  }

  get(key) {
    if (!this.has(key)) {
      this.set(key, this.defaultFactory());
    }
    return super.get(key);
  }
}

// Constants
const MAXIMUM_TOLERANCE = new Decimal("0.5");
const MAX_TOLERANCE_DIGITS = 5;
const AUTOMATIC_META = "__automatic__";
const AUTOMATIC_RESIDUAL = "__residual__";
const AUTOMATIC_TOLERANCES = "__tolerances__";

// Simulating Python's Decimal constants
const ONE = new Decimal(1);
const ZERO = new Decimal(0);
const MISSING = Symbol("MISSING");

// Helper classes (simplified versions)
class Amount {
  constructor(number, currency) {
    this.number = number;
    this.currency = currency;
  }
}

class CostSpec {
  constructor(number_per, number_total, currency) {
    this.number_per = number_per;
    this.number_total = number_total;
    this.currency = currency;
  }
}

class Cost {
  constructor(number, currency) {
    this.number = number;
    this.currency = currency;
  }
}

class Posting {
  constructor(account, units, cost, price, flag, meta) {
    this.account = account;
    this.units = units;
    this.cost = cost;
    this.price = price;
    this.flag = flag;
    this.meta = meta || {};
  }
}

class Transaction {
  constructor(date, flag, payee, narration, tags, links, postings) {
    this.date = date;
    this.flag = flag;
    this.payee = payee;
    this.narration = narration;
    this.tags = tags;
    this.links = links;
    this.postings = postings;
  }
}

function isToleranceUserSpecified(tolerance) {
    return tolerance.precision() < MAX_TOLERANCE_DIGITS;
}

function hasNontrivialBalance(posting) {
    return posting.cost || posting.price;
}

class Inventory {
    constructor() {
        this.positions = [];
    }

    addAmount(amount) {
        // Simplified implementation
        this.positions.push({ units: amount });
    }

    addPosition(posting) {
        // Simplified implementation
        this.positions.push({ units: posting.units, cost: posting.cost });
    }

    getPositions() {
        return this.positions;
    }

    isEmpty() {
        return this.positions.length === 0;
    }
}

function computeResidual(postings) {
    let inventory = new Inventory();
    for (let posting of postings) {
        if (posting.meta && posting.meta[AUTOMATIC_RESIDUAL]) {
            continue;
        }
        inventory.addAmount(getWeight(posting));
    }
    return inventory;
}

function getWeight(posting) {
    // Simplified implementation
    return posting.units;
}

function inferTolerances(postings, optionsMap, useCost = null) {
    if (useCost === null) {
        useCost = optionsMap.infer_tolerance_from_cost;
    }

    const inferredToleranceMultiplier = optionsMap.inferred_tolerance_multiplier;
    const defaultTolerances = { ...optionsMap.inferred_tolerance_default };
    const tolerances = { ...defaultTolerances };
    const costTolerances = new DefaultDict(() => new Decimal(0));

    for (let posting of postings) {
        if (posting.meta && posting.meta[AUTOMATIC_META]) {
            continue;
        }

        const units = posting.units;
        if (!(units instanceof Amount) || !(units.number instanceof Decimal)) {
            continue;
        }

        const currency = units.currency;
        const expo = units.number.e;
        if (expo < 0) {
            const tolerance = new Decimal(10).pow(expo).times(inferredToleranceMultiplier);
            tolerances[currency] = Decimal.max(tolerance, tolerances[currency] || new Decimal(-1024));

            if (!useCost) {
                continue;
            }

            const cost = posting.cost;
            if (cost) {
                const costCurrency = cost.currency;
                let costTolerance;
                if (cost instanceof Cost) {
                    costTolerance = Decimal.min(tolerance.times(cost.number), MAXIMUM_TOLERANCE);
                } else {
                    costTolerance = MAXIMUM_TOLERANCE;
                    for (let costNumber of [cost.number_total, cost.number_per]) {
                        if (costNumber === null || costNumber === MISSING) {
                            continue;
                        }
                        costTolerance = Decimal.min(tolerance.times(costNumber), costTolerance);
                    }
                }
                costTolerances.get(costCurrency).plus(costTolerance);
            }

            const price = posting.price;
            if (price instanceof Amount && price.number instanceof Decimal) {
                const priceCurrency = price.currency;
                const priceTolerance = Decimal.min(tolerance.times(price.number), MAXIMUM_TOLERANCE);
                costTolerances.get(priceCurrency).plus(priceTolerance);
            }
        }
    }

    for (let [currency, tolerance] of costTolerances.entries()) {
        tolerances[currency] = Decimal.max(tolerance, tolerances[currency] || new Decimal(-1024));
    }

    const defaultTolerance = tolerances['*'] || ZERO;
    delete tolerances['*'];

    return new Proxy(tolerances, {
        get: (target, prop) => prop in target ? target[prop] : defaultTolerance
    });
}

function getResidualPostings(residual, accountRounding) {
    const meta = { [AUTOMATIC_META]: true, [AUTOMATIC_RESIDUAL]: true };
    return residual.getPositions().map(position => 
        new Posting(accountRounding, negateAmount(position.units), position.cost, null, null, { ...meta })
    );
}

function negateAmount(amount) {
    return new Amount(amount.number.negated(), amount.currency);
}

function fillResidualPosting(entry, accountRounding) {
    const residual = computeResidual(entry.postings);
    if (!residual.isEmpty()) {
        const newPostings = [...entry.postings, ...getResidualPostings(residual, accountRounding)];
        return new Transaction(entry.date, entry.flag, entry.payee, entry.narration, entry.tags, entry.links, newPostings);
    }
    return entry;
}

function computeEntriesBalance(entries, prefix = null, date = null) {
    let totalBalance = new Inventory();
    for (let entry of entries) {
        if (date && entry.date >= date) {
            break;
        }
        if (entry instanceof Transaction) {
            for (let posting of entry.postings) {
                if (!prefix || posting.account.startsWith(prefix)) {
                    totalBalance.addPosition(posting);
                }
            }
        }
    }
    return totalBalance;
}

function computeEntryContext(entries, contextEntry, additionalAccounts = null) {
    if (!contextEntry) {
        throw new Error("context_entry is missing.");
    }

    const contextAccounts = new Set(getEntryAccounts(contextEntry));
    if (additionalAccounts) {
        additionalAccounts.forEach(account => contextAccounts.add(account));
    }

    const contextBefore = new DefaultDict(() => new Inventory());
    let foundContextEntry = false;

    for (let entry of entries) {
        if (entry === contextEntry) {
            foundContextEntry = true;
            break;
        }
        if (entry instanceof Transaction) {
            for (let posting of entry.postings) {
                if (contextAccounts.has(posting.account)) {
                    contextBefore.get(posting.account).addPosition(posting);
                }
            }
        }
    }

    if (!foundContextEntry) {
        throw new Error("Context entry not found in entries list.");
    }

    const contextAfter = new DefaultDict(() => new Inventory());
    for (let [account, inventory] of contextBefore.entries()) {
        contextAfter.set(account, inventory.clone());
    }

    if (contextEntry instanceof Transaction) {
        for (let posting of contextEntry.postings) {
            contextAfter.get(posting.account).addPosition(posting);
        }
    }

    return [contextBefore, contextAfter];
}

function getEntryAccounts(entry) {
    if (entry instanceof Transaction) {
        return entry.postings.map(posting => posting.account);
    }
    return [];
}

function quantizeWithTolerance(tolerances, currency, number) {
    const tolerance = tolerances[currency];
    if (tolerance) {
        const quantum = tolerance.times(2).normalize();
        if (isToleranceUserSpecified(quantum)) {
            return number.toDecimalPlaces(quantum.decimalPlaces());
        }
    }
    return number;
}

module.exports = {
    BalanceError,
    MAXIMUM_TOLERANCE,
    MAX_TOLERANCE_DIGITS,
    AUTOMATIC_META,
    AUTOMATIC_RESIDUAL,
    AUTOMATIC_TOLERANCES,
    isToleranceUserSpecified,
    hasNontrivialBalance,
    computeResidual,
    inferTolerances,
    getResidualPostings,
    fillResidualPosting,
    computeEntriesBalance,
    computeEntryContext,
    quantizeWithTolerance,
};