const ZERO = 0;
const HALF = 0.5;
const ONE = 1;
const TEN = 10;

class MISSING {}

const NUMBER_RE = /[+-]?\s*[0-9,]*(?:\.[0-9]*)?/;
const CLEAN_NUMBER_RE = /[, ]/g;

function D(strord = null) {
  if (strord === null || strord === "") {
    return 0;
  } else if (typeof strord === "string") {
    return parseFloat(strord.replace(CLEAN_NUMBER_RE, ""));
  } else if (typeof strord === "number") {
    return strord;
  } else {
    throw new Error(`Invalid value to convert: ${strord}`);
  }
}

function roundTo(number, increment) {
  return Math.floor(number / increment) * increment;
}

function sameSign(number1, number2) {
  return number1 >= 0 === number2 >= 0;
}

function autoQuantizedExponent(number, threshold) {
  let norm = Math.abs(number);
  const lowThreshold = threshold;
  const highThreshold = 1.0 - lowThreshold;
  let exponent = 0;

  while (norm !== 0) {
    if (!(lowThreshold <= norm && norm <= highThreshold)) {
      break;
    }
    norm *= 10;
    exponent--;
  }

  return exponent;
}

function autoQuantize(number, threshold) {
  const exponent = autoQuantizedExponent(number, threshold);
  const factor = Math.pow(10, -exponent);
  return Math.round(number * factor) / factor;
}

function numFractionalDigits(number) {
  const str = number.toString();
  const decimalIndex = str.indexOf(".");
  return decimalIndex === -1 ? 0 : str.length - decimalIndex - 1;
}

function inferQuantumFromList(numbers, threshold = 0.01) {
  const qnumbers = numbers.map((num) => autoQuantize(num, threshold));
  const maxDigits = Math.max(...qnumbers.map(numFractionalDigits));
  return -maxDigits;
}

export {
  ZERO,
  HALF,
  ONE,
  TEN,
  MISSING,
  D,
  roundTo,
  sameSign,
  autoQuantize,
  inferQuantumFromList,
};
