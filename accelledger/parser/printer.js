const fs = require("fs");
class EntryPrinter {
  constructor(
    dcontext = null,
    renderWeight = false,
    minWidthAccount = null,
    prefix = null,
    stringifyInvalidTypes = false,
    writeSource = false
  ) {
    this.dcontext = dcontext || new DisplayContext(); // Assuming DisplayContext is implemented
    this.dformat = this.dcontext.build(DisplayContext.Precision.MOST_COMMON);
    this.dformatMax = this.dcontext.build(DisplayContext.Precision.MAXIMUM);
    this.renderWeight = renderWeight;
    this.minWidthAccount = minWidthAccount;
    this.prefix = prefix || "  ";
    this.stringifyInvalidTypes = stringifyInvalidTypes;
    this.writeSource = writeSource;
    this.META_IGNORE = new Set(["filename", "lineno"]);
  }

  call(obj) {
    const oss = [];
    this.writeEntrySource(obj.meta, oss, "");
    const method = this[obj.constructor.name];
    method.call(this, obj, oss);
    return oss.join("");
  }

  writeMetadata(meta, oss, prefix = null) {
    if (!meta) return;
    prefix = prefix || this.prefix;

    for (const [key, value] of Object.entries(meta)) {
      if (!this.META_IGNORE.has(key) && !key.startsWith("__")) {
        let valueStr = null;
        if (typeof value === "string") {
          valueStr = `"${escapeString(value)}"`;
        } else if (
          value instanceof Date ||
          value instanceof Decimal ||
          value instanceof Amount ||
          value instanceof Enum
        ) {
          valueStr = value.toString();
        } else if (typeof value === "boolean") {
          valueStr = value ? "TRUE" : "FALSE";
        } else if (value === null) {
          valueStr = "";
        } else if (typeof value === "object") {
          // Ignore objects
        } else if (this.stringifyInvalidTypes) {
          valueStr = value.toString();
        } else {
          throw new Error(`Unexpected value: '${value}'`);
        }
        if (valueStr !== null) {
          oss.push(`${prefix}${key}: ${valueStr}\n`);
        }
      }
    }
  }

  writeEntrySource(meta, oss, prefix = null) {
    if (!this.writeSource) return;
    prefix = prefix || this.prefix;
    oss.push(`${prefix}; source: ${renderSource(meta)}\n`);
  }

  // Implement other methods (Transaction, Posting, Balance, etc.) here
  // ...
}
function renderSource(meta) {
  return `${meta.filename}:${meta.lineno}:`;
}

function formatError(error) {
  let output = `${renderSource(error.source)} ${error.message}\n`;
  if (error.entry) {
    const entries = Array.isArray(error.entry) ? error.entry : [error.entry];
    const errorString = entries.map((entry) => formatEntry(entry)).join("\n");
    output +=
      "\n" +
      errorString
        .split("\n")
        .map((line) => "   " + line)
        .join("\n") +
      "\n";
  }
  return output;
}

function printError(error, options = {}) {
  const output = options.file
    ? fs.createWriteStream(options.file, { flags: "a" })
    : process.stdout;
  output.write(formatError(error));
  output.write("\n");
  if (options.file) output.end();
}

function printErrors(errors, options = {}) {
  const output = options.file
    ? fs.createWriteStream(options.file, { flags: "a" })
    : process.stdout;
  const prefix = options.prefix || "";

  if (prefix) {
    output.write(prefix);
  }

  errors.forEach((error) => {
    output.write(formatError(error));
    output.write("\n");
  });

  if (options.file) output.end();
}

function printEntries(entries, options = {}) {
  const output = options.file
    ? fs.createWriteStream(options.file, { flags: 'a' })
    : process.stdout;
  const prefix = options.prefix || '';

  if (prefix) {
    output.write(prefix);
  }

  entries.forEach((entry) => {
    output.write(formatEntry(entry));
    output.write('\n');
  });

  if (options.file) output.end();
}

function alignPositionStrings(strings) {
  const maxLength = Math.max(...strings.map((s) => s.length));
  return [strings.map((s) => s.padStart(maxLength)), maxLength];
}

function formatEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return `YYYY-MM-DD Unknown entry type: ${typeof entry}\n`;
  }

  let formattedEntry = "";

  // Format date
  if (entry.date && entry.date instanceof Date) {
    formattedEntry += entry.date.toISOString().split("T")[0] + " ";
  } else {
    formattedEntry += "YYYY-MM-DD ";
  }

  // Format different entry types
  switch (entry.type) {
    case "balance":
      formattedEntry += `balance ${entry.account} ${entry.amount} ${entry.currency}\n`;
      break;
    case "transaction":
      formattedEntry += `* "${entry.payee}" "${entry.narration}"\n`;
      entry.postings.forEach(posting => {
        formattedEntry += `  ${posting.account}  ${posting.units.number} ${posting.units.currency}\n`;
      });
      break;
    default:
      formattedEntry += `Unknown entry type: ${entry.type}\n`;
  }

  return formattedEntry;
}

module.exports = {
  EntryPrinter,
  formatEntry,
  renderSource,
  formatError,
  printError,
  printErrors,
  printEntries,  // Add this line
  alignPositionStrings,
};
