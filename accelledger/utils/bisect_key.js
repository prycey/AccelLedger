/**
 * A version of bisect that accepts a custom key function, like the sorting ones do.
 */

/**
 * Find the last element before the given value in a sorted list.
 *
 * @param {Array} sequence - A sorted sequence of elements.
 * @param {*} value - The value to search for.
 * @param {Function} [key=null] - An optional function used to extract the value from the elements of sequence.
 * @returns {number} The index. May return -1 if not found.
 */
function bisectLeftWithKey(sequence, value, key = null) {
    if (key === null) {
        key = x => x; // Identity function
    }

    let lo = 0;
    let hi = sequence.length;

    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (key(sequence[mid]) < value) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    return lo;
}

/**
 * Like bisect.bisect_right, but with a key lookup parameter.
 *
 * @param {Array} a - The array to search in.
 * @param {*} x - The element to search for.
 * @param {Function} key - A function to extract the value from the array elements.
 * @param {number} [lo=0] - The smallest index to search.
 * @param {number} [hi=null] - The largest index to search.
 * @returns {number} The index where the element should be inserted.
 */
function bisectRightWithKey(a, x, key, lo = 0, hi = null) {
    if (lo < 0) {
        throw new Error("lo must be non-negative");
    }
    if (hi === null) {
        hi = a.length;
    }
    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (x < key(a[mid])) {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    return lo;
}

module.exports = {
    bisectLeftWithKey,
    bisectRightWithKey
};
