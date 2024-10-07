/**
 * A simple accumulator for data about a mathematical distribution.
 * 
 * @copyright Copyright (C) 2015-2017  Martin Blais
 * @license GNU GPLv2
 */

class Distribution {
    /**
     * A class that computes a histogram of integer values. This is used to compute
     * a length that will cover at least some decent fraction of the samples.
     */
    constructor() {
        this.hist = new Map();
    }

    empty() {
        // ... existing code ...
        return this.hist.size === 0;
    }

    update(value) {
        // ... existing code ...
        this.hist.set(value, (this.hist.get(value) || 0) + 1);
    }

    updateFrom(other) {
        // ... existing code ...
        for (const [value, count] of other.hist) {
            this.hist.set(value, (this.hist.get(value) || 0) + count);
        }
    }

    min() {
        // ... existing code ...
        if (this.hist.size === 0) return null;
        return Math.min(...this.hist.keys());
    }

    max() {
        // ... existing code ...
        if (this.hist.size === 0) return null;
        return Math.max(...this.hist.keys());
    }

    mode() {
        // ... existing code ...
        if (this.hist.size === 0) return null;
        let maxValue = null;
        let maxCount = 0;
        for (const [value, count] of this.hist) {
            if (count >= maxCount) {
                maxCount = count;
                maxValue = value;
            }
        }
        return maxValue;
    }
}

module.exports = Distribution;
