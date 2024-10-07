/**
 * A settings class to offer control over the number of digits rendered.
 */

// Enums
const Precision = {
  MOST_COMMON: 'MOST_COMMON',
  MAXIMUM: 'MAXIMUM'
};

const Align = {
  NATURAL: 'NATURAL',
  DOT: 'DOT',
  RIGHT: 'RIGHT'
};

class CurrencyContext {
  constructor() {
    this.hasSign = false;
    this.integerMax = 1;
    this.fractionalDist = new Map();
  }

  update(number) {
    if (number === null) return;

    const [integerPart, fractionalPart] = String(number).split('.');
    
    if (number < 0) this.hasSign = true;
    
    this.integerMax = Math.max(this.integerMax, integerPart.length);
    
    const fractionalDigits = fractionalPart ? fractionalPart.length : 0;
    this.fractionalDist.set(fractionalDigits, (this.fractionalDist.get(fractionalDigits) || 0) + 1);
  }

  getFractional(precision) {
    if (this.fractionalDist.size === 0) return null;
    
    if (precision === Precision.MOST_COMMON) {
      return [...this.fractionalDist.entries()].reduce((a, b) => a[1] > b[1] ? a : b)[0];
    } else if (precision === Precision.MAXIMUM) {
      return Math.max(...this.fractionalDist.keys());
    }
    
    throw new Error(`Unknown precision: ${precision}`);
  }
}

class DisplayContext {
  constructor() {
    this.ccontexts = new Map();
    this.ccontexts.set('__default__', new CurrencyContext());
    this.commas = false;
  }

  setCommas(commas) {
    this.commas = commas;
  }

  update(number, currency = '__default__') {
    if (!this.ccontexts.has(currency)) {
      this.ccontexts.set(currency, new CurrencyContext());
    }
    this.ccontexts.get(currency).update(number);
  }

  build(alignment = Align.NATURAL, precision = Precision.MOST_COMMON, commas = null, reserved = 0) {
    if (commas === null) commas = this.commas;
    
    let buildMethod;
    switch (alignment) {
      case Align.NATURAL:
        buildMethod = this._buildNatural;
        break;
      case Align.RIGHT:
        buildMethod = this._buildRight;
        break;
      case Align.DOT:
        buildMethod = this._buildDot;
        break;
      default:
        throw new Error(`Unknown alignment: ${alignment}`);
    }

    const fmtStrings = buildMethod.call(this, precision, commas, reserved);
    return new DisplayFormatter(this, precision, fmtStrings);
  }

  _buildNatural(precision, commas) {
    const commaStr = commas ? ',' : '';
    const fmtStrings = new Map();

    for (const [currency, ccontext] of this.ccontexts) {
      const numFractionalDigits = ccontext.getFractional(precision);
      const fmtStr = numFractionalDigits === null
        ? `{:${commaStr}f}`
        : `{:${commaStr}.${numFractionalDigits}f}`;
      fmtStrings.set(currency, fmtStr);
    }

    return fmtStrings;
  }

  // ... implement _buildRight and _buildDot methods similarly ...
}

class DisplayFormatter {
  constructor(dcontext, precision, fmtStrings) {
    this.dcontext = dcontext;
    this.precision = precision;
    this.fmtStrings = fmtStrings;
  }

  format(number, currency = '__default__') {
    const fmtStr = this.fmtStrings.get(currency) || this.fmtStrings.get('__default__');
    // Implement formatting logic here based on fmtStr
    // This is a simplified version and may need to be expanded
    return number.toFixed(fmtStr.match(/\.(\d+)f/)?.[1] || 0);
  }
}

// Default instance
const DEFAULT_DISPLAY_CONTEXT = new DisplayContext();
const DEFAULT_FORMATTER = DEFAULT_DISPLAY_CONTEXT.build();

export { DisplayContext, DisplayFormatter, Precision, Align, DEFAULT_DISPLAY_CONTEXT, DEFAULT_FORMATTER };