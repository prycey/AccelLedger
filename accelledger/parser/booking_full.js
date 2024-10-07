// accelledger/parser/booking_full.js

const { v4: uuidv4 } = require("uuid");
const Decimal = require("decimal.js");
const { Transaction, Booking } = require("../core/data");
const { Amount, Position, Cost, CostSpec } = require("../core/position");
const Inventory = require("../core/inventory");
const interpolate = require("../core/interpolate");

// Constants
const MISSING = Symbol("MISSING");
const ZERO = new Decimal(0);
const AUTOMATIC_META = Symbol("__automatic__");
const AUTOMATIC_TOLERANCES = Symbol("__automatic_tolerances__");

// Enums
const MissingType = {
  UNITS: "UNITS",
  COST_PER: "COST_PER",
  COST_TOTAL: "COST_TOTAL",
  PRICE: "PRICE",
};

// Helper function
function uniqueLabel() {
  return uuidv4();
}

// Error classes
class SelfReduxError extends Error {
  constructor(source, message, entry) {
    super(message);
    this.source = source;
    this.entry = entry;
  }
}

class CategorizationError extends Error {
  constructor(source, message, entry) {
    super(message);
    this.source = source;
    this.entry = entry;
  }
}

class ReductionError extends Error {
  constructor(source, message, entry) {
    super(message);
    this.source = source;
    this.entry = entry;
  }
}

class InterpolationError extends Error {
  constructor(source, message, entry) {
    super(message);
    this.source = source;
    this.entry = entry;
  }
}

// Main booking function
function book(entries, optionsMap, methods, initialBalances = null) {
  const [newEntries, errors, _] = _book(
    entries,
    optionsMap,
    methods,
    initialBalances
  );
  return [newEntries, errors];
}

function _book(entries, optionsMap, methods, initialBalances = null) {
  const newEntries = [];
  const errors = [];
  const balances = initialBalances || new Map();

  for (const entry of entries) {
    if (entry.type === "Transaction") {
      let updatedEntry = {
        ...entry,
        postings: entry.postings.map((posting) => ({ ...posting })),
      };

      for (let i = 0; i < entry.postings.length; i++) {
        const posting = entry.postings[i];
        let balance = balances.get(posting.account) || new Inventory();

        // Apply the booking method
        const bookingMethod = methods.get(posting.account) || "STRICT";
        try {
          balance = balance.book(posting.units, posting.cost, bookingMethod);
        } catch (error) {
          errors.push(new BookingError(entry.meta, error.message, entry));
          continue;
        }

        // Update the balance
        balance.addPosition(posting);
        balances.set(posting.account, balance);

        // Update the corresponding posting in updatedEntry
        updatedEntry.postings[i] = {
          ...updatedEntry.postings[i],
          balance: balance,
        };
      }

      newEntries.push(updatedEntry);
    } else {
      // For non-Transaction entries, just push them as-is
      newEntries.push(entry);
    }
  }

  return [newEntries, errors, balances];
}

function getBucketCurrency(refer) {
  if (typeof refer.costCurrency === "string") {
    return refer.costCurrency;
  } else if (typeof refer.priceCurrency === "string") {
    return refer.priceCurrency;
  } else if (
    refer.costCurrency === null &&
    refer.priceCurrency === null &&
    typeof refer.unitsCurrency === "string"
  ) {
    return refer.unitsCurrency;
  }
  return null;
}

function categorizeByCurrency(entry, balances) {
  const errors = [];
  const groups = new Map();
  const sortdict = new Map();
  const autoPostings = [];
  const unknown = [];

  entry.postings.forEach((posting, index) => {
    const { units, cost, price } = posting;

    let unitsCurrency =
      units !== MISSING && units !== null ? units.currency : null;
    let costCurrency = cost !== MISSING && cost !== null ? cost.currency : null;
    let priceCurrency =
      price !== MISSING && price !== null ? price.currency : null;

    if (costCurrency === MISSING && typeof priceCurrency === "string") {
      costCurrency = priceCurrency;
    }
    if (priceCurrency === MISSING && typeof costCurrency === "string") {
      priceCurrency = costCurrency;
    }

    const refer = { index, unitsCurrency, costCurrency, priceCurrency };

    if (units === MISSING && priceCurrency === null) {
      autoPostings.push(refer);
    } else {
      const currency = getBucketCurrency(refer);
      if (currency !== null) {
        if (!sortdict.has(currency)) {
          sortdict.set(currency, index);
        }
        if (!groups.has(currency)) {
          groups.set(currency, []);
        }
        groups.get(currency).push(refer);
      } else {
        unknown.push(refer);
      }
    }
  });

  // Handle unknown and auto-postings...
  // (This part would be similar to the Python implementation)

  const sortedGroups = Array.from(groups.entries()).sort(
    (a, b) => sortdict.get(a[0]) - sortdict.get(b[0])
  );
  return [sortedGroups, errors];
}

function replaceCurrencies(postings, referGroups) {
  const newGroups = [];
  for (const [currency, refers] of referGroups) {
    const newPostings = [];
    for (const refer of refers.sort((a, b) => a.index - b.index)) {
      let posting = postings[refer.index];
      const { units, cost, price } = posting;

      if (units === MISSING || units === null) {
        posting = {
          ...posting,
          units: new Amount(MISSING, refer.unitsCurrency),
        };
      } else {
        let replace = false;
        if (units.currency === MISSING) {
          units.currency = refer.unitsCurrency;
          replace = true;
        }
        if (cost && cost.currency === MISSING) {
          cost.currency = refer.costCurrency;
          replace = true;
        }
        if (price && price.currency === MISSING) {
          price.currency = refer.priceCurrency;
          replace = true;
        }
        if (replace) {
          posting = { ...posting, units, cost, price };
        }
      }
      newPostings.push(posting);
    }
    newGroups.push([currency, newPostings]);
  }
  return newGroups;
}

function hasSelfReduction(postings, methods) {
  const costChanges = new Map();
  for (const posting of postings) {
    const cost = posting.cost;
    if (cost === null) continue;
    if (methods.get(posting.account) === Booking.NONE) continue;
    const key = `${posting.account},${posting.units.currency}`;
    const sign = posting.units.number.gt(ZERO) ? 1 : -1;
    if (costChanges.has(key) && costChanges.get(key) !== sign) {
      return true;
    }
    costChanges.set(key, sign);
  }
  return false;
}

function bookReductions(entry, groupPostings, balances, methods) {
  const errors = [];
  const localBalances = new Map(balances);
  const empty = new Inventory();
  const bookedPostings = [];

  for (let posting of groupPostings) {
    const { units, cost: costspec, account } = posting;

    if (!localBalances.has(account)) {
      const previousBalance = balances.get(account) || empty;
      localBalances.set(account, previousBalance.copy());
    }
    const balance = localBalances.get(account);

    if (costspec === null || units.number === MISSING) {
      bookedPostings.push(posting);
    } else {
      const method = methods.get(account);
      if (
        method !== Booking.NONE &&
        balance !== null &&
        balance.isReducedBy(units)
      ) {
        const costNumber = computeCostNumber(costspec, units);
        const matches = [];
        for (const position of balance) {
          // Matching logic...
        }

        if (matches.length === 0) {
          errors.push(
            new ReductionError(
              entry.meta,
              `No position matches "${posting}" against balance ${balance}`,
              entry
            )
          );
          return [[], errors];
        }

        // Handle ambiguous matches...
        // This part would require implementation of booking_method.handleAmbiguousMatches

        bookedPostings.push(...reductionPostings);

        for (const posting of reductionPostings) {
          balance.addPosition(posting);
        }
      } else {
        if (costspec.date === null) {
          const datedCostspec = { ...costspec, date: entry.date };
          posting = { ...posting, cost: datedCostspec };
        }
        bookedPostings.push(posting);
      }
    }
  }

  return [bookedPostings, errors];
}

function computeCostNumber(costspec, units) {
  const { numberPer, numberTotal } = costspec;
  if (numberPer === MISSING || numberTotal === MISSING) {
    return null;
  }
  if (numberTotal !== null) {
    const costTotal = numberTotal;
    const unitsNumber = units.number.abs();
    if (numberPer !== null) {
      return costTotal.plus(numberPer.times(unitsNumber)).div(unitsNumber);
    }
    return costTotal.div(unitsNumber);
  }
  return numberPer !== null ? numberPer : null;
}

function convertCostspecToCost(posting) {
  const { cost } = posting;
  if (cost instanceof CostSpec && cost !== null) {
    const { numberPer, numberTotal, currency, date, label } = cost;
    let unitCost;
    if (numberTotal !== null) {
      const unitsNumber = posting.units.number.abs();
      const costTotal = numberTotal;
      unitCost =
        numberPer !== MISSING
          ? costTotal.plus(numberPer.times(unitsNumber)).div(unitsNumber)
          : costTotal.div(unitsNumber);
    } else {
      unitCost = numberPer;
    }
    const newCost = new Cost(unitCost, currency, date, label);
    return { ...posting, cost: newCost };
  }
  return posting;
}

function interpolateGroup(postings, balances, currency, tolerances) {
  const errors = [];
  const incomplete = [];

  postings.forEach((posting, index) => {
    const { units, cost, price } = posting;

    if (units.number === MISSING) {
      incomplete.push([MissingType.UNITS, index]);
    }

    if (cost instanceof CostSpec) {
      if (cost && cost.numberPer === MISSING) {
        incomplete.push([MissingType.COST_PER, index]);
      }
      if (cost && cost.numberTotal === MISSING) {
        incomplete.push([MissingType.COST_TOTAL, index]);
      }
    } else if (cost !== null) {
      if (!(cost.number instanceof Decimal)) {
        throw new Error(
          `Internal error: cost has no number: ${cost}; on postings: ${postings}`
        );
      }
    }

    if (price && price.number === MISSING) {
      incomplete.push([MissingType.PRICE, index]);
    }
  });

  let newPosting = null;

  if (incomplete.length === 0) {
    const outPostings = postings.map(convertCostspecToCost);
    return [outPostings, errors, false];
  } else if (incomplete.length > 1) {
    const [, postingIndex] = incomplete[0];
    errors.push(
      new InterpolationError(
        postings[postingIndex].meta,
        `Too many missing numbers for currency group '${currency}'`,
        null
      )
    );
    return [[], errors, false];
  } else {
    const [missing, index] = incomplete[0];
    const incompletePosting = postings[index];

    const newPostings = postings.map((posting) =>
      posting === incompletePosting ? posting : convertCostspecToCost(posting)
    );

    const residual = interpolate.computeResidual(
      newPostings.filter((posting) => posting !== incompletePosting)
    );

    // Handle residual and weight calculation...

    // Handle different missing types (UNITS, COST_PER, COST_TOTAL, PRICE)...

    // Replace the number in the posting...

    // Check that units are non-zero and that no cost remains negative...

    return [outPostings, errors, newPosting !== null];
  }
}

module.exports = {
  book,
  _book,
  SelfReduxError,
  CategorizationError,
  ReductionError,
  InterpolationError,
  uniqueLabel,
  getBucketCurrency,
  hasSelfReduction,
  computeCostNumber,
  convertCostspecToCost,
};
