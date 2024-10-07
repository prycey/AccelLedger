const fs = require("fs");
const { Transaction, Posting } = require("../core/data"); // Add this line

function isPostingIncomplete(posting) {
  return !posting.units || !posting.units.number || !posting.units.currency;
}

function isEntryIncomplete(entry) {
  if (entry.type === "transaction") {
    return entry.postings.some((posting) => isPostingIncomplete(posting));
  }
  return false;
}

function parseFile(
  filePath,
  reportFilename = null,
  reportFirstline = 1,
  encoding = "utf-8",
  debug = false,
  ...options
) {
  const content = fs.readFileSync(filePath, encoding);
  return parseString(content, reportFilename, ...options);
}

function parseString(
  string,
  reportFilename = null,
  dedent = false,
  ...options
) {
  if (dedent) {
    string = string
      .split("\n")
      .map((line) => line.trim())
      .join("\n");
  }

  const lines = string.split("\n");
  const entries = [];
  const errors = [];
  const optionsMap = {};

  lines.forEach((line, index) => {
    try {
      const entry = parseLine(line, reportFilename, index + 1);
      if (entry) {
        if (entry.type === "option") {
          optionsMap[entry.key] = entry.value;
        } else {
          entries.push(entry);
        }
      }
    } catch (error) {
      errors.push(error);
    }
  });

  return [entries, errors, optionsMap];
}

function parseLine(line, reportFilename, lineNumber) {
  // Trim the line to remove leading/trailing whitespace
  line = line.trim();

  // Check for transaction lines
  if (/^\d{4}-\d{2}-\d{2}\s+\*/.test(line)) {
    return parseTransaction(line);
  }

  // Check for posting lines
  if (/^\s*[A-Za-z]/.test(line)) {
    return parsePosting(line);
  }

  // ... other line type checks ...

  throw new ParserSyntaxError(`Unknown line type: ${line}`);
}

function parseTransaction(line) {
  const [date, flag, payee, narration] = line
    .split(/\s+(.)\s+"([^"]*)"\s+"([^"]*)"/)
    .filter(Boolean);
  return new Transaction(null, date, flag, payee, narration, [], [], []);
}

function parsePosting(line) {
  const [account, amount, currency] = line.trim().split(/\s+/);
  return new Posting(
    account,
    { number: parseFloat(amount), currency },
    null,
    null,
    null,
    null
  );
}

function parseOpen(date, rest, reportFilename, lineNumber) {
  const [account, ...currencies] = rest.split(/\s+/);
  return {
    type: "open",
    date: new Date(date),
    account,
    currencies: currencies.length > 0 ? currencies : null,
  };
}

function parseClose(date, account, reportFilename, lineNumber) {
  return {
    type: "close",
    date: new Date(date),
    account,
  };
}

function parseCommodity(date, currency, reportFilename, lineNumber) {
  return {
    type: "commodity",
    date: new Date(date),
    currency,
  };
}

function parseBalance(date, rest, reportFilename, lineNumber) {
  const [account, amount, currency] = rest.split(/\s+/);
  return {
    type: "balance",
    date: new Date(date),
    account,
    amount: parseFloat(amount),
    currency,
  };
}

function parsePad(date, rest, reportFilename, lineNumber) {
  const [account, sourceAccount] = rest.split(/\s+/);
  return {
    type: "pad",
    date: new Date(date),
    account,
    sourceAccount,
  };
}

function parseNote(date, rest, reportFilename, lineNumber) {
  const [account, ...noteContent] = rest.split(/\s+/);
  return {
    type: "note",
    date: new Date(date),
    account,
    note: noteContent.join(" ").replace(/^"|"$/g, ""),
  };
}

function parseDocument(date, rest, reportFilename, lineNumber) {
  const [account, ...pathParts] = rest.split(/\s+/);
  return {
    type: "document",
    date: new Date(date),
    account,
    path: pathParts.join(" ").replace(/^"|"$/g, ""),
  };
}

function parsePrice(date, rest, reportFilename, lineNumber) {
  const [currency, amount, priceCurrency] = rest.split(/\s+/);
  return {
    type: "price",
    date: new Date(date),
    currency,
    amount: parseFloat(amount),
    priceCurrency,
  };
}

function parseEvent(date, rest, reportFilename, lineNumber) {
  const [name, ...value] = rest.split(/\s+/);
  return {
    type: "event",
    date: new Date(date),
    name: name.replace(/^"|"$/g, ""),
    value: value.join(" ").replace(/^"|"$/g, ""),
  };
}

function parseQuery(date, rest, reportFilename, lineNumber) {
  const [name, ...query] = rest.split(/\s+/);
  return {
    type: "query",
    date: new Date(date),
    name: name.replace(/^"|"$/g, ""),
    query: query.join(" ").replace(/^"|"$/g, ""),
  };
}

function parseCustom(date, rest, reportFilename, lineNumber) {
  const [typeName, ...values] = rest.split(/\s+/);
  return {
    type: "custom",
    date: new Date(date),
    typeName: typeName.replace(/^"|"$/g, ""),
    values: values.map((v) => {
      if (v.startsWith('"') && v.endsWith('"')) {
        return v.slice(1, -1);
      } else if (!isNaN(v)) {
        return parseFloat(v);
      }
      return v;
    }),
  };
}

function parseTransaction(line, reportFilename, lineNumber) {
  const [date, flag, payee, narration] = line
    .split(/\s+(.)\s+"([^"]*)"\s+"([^"]*)"/)
    .filter(Boolean);
  return new Transaction(null, date, flag, payee, narration, [], [], []);
}

function parseOption(line, reportFilename, lineNumber) {
  const match = line.match(/option\s+"(.+)"\s+"(.+)"/);
  if (!match) {
    throw new ParserSyntaxError(
      `Invalid option format at ${reportFilename}:${lineNumber}: ${line}`
    );
  }
  return {
    type: "option",
    key: match[1],
    value: match[2],
  };
}

function parsePlugin(line, reportFilename, lineNumber) {
  const match = line.match(/plugin\s+"(.+)"(?:\s+"(.+)")?/);
  if (!match) {
    throw new ParserSyntaxError(
      `Invalid plugin format at ${reportFilename}:${lineNumber}: ${line}`
    );
  }
  return {
    type: "plugin",
    module: match[1],
    config: match[2] || null,
  };
}

function parseInclude(line, reportFilename, lineNumber) {
  const match = line.match(/include\s+"(.+)"/);
  if (!match) {
    throw new ParserSyntaxError(
      `Invalid include format at ${reportFilename}:${lineNumber}: ${line}`
    );
  }
  return {
    type: "include",
    filename: match[1],
  };
}

function parseDoc(expect_errors = false, allow_incomplete = false) {
  return function (testFunction) {
    return function () {
      const docstring = testFunction
        .toString()
        .match(/\/\*\*([\s\S]*?)\*\//)[1];
      const [entries, errors, optionsMap] = parseString(docstring);

      if (expect_errors && errors.length === 0) {
        throw new Error("Expected errors but none were found");
      }

      if (!expect_errors && errors.length > 0) {
        throw new Error(`Unexpected errors: ${errors.join(", ")}`);
      }

      if (!allow_incomplete) {
        for (const entry of entries) {
          if (isEntryIncomplete(entry)) {
            throw new Error("Incomplete entry found");
          }
        }
      }

      return testFunction(entries, errors, optionsMap);
    };
  };
}

function parseMany(string, level = 0) {
  const [entries, errors, optionsMap] = parseString(string);
  if (errors.length > 0) {
    throw new Error(`Parsing errors encountered: ${errors.join(", ")}`);
  }
  return entries;
}

function parseOne(string) {
  const [entries, errors, _] = parseString(string);
  if (errors.length > 0) {
    throw new Error(`Parsing errors encountered: ${errors.join(", ")}`);
  }
  if (entries.length !== 1) {
    throw new Error(`Expected exactly one entry, found ${entries.length}`);
  }
  return entries[0];
}

class ParserError extends Error {
  constructor(message) {
    super(message);
    this.name = "ParserError";
  }
}

class ParserSyntaxError extends ParserError {
  constructor(message) {
    super(message);
    this.name = "ParserSyntaxError";
  }
}

class DeprecatedError extends ParserError {
  constructor(message) {
    super(message);
    this.name = "DeprecatedError";
  }
}

module.exports = {
  isPostingIncomplete,
  isEntryIncomplete,
  parseFile,
  parseString,
  parseDoc,
  parseMany,
  parseOne,
  ParserError,
  ParserSyntaxError,
  DeprecatedError,
};
