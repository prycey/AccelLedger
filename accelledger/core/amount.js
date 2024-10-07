import Decimal from 'decimal.js';

const CURRENCY_RE = [
  '[A-Z][A-Z0-9\'\\.\\-]*[A-Z0-9]?\\b',
  '/[A-Z0-9\'\\.\\-]*[A-Z](?:[A-Z0-9\'\\.\\-]*[A-Z0-9])?'
].join('|');

const ZERO = new Decimal(0);
const MISSING = Symbol('MISSING');

class Amount {
  constructor(number, currency) {
    if (!(number instanceof Decimal) && number !== null && number !== MISSING) {
      if (typeof number === 'number' || typeof number === 'string') {
        number = new Decimal(number);
      } else {
        throw new Error('Invalid type for number');
      }
    }
    this.number = number;
    this.currency = currency;
  }

  toString(dformat = null) {
    let numberFmt;
    if (this.number instanceof Decimal) {
      numberFmt = this.number.toString();
    } else if (this.number === MISSING) {
      numberFmt = '';
    } else {
      numberFmt = String(this.number);
    }
    return `${numberFmt} ${this.currency}`;
  }

  valueOf() {
    return this.number instanceof Decimal && !this.number.isZero();
  }

  equals(other) {
    if (!(other instanceof Amount)) return false;
    return this.number instanceof Decimal && other.number instanceof Decimal &&
           this.number.equals(other.number) && this.currency === other.currency;
  }

  compareTo(other) {
    const currencyCompare = this.currency.localeCompare(other.currency);
    if (currencyCompare !== 0) return currencyCompare;
    if (this.number instanceof Decimal && other.number instanceof Decimal) {
      return this.number.comparedTo(other.number);
    }
    return 0;
  }

  negate() {
    return new Amount(
      isDecimal(this.number) ? this.number.negated() : this.number,
      this.currency
    );
  }

  static fromString(string) {
    const match = string.match(new RegExp(`\\s*([-+]?[0-9.]+)\\s+(${CURRENCY_RE})`));
    if (!match) {
      throw new Error(`Invalid string for amount: '${string}'`);
    }
    const [, number, currency] = match;
    return new Amount(new Decimal(number), currency);
  }
}

function sortkey(amount) {
  return [amount.currency, amount.number];
}

function mul(amount, number) {
  if (!(number instanceof Decimal)) {
    number = new Decimal(number);
  }
  return new Amount(
    amount.number instanceof Decimal ? amount.number.times(number) : 0,
    amount.currency
  );
}

function div(amount, number) {
  if (!(number instanceof Decimal)) {
    number = new Decimal(number);
  }
  return new Amount(
    amount.number instanceof Decimal ? amount.number.dividedBy(number) : 0,
    amount.currency
  );
}

function add(amount1, amount2) {
  if (amount1.currency !== amount2.currency) {
    throw new Error(`Unmatching currencies for operation on ${amount1} and ${amount2}`);
  }
  return new Amount(
    amount1.number instanceof Decimal && amount2.number instanceof Decimal
      ? amount1.number.plus(amount2.number)
      : new Decimal(0),
    amount1.currency
  );
}

function sub(amount1, amount2) {
  if (amount1.currency !== amount2.currency) {
    throw new Error(`Unmatching currencies for operation on ${amount1} and ${amount2}`);
  }
  return new Amount(
    amount1.number instanceof Decimal && amount2.number instanceof Decimal
      ? amount1.number.minus(amount2.number)
      : new Decimal(0),
    amount1.currency
  );
}

function abs(amount) {
  return isDecimal(amount.number) && amount.number.isNegative() ? amount.negate() : amount;
}

const A = Amount.fromString;
const from_string = Amount.fromString;

export {
  Amount,
  CURRENCY_RE,
  ZERO,
  MISSING,
  sortkey,
  mul,
  div,
  add,
  sub,
  abs,
  A,
  from_string
};

function isDecimal(value) {
  return value && typeof value === 'object' && typeof value.isNegative === 'function';
}

function negate(amount) {
  return new Amount(
    isDecimal(amount.number) ? amount.number.negated() : amount.number,
    amount.currency
  );
}