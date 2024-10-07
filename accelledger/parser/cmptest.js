class Comparison {
    static compareValues(value1, value2) {
        if (value1 < value2) {
            return -1;
        } else if (value1 > value2) {
            return 1;
        } else {
            return 0;
        }
    }

    static isEqual(value1, value2) {
        return value1 === value2;
    }

    static isGreaterThan(value1, value2) {
        return value1 > value2;
    }

    static isLessThan(value1, value2) {
        return value1 < value2;
    }

    // Additional comparison methods as needed
}

module.exports = Comparison;