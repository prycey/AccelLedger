

class Amount {
  constructor(number, currency) {
    this.number = number;
    this.currency = currency;
  }

  toString() {
    return `${this.number} ${this.currency}`;
  }
}

class Cost {
  constructor(number, currency, date, label) {
    this.number = number;
    this.currency = currency;
    this.date = date;
    this.label = label;
  }

  toString() {
    let parts = [`${this.number} ${this.currency}`];
    if (this.date) parts.push(this.date.toISOString().split('T')[0]);
    if (this.label) parts.push(`"${this.label}"`);
    return parts.join(', ');
  }
}

class Position {
  constructor(units, cost = null) {
    if (!(units instanceof Amount)) {
      throw new Error("Expected an Amount for units");
    }
    if (cost !== null && !(cost instanceof Cost)) {
      throw new Error("Expected a Cost for cost");
    }
    this.units = units;
    this.cost = cost;
  }

  toString() {
    let result = this.units.toString();
    if (this.cost) {
      result += ` {${this.cost.toString()}}`;
    }
    return result;
  }

  isEqual(other) {
    if (other === null) {
      return this.units.number === 0;
    }
    return (
      this.units.number === other.units.number &&
      this.units.currency === other.units.currency &&
      JSON.stringify(this.cost) === JSON.stringify(other.cost)
    );
  }

  getNegative() {
    return new Position(
      new Amount(-this.units.number, this.units.currency),
      this.cost
    );
  }

  abs() {
    return new Position(
      new Amount(Math.abs(this.units.number), this.units.currency),
      this.cost
    );
  }

  multiply(scalar) {
    return new Position(
      new Amount(this.units.number * scalar, this.units.currency),
      this.cost
    );
  }

  isNegativeAtCost() {
    return this.units.number < 0 && this.cost !== null;
  }

  static fromString(string) {
    const regex = /^\s*(-?\d+(?:\.\d+)?)\s+([A-Z]+)(?:\s+{([^}]*)})?$/;
    const match = string.match(regex);
    if (!match) {
      throw new Error(`Invalid string for position: '${string}'`);
    }

    const [, number, currency, costExpression] = match;
    const units = new Amount(parseFloat(number), currency);

    let cost = null;
    if (costExpression) {
      const costParts = costExpression.split(',').map(part => part.trim());
      const costNumber = parseFloat(costParts[0]);
      const costCurrency = costParts[0].split(' ')[1];
      const date = costParts[1] ? new Date(costParts[1]) : null;
      const label = costParts[2] ? costParts[2].replace(/"/g, '') : null;
      cost = new Cost(costNumber, costCurrency, date, label);
    }

    return new Position(units, cost);
  }

  static fromAmounts(units, costAmount = null) {
    const cost = costAmount
      ? new Cost(costAmount.number, costAmount.currency, null, null)
      : null;
    return new Position(units, cost);
  }
}

// Export the classes
module.exports = { Amount, Cost, Position };