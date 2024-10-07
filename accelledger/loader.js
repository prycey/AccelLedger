import fs from "fs";
import path from "path";
import { parseFile } from "./parser/parser.js";
import { book } from "./parser/booking.js";
import { validate } from "./ops/validation.js";

const PLUGINS_PRE = [["accelledger.ops.documents", null]];

const PLUGINS_POST = [
  ["accelledger.ops.pad", null],
  ["accelledger.ops.balance", null],
];

class LoadError {
  constructor(source, message, entry) {
    this.source = source;
    this.message = message;
    this.entry = entry;
  }
}

function loadFile(
  filename,
  logTimings = null,
  logErrors = null,
  extraValidations = null,
  encoding = "utf8"
) {
  const absoluteFilename = path.resolve(filename);
  return _loadFile(absoluteFilename, logTimings, extraValidations, encoding);
}

function loadString(
  string,
  logTimings = null,
  logErrors = null,
  extraValidations = null,
  dedent = false,
  encoding = "utf8"
) {
  if (dedent) {
    string = string.replace(/^[ \t]+/gm, "");
  }
  const [entries, errors, optionsMap] = _load(
    [{ source: string, isFile: false }],
    logTimings,
    extraValidations,
    encoding
  );
  _logErrors(errors, logErrors);
  return [entries, errors, optionsMap];
}

function _loadFile(filename, logTimings, extraValidations, encoding) {
  return _load(
    [{ source: filename, isFile: true }],
    logTimings,
    extraValidations,
    encoding
  );
}

function _load(sources, logTimings, extraValidations, encoding) {
  let entries = [];
  let errors = [];
  let optionsMap = null;

  // Parse all sources
  [entries, errors, optionsMap] = _parseRecursive(
    sources,
    logTimings,
    encoding
  );
  entries.sort((a, b) => a.date - b.date);

  // Run booking
  entries = book(entries, optionsMap);

  // Validate entries
  const validationErrors = validate(
    entries,
    optionsMap,
    logTimings,
    extraValidations
  );
  errors.push(...validationErrors);

  // Compute input hash
  optionsMap.inputHash = computeInputHash(optionsMap.include);

  return [entries, errors, optionsMap];
}

function _parseRecursive(sources, logTimings, encoding) {
  let entries = [];
  let errors = [];
  let optionsMap = null;
  const otherOptionsMaps = [];
  const sourceStack = [...sources];
  const filenamesSeen = new Set();

  while (sourceStack.length > 0) {
    const { source, isFile } = sourceStack.shift();
    const isTopLevel = optionsMap === null;

    let sourceEntries, sourceErrors, sourceOptionsMap;

    if (isFile) {
      const filename = path.resolve(source);
      if (filenamesSeen.has(filename)) {
        errors.push(
          new LoadError(
            "<load>",
            `Duplicate filename parsed: "${filename}"`,
            null
          )
        );
        continue;
      }
      if (!fs.existsSync(filename)) {
        errors.push(
          new LoadError("<load>", `File "${filename}" does not exist`, null)
        );
        continue;
      }
      filenamesSeen.add(filename);
      const content = fs.readFileSync(filename, encoding);
      [sourceEntries, sourceErrors, sourceOptionsMap] = parseFile(
        filename,
        encoding
      );
    } else {
      [sourceEntries, sourceErrors, sourceOptionsMap] = parse(source);
    }

    entries.push(...sourceEntries);
    errors.push(...sourceErrors);

    if (isTopLevel) {
      optionsMap = sourceOptionsMap;
    } else {
      otherOptionsMaps.push(sourceOptionsMap);
    }

    // Process includes
    if (sourceOptionsMap && sourceOptionsMap.include) {
      for (const includeFilename of sourceOptionsMap.include) {
        const absoluteIncludeFilename = path.resolve(
          path.dirname(source),
          includeFilename
        );
        sourceStack.push({ source: absoluteIncludeFilename, isFile: true });
      }
    }
  }

  if (optionsMap === null) {
    optionsMap = { ...defaultOptions };
  }

  optionsMap.include = Array.from(filenamesSeen).sort();
  optionsMap = aggregateOptionsMap(optionsMap, otherOptionsMaps);

  return [entries, errors, optionsMap];
}

function aggregateOptionsMap(optionsMap, otherOptionsMaps) {
  const newOptionsMap = { ...optionsMap };

  const currencies = new Set(optionsMap.operatingCurrency);
  for (const omap of otherOptionsMaps) {
    for (const currency of omap.operatingCurrency) {
      currencies.add(currency);
    }
    // Merge other options as needed
  }
  newOptionsMap.operatingCurrency = Array.from(currencies);

  // Process other options as needed

  return newOptionsMap;
}

function computeInputHash(filenames) {
  // Implement hash computation logic
  return "dummy-hash";
}

function _logErrors(errors, logErrors) {
  if (logErrors && errors.length > 0) {
    if (typeof logErrors === "function") {
      logErrors(errors.map((e) => `${e.source}: ${e.message}`).join("\n"));
    } else {
      console.error(errors.map((e) => `${e.source}: ${e.message}`).join("\n"));
    }
  }
}

export { loadFile, loadString, LoadError };
