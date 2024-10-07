// Getter functions that operate on lists of entries to return various lists of
// things that they reference, accounts, tags, links, currencies, etc.

class GetAccounts {
  constructor() {
    // Associate all the possible directives with their respective handlers.
    this.Open =
      this.Close =
      this.Balance =
      this.Note =
      this.Document =
        this._one;
    this.Commodity =
      this.Event =
      this.Query =
      this.Price =
      this.Custom =
        this._zero;
  }

  getAccountsUseMap(entries) {
    const accountsFirst = {};
    const accountsLast = {};
    for (const entry of entries) {
      const method = this[entry.constructor.name];
      for (const account of method(entry)) {
        if (!(account in accountsFirst)) {
          accountsFirst[account] = entry.date;
        }
        accountsLast[account] = entry.date;
      }
    }
    return [accountsFirst, accountsLast];
  }

  getEntryAccounts(entry) {
    const methodName = entry.constructor.name;
    const method = this[methodName];
    if (typeof method === 'function') {
      return new Set(method.call(this, entry));
    } else if (Array.isArray(entry)) {
      // Handle Array type entries
      return new Set(entry.flatMap(item => this.getEntryAccounts(item)));
    } else if (typeof entry === 'object') {
      // Handle all object types
      if (entry.type === 'commodity') {
        // Handle commodity type entries
        return new Set(); // Commodities don't have associated accounts
      } else if (entry.type === 'open') {
        // Handle open account entries
        return new Set([entry.account]);
      } else if (entry.account) {
        // Handle any other entry types with an account property
        return new Set([entry.account]);
      } else {
        console.log('Unexpected entry type:', typeof entry, entry);
        return new Set(); // Return an empty set for unknown types
      }
    } else {
      console.log('Unexpected entry type:', typeof entry, entry);
      return new Set(); // Return an empty set for unknown types
    }
  }

  Transaction(entry) {
    return entry.postings.map((posting) => posting.account);
  }

  Pad(entry) {
    return [entry.account, entry.sourceAccount];
  }

  _one(entry) {
    return [entry.account];
  }

  _zero() {
    return [];
  }
}

// Global instance to share.
const _GetAccounts = new GetAccounts();

function getAccountsUseMap(entries) {
  return _GetAccounts.getAccountsUseMap(entries);
}

function getAccounts(entries) {
  const [, accountsLast] = _GetAccounts.getAccountsUseMap(entries);
  return Object.keys(accountsLast);
}

function getEntryAccounts(entry) {
  return _GetAccounts.getEntryAccounts(entry);
}

function getAccountComponents(entries) {
  const accounts = getAccounts(entries);
  const components = new Set();
  for (const accountName of accounts) {
    accountName.split(":").forEach((component) => components.add(component));
  }
  return Array.from(components).sort();
}

function getAllTags(entries) {
  const allTags = new Set();
  for (const entry of entries) {
    if (entry.constructor.name !== "Transaction") continue;
    if (entry.tags) {
      entry.tags.forEach((tag) => allTags.add(tag));
    }
  }
  return Array.from(allTags).sort();
}

function getAllPayees(entries) {
  const allPayees = new Set();
  for (const entry of entries) {
    if (entry.constructor.name !== "Transaction") continue;
    if (entry.payee) allPayees.add(entry.payee);
  }
  return Array.from(allPayees).sort();
}

function getAllLinks(entries) {
  const allLinks = new Set();
  for (const entry of entries) {
    if (entry.constructor.name !== "Transaction") continue;
    if (entry.links) {
      entry.links.forEach((link) => allLinks.add(link));
    }
  }
  return Array.from(allLinks).sort();
}

function getLevelnParentAccounts(accountNames, level, nrepeats = 0) {
  const levelDict = {};
  for (const accountName of new Set(accountNames)) {
    const components = accountName.split(":");
    if (level < components.length) {
      levelDict[components[level]] = (levelDict[components[level]] || 0) + 1;
    }
  }
  const levels = Object.entries(levelDict)
    .filter(([, count]) => count > nrepeats)
    .map(([level]) => level);
  return levels.sort();
}

function getDictAccounts(accountNames) {
  const levelDict = {};
  const ACCOUNT_LABEL = "__root__";

  for (const accountName of accountNames) {
    let nestedDict = levelDict;
    for (const component of accountName.split(":")) {
      nestedDict[component] = nestedDict[component] || {};
      nestedDict = nestedDict[component];
    }
    nestedDict[ACCOUNT_LABEL] = true;
  }
  return levelDict;
}

function getMinMaxDates(entries, types = null) {
  let dateFirst = null;
  let dateLast = null;

  for (const entry of entries) {
    if (types && !types.includes(entry.constructor)) continue;
    dateFirst = entry.date;
    break;
  }

  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (types && !types.includes(entry.constructor)) continue;
    dateLast = entry.date;
    break;
  }

  return [dateFirst, dateLast];
}

function* getActiveYears(entries) {
  const seen = new Set();
  let prevYear = null;
  for (const entry of entries) {
    const year = entry.date.getFullYear();
    if (year !== prevYear) {
      prevYear = year;
      if (!seen.has(year)) {
        seen.add(year);
        yield year;
      }
    }
  }
}

function getAccountOpenClose(entries) {
  const openCloseMap = {};
  for (const entry of entries) {
    if (entry.constructor.name !== "Open" && entry.constructor.name !== "Close")
      continue;
    if (!openCloseMap[entry.account]) {
      openCloseMap[entry.account] = [null, null];
    }
    const index = entry.constructor.name === "Open" ? 0 : 1;
    const previousEntry = openCloseMap[entry.account][index];
    if (!previousEntry || previousEntry.date > entry.date) {
      openCloseMap[entry.account][index] = entry;
    }
  }
  return openCloseMap;
}

function getCommodityDirectives(entries) {
  return entries
    .filter((entry) => entry.constructor.name === "Commodity")
    .reduce((acc, entry) => {
      acc[entry.currency] = entry;
      return acc;
    }, {});
}

function getValuesMeta(nameToEntriesMap, ...metaKeys) {
  const valueMap = {};
  for (const [key, entry] of Object.entries(nameToEntriesMap)) {
    const valueList = metaKeys.map((metaKey) =>
      entry && entry.meta ? entry.meta[metaKey] : undefined
    );
    valueMap[key] = metaKeys.length === 1 ? valueList[0] : valueList;
  }
  return valueMap;
}

export {
  getAccountsUseMap,
  getAccounts,
  getEntryAccounts,
  getAccountComponents,
  getAllTags,
  getAllPayees,
  getAllLinks,
  getLevelnParentAccounts,
  getDictAccounts,
  getMinMaxDates,
  getActiveYears,
  getAccountOpenClose,
  getCommodityDirectives,
  getValuesMeta,
};
