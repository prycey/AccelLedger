/**
 * Validation checks.
 *
 * These checks are intended to be run after all the plugins have transformed the
 * list of entries, just before serving them or generating reports from them. The
 * idea is to ensure a reasonable set of invariants and generate errors if those
 * invariants are violated. They are not sanity checks--user data is subject to
 * constraints which are hopefully detected here and which will result in errors
 * trickled up to the user.
 */

const path = require("path");
const {
  Open,
  Balance,
  Close,
  Transaction,
  Document,
  Note,
} = require("../core/data");

const data = require("../core/data");
const getters = require("../core/getters");
const interpolate = require("../core/interpolate");

class ValidationError {
  constructor(source, message, entry) {
    this.source = source;
    this.message = message;
    this.entry = entry;
  }
}

// Directive types that should be allowed after the account is closed.
const ALLOW_AFTER_CLOSE = [
    // Add the classes or constructors that are allowed
    Transaction, // Example class
    // other classes
];

function validateOpenClose(entries, unusedOptionsMap) {
  const errors = [];
  const openMap = {};
  const closeMap = {};

  for (const entry of entries) {
    if (entry instanceof Open) {
      if (entry.account in openMap) {
        errors.push(
          new ValidationError(
            entry.meta,
            `Duplicate open directive for ${entry.account}`,
            entry
          )
        );
      } else {
        openMap[entry.account] = entry;
      }
    } else if (entry instanceof Close) {
      if (entry.account in closeMap) {
        errors.push(
          new ValidationError(
            entry.meta,
            `Duplicate close directive for ${entry.account}`,
            entry
          )
        );
      } else {
        try {
          const openEntry = openMap[entry.account];
          if (entry.date < openEntry.date) {
            errors.push(
              new ValidationError(
                entry.meta,
                `Internal error: closing date for ${entry.account} appears before opening date`,
                entry
              )
            );
          }
        } catch (error) {
          errors.push(
            new ValidationError(
              entry.meta,
              `Unopened account ${entry.account} is being closed`,
              entry
            )
          );
        }
        closeMap[entry.account] = entry;
      }
    }
  }

  return errors;
}

function validateDuplicateBalances(entries, unusedOptionsMap) {
  const errors = [];
  const balanceEntries = {};

  for (const entry of entries) {
    if (!(entry instanceof Balance)) continue;

    const key = `${entry.account},${entry.amount.currency},${entry.date}`;
    if (key in balanceEntries) {
      const previousEntry = balanceEntries[key];
      if (!entry.amount.equals(previousEntry.amount)) {
        errors.push(
          new ValidationError(
            entry.meta,
            "Duplicate balance assertion with different amounts",
            entry
          )
        );
      }
    } else {
      balanceEntries[key] = entry;
    }
  }

  return errors;
}

function validateDuplicateCommodities(entries, unusedOptionsMap) {
  const errors = [];
  const commodityEntries = {};

  for (const entry of entries) {
    if (!(entry instanceof data.Commodity)) continue;

    const key = entry.currency;
    if (key in commodityEntries) {
      errors.push(
        new ValidationError(
          entry.meta,
          `Duplicate commodity directives for '${key}'`,
          entry
        )
      );
    } else {
      commodityEntries[key] = entry;
    }
  }

  return errors;
}

function validateActiveAccounts(entries, unusedOptionsMap) {
  const errors = [];
  const activeSet = new Set();
  const openedAccounts = new Set();

  for (const entry of entries) {
    if (entry instanceof Open) {
      activeSet.add(entry.account);
      openedAccounts.add(entry.account);
    } else if (entry instanceof Close) {
      activeSet.delete(entry.account);
    } else {
      for (const account of getters.getEntryAccounts(entry)) {
        if (!activeSet.has(account)) {
          if (
            ALLOW_AFTER_CLOSE.some((cls) => entry instanceof cls) &&
            openedAccounts.has(account)
          ) {
            continue;
          }
          const message = openedAccounts.has(account)
            ? `Invalid reference to inactive account '${account}'`
            : `Invalid reference to unknown account '${account}'`;
          errors.push(new ValidationError(entry.meta, message, entry));
        }
      }
    }
  }

  return errors;
}

function validateCurrencyConstraints(entries, optionsMap) {
  const errors = [];
  const openMap = {};

  for (const entry of entries) {
    if (entry instanceof Open && entry.currencies) {
      openMap[entry.account] = entry;
    }
  }

  for (const entry of entries) {
    if (!(entry instanceof Transaction)) continue;

    for (const posting of entry.postings) {
      const openEntry = openMap[posting.account];
      if (!openEntry || !openEntry.currencies) continue;

      if (!openEntry.currencies.includes(posting.units.currency)) {
        errors.push(
          new ValidationError(
            entry.meta,
            `Invalid currency ${posting.units.currency} for account '${posting.account}'`,
            entry
          )
        );
      }
    }
  }

  return errors;
}

function validateDataTypes(entries, optionsMap) {
  const errors = [];
  for (const entry of entries) {
    try {
      data.sanityCheckTypes(
        entry,
        optionsMap.allow_deprecated_none_for_tags_and_links
      );
    } catch (error) {
      errors.push(
        new ValidationError(entry.meta, `Invalid data types: ${error}`, entry)
      );
    }
  }
  return errors;
}

function validateCheckTransactionBalances(entries, optionsMap) {
  const errors = [];
  for (const entry of entries) {
    if (!(entry instanceof Transaction)) continue;

    const residual = interpolate.computeResidual(entry.postings);
    const tolerances = interpolate.inferTolerances(entry.postings, optionsMap);
    if (!residual.isSmall(tolerances)) {
      errors.push(
        new ValidationError(
          entry.meta,
          `Transaction does not balance: ${residual}`,
          entry
        )
      );
    }
  }
  return errors;
}

const BASIC_VALIDATIONS = [
  validateOpenClose,
  validateActiveAccounts,
  validateCurrencyConstraints,
  validateDuplicateBalances,
  validateDuplicateCommodities,
  validateCheckTransactionBalances,
];

const HARDCORE_VALIDATIONS = [validateDataTypes];

const VALIDATIONS = BASIC_VALIDATIONS;

function validate(
  entries,
  optionsMap,
  logTimings = null,
  extraValidations = null
) {
  const validationTests = [...VALIDATIONS, ...(extraValidations || [])];

  const errors = [];
  for (const validationFunction of validationTests) {
    const startTime = Date.now();
    const newErrors = validationFunction(entries, optionsMap);
    errors.push(...newErrors);
    const endTime = Date.now();
    if (logTimings) {
      logTimings(`function: ${validationFunction.name}`, endTime - startTime);
    }
  }

  return errors;
}

module.exports = {
  ValidationError,
  validateOpenClose,
  validateDuplicateBalances,
  validateDuplicateCommodities,
  validateActiveAccounts,
  validateCurrencyConstraints,
  validateDataTypes,
  validateCheckTransactionBalances,
  validate,
};
