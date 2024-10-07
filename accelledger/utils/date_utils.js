/**
 * Parse the date from various formats.
 * 
 * @copyright Copyright (C) 2014-2016  Martin Blais
 * @license GNU GPLv2
 */

/**
 * Yield all the dates between 'startDate' and 'endDate'.
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Generator<Date>}
 */
function* iterDates(startDate, endDate) {
    let date = new Date(startDate);
    while (date < endDate) {
        yield new Date(date);
        date.setDate(date.getDate() + 1);
    }
}

/**
 * Render a date to the OFX format.
 * @param {Date} date
 * @returns {string}
 */
function renderOfxDate(date) {
    return date.toISOString().replace(/[-:T]/g, '').slice(0, -5);
}

/**
 * Compute the date at the beginning of the following month from the given date.
 * @param {Date} date
 * @returns {Date}
 */
function nextMonth(date) {
    const nextMonthDate = new Date(date);
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    nextMonthDate.setDate(1);
    return nextMonthDate;
}

// Note: The intimezone function is not directly translatable to JavaScript
// as JavaScript doesn't have a direct equivalent to Python's os.environ and time.tzset.
// For timezone manipulation in JavaScript, you might want to use a library like moment-timezone.

// Export the functions if using modules
export { iterDates, renderOfxDate, nextMonth };
