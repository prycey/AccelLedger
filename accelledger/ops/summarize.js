/**
 * Summarization of entries.
 *
 * This code is used to summarize a sequence of entries (e.g. during a time period)
 * into a few "opening balance" entries. This is when computing a balance sheet for
 * a specific time period: we don't want to see the entries from before some period
 * of time, so we fold them into a single transaction per account that has the sum
 * total amount of that account.
 */

const { ZERO } = require('../core/number');
const { Transaction, Open, Close } = require('../core/data');
const { isIncomeStatementAccount } = require('../core/account_types');
const amount = require('../core/amount');
const inventory = require('../core/inventory');
const data = require('../core/data');
const flags = require('../core/flags');
const getters = require('../core/getters');
const interpolate = require('../core/interpolate');
const convert = require('../core/convert');
const prices = require('../core/prices');
const options = require('../core/options');

/**
 * Summarize entries before a date and transfer income/expenses to equity.
 *
 * @param {Array} entries - A list of directive objects.
 * @param {Date} date - The date at which to do this.
 * @param {Object} accountTypes - An instance of AccountTypes.
 * @param {string} conversionCurrency - The transfer currency to use for zero prices on the conversion entry.
 * @param {string} accountEarnings - The name of the account to transfer previous earnings from the income statement accounts to the balance sheet.
 * @param {string} accountOpening - The name of the account in equity to transfer previous balances from.
 * @param {string} accountConversions - The name of the equity account to book currency conversions against.
 * @returns {Array} A new list of entries and the index that points to the first original transaction after the beginning date of the period.
 */
function open(entries, date, accountTypes, conversionCurrency, accountEarnings, accountOpening, accountConversions) {
    // Insert conversion entries.
    entries = conversions(entries, accountConversions, conversionCurrency, date);

    // Transfer income and expenses before the period to equity.
    [entries] = clear(entries, date, accountTypes, accountEarnings);

    // Summarize all the previous balances.
    [entries, index] = summarize(entries, date, accountOpening);

    return [entries, index];
}

/**
 * Truncate entries that occur after a particular date and ensure balance.
 *
 * @param {Array} entries - A list of directive objects.
 * @param {Date} date - One day beyond the end of the period.
 * @param {string} conversionCurrency - The transfer currency to use for zero prices on the conversion entry.
 * @param {string} accountConversions - The name of the equity account to book currency conversions against.
 * @returns {Array} A new list of entries and the index that points to one beyond the last original transaction that was provided.
 */
function close(entries, date, conversionCurrency, accountConversions) {
    // Truncate the entries after the date, if a date has been provided.
    if (date) {
        entries = truncate(entries, date);
    }

    // Keep an index to the truncated list of entries (before conversions).
    const index = entries.length;

    // Insert a conversions entry to ensure the total balance of all accounts is flush zero.
    entries = conversions(entries, accountConversions, conversionCurrency, date);

    return [entries, index];
}

/**
 * Transfer income and expenses balances at the given date to the equity accounts.
 *
 * @param {Array} entries - A list of directive objects.
 * @param {Date} date - One day beyond the end of the period.
 * @param {Object} accountTypes - An instance of AccountTypes.
 * @param {string} accountEarnings - The name of the account to transfer previous earnings from the income statement accounts to the balance sheet.
 * @returns {Array} A new list of entries and the index that points to one before the last original transaction before the transfers.
 */
function clear(entries, date, accountTypes, accountEarnings) {
    const index = entries.length;

    // Transfer income and expenses before the period to equity.
    const incomeStatementAccountPred = account => isIncomeStatementAccount(account, accountTypes);
    const newEntries = transferBalances(entries, date, incomeStatementAccountPred, accountEarnings);

    return [newEntries, index];
}

/**
 * Convenience function to open() using an options map.
 */
function openOpt(entries, date, optionsMap) {
    const accountTypes = options.getAccountTypes(optionsMap);
    const previousAccounts = options.getPreviousAccounts(optionsMap);
    const conversionCurrency = optionsMap.conversion_currency;
    return open(entries, date, accountTypes, conversionCurrency, ...previousAccounts);
}

/**
 * Convenience function to close() using an options map.
 */
function closeOpt(entries, date, optionsMap) {
    const conversionCurrency = optionsMap.conversion_currency;
    const currentAccounts = options.getCurrentAccounts(optionsMap);
    return close(entries, date, conversionCurrency, currentAccounts[1]);
}

/**
 * Convenience function to clear() using an options map.
 */
function clearOpt(entries, date, optionsMap) {
    const accountTypes = options.getAccountTypes(optionsMap);
    const currentAccounts = options.getCurrentAccounts(optionsMap);
    return clear(entries, date, accountTypes, currentAccounts[0]);
}

// ... (implement other functions like clamp, cap, transferBalances, summarize, conversions, truncate)

module.exports = {
    open,
    close,
    clear,
    openOpt,
    closeOpt,
    clearOpt,
    // ... (export other functions)
};