/**
 * Algorithms for 'booking' inventory, that is, the process of finding a
 * matching lot when reducing the content of an inventory.
 */

const { MISSING, ZERO } = require("../core/number");
const { Amount } = require("../core/amount");
const {
  Open,
  Close,
  Commodity,
  Balance,
  Posting,
  Transaction,
  newMetadata,
  createSimplePosting,
  createSimplePostingWithCost,
  postingHasConversion,
  transactionHasConversion,
  sortEntries,
} = require("../core/data");
const { Inventory } = require("../core/inventory");
const { Position } = require("../core/position");
const { book: bookFull } = require("../parser/booking_full");
const { t } = require("../core/data");

class BookingError {
  constructor(source, message, entry) {
    this.source = source;
    this.message = message;
    this.entry = entry;
  }
}

/**
 * Book inventory lots and complete all positions with incomplete numbers.
 * @param {Array} incompleteEntries - A list of directives, with some postings possibly left with incomplete amounts as produced by the parser.
 * @param {Object} optionsMap - An options dict as produced by the parser.
 * @param {Object} initialBalances - A dict of (account, inventory) pairs to start booking from.
 * @returns {Array} A pair of [entries, errors]
 */
function book(incompleteEntries, optionsMap, initialBalances = null) {
  // Get the list of booking methods for each account.
  const bookingMethods = new Map();
  const defaultBookingMethod = optionsMap.booking_method;

  for (const entry of incompleteEntries) {
    if (entry instanceof Open && entry.booking) {
      bookingMethods.set(entry.account, entry.booking);
    }
  }

  // Do the booking here!
  const [entries, bookingErrors] = bookFull(
    incompleteEntries,
    optionsMap,
    bookingMethods,
    initialBalances
  );

  // Check for MISSING elements remaining.
  const missingErrors = validateMissingEliminated(entries, optionsMap);

  return [entries, [...bookingErrors, ...missingErrors]];
}

/**
 * Validate that all the missing bits of postings have been eliminated.
 * @param {Array} entries - A list of directives.
 * @param {Object} unusedOptionsMap - An options map.
 * @returns {Array} A list of errors.
 */
function validateMissingEliminated(entries, unusedOptionsMap) {
  const errors = [];
  for (const entry of entries) {
    if (entry instanceof Transaction) {
      for (const posting of entry.postings) {
        const { units, cost } = posting;
        if (
          [units.number, units.currency].includes(MISSING) ||
          (cost !== null &&
            [cost.number, cost.currency, cost.date, cost.label].includes(
              MISSING
            ))
        ) {
          errors.push(
            new BookingError(
              entry.meta,
              "Transaction has incomplete elements",
              entry
            )
          );
          break;
        }
      }
    }
  }
  return errors;
}

/**
 * Convert a posting's CostSpec instance to a Cost.
 * @param {Amount} units - An instance of Amount.
 * @param {CostSpec} costSpec - An instance of CostSpec.
 * @returns {Cost|null} An instance of Cost or null.
 */
function convertSpecToCost(units, costSpec) {
  if (!(units instanceof Amount) || costSpec === null) {
    return costSpec;
  }

  const [numberPer, numberTotal, costCurrency, date, label, merge] = costSpec;

  if (numberPer !== MISSING || numberTotal !== null) {
    let unitCost;
    if (numberTotal !== null) {
      const unitsNum = units.number;
      let costTotal = numberTotal;
      if (numberPer !== MISSING) {
        costTotal += numberPer * unitsNum;
      }
      unitCost = costTotal / Math.abs(unitsNum);
    } else {
      unitCost = numberPer;
    }
    return new Position.Cost(unitCost, costCurrency, date, label);
  }

  return null;
}

module.exports = {
  book,
  validateMissingEliminated,
  convertSpecToCost,
  BookingError,
};
