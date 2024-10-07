// Basic data structures used to represent the Ledger entries.

// Enums
const Booking = Object.freeze({
  STRICT: "STRICT",
  STRICT_WITH_SIZE: "STRICT_WITH_SIZE",
  NONE: "NONE",
  AVERAGE: "AVERAGE",
  FIFO: "FIFO",
  LIFO: "LIFO",
  HIFO: "HIFO"
});

// Helper function to create metadata
function newMetadata(filename, lineno, kvlist = null) {
  const meta = { filename, lineno };
  if (kvlist) {
    Object.assign(meta, kvlist);
  }
  return meta;
}

// Main data structures
class Open {
  constructor(meta, date, account, currencies, booking) {
    this.meta = meta;
    this.date = date;
    this.account = account;
    this.currencies = currencies;
    this.booking = booking;
  }
}

class Close {
  constructor(meta, date, account) {
    this.meta = meta;
    this.date = date;
    this.account = account;
  }
}

class Commodity {
  constructor(meta, date, currency) {
    this.meta = meta;
    this.date = date;
    this.currency = currency;
  }
}

class Balance {
  constructor(meta, date, account, amount, tolerance, diffAmount) {
    this.meta = meta;
    this.date = date;
    this.account = account;
    this.amount = amount;
    this.tolerance = tolerance;
    this.diffAmount = diffAmount;
  }
}

class Posting {
  constructor(account, units, cost, price, flag, meta) {
    this.account = account;
    this.units = units;
    this.cost = cost;
    this.price = price;
    this.flag = flag;
    this.meta = meta;
  }
}

class Transaction {
  constructor(meta, date, flag, payee, narration, tags, links, postings) {
    this.meta = meta;
    this.date = date;
    this.flag = flag;
    this.payee = payee;
    this.narration = narration;
    this.tags = tags;
    this.links = links;
    this.postings = postings;
  }
}

// ... Other classes (Note, Event, Query, Price, Document, Custom) would be defined similarly ...

// Helper functions
function createSimplePosting(entry, account, number, currency) {
  const units = number !== null ? { number, currency } : null;
  const posting = new Posting(account, units, null, null, null, null);
  if (entry) {
    entry.postings.push(posting);
  }
  return posting;
}

function createSimplePostingWithCost(entry, account, number, currency, costNumber, costCurrency) {
  const units = { number, currency };
  const cost = { number: costNumber, currency: costCurrency, date: null, label: null };
  const posting = new Posting(account, units, cost, null, null, null);
  if (entry) {
    entry.postings.push(posting);
  }
  return posting;
}

function postingHasConversion(posting) {
  return posting.cost === null && posting.price !== null;
}

function transactionHasConversion(transaction) {
  return transaction.postings.some(postingHasConversion);
}

// Sorting functions
const SORT_ORDER = {
  Open: -2,
  Balance: -1,
  Document: 1,
  Close: 2
};

function entrySortKey(entry) {
  return [entry.date, SORT_ORDER[entry.constructor.name] || 0, entry.meta.lineno];
}

function sortEntries(entries) {
  return entries.sort((a, b) => {
    const keyA = entrySortKey(a);
    const keyB = entrySortKey(b);
    for (let i = 0; i < keyA.length; i++) {
      if (keyA[i] < keyB[i]) return -1;
      if (keyA[i] > keyB[i]) return 1;
    }
    return 0;
  });
}

// ... Other utility functions would be implemented similarly ...

function findLinkedEntries(transaction, entries) {
  if (!transaction.links || transaction.links.length === 0) {
    return [];
  }

  return entries.filter(entry => 
    entry instanceof Transaction && 
    entry.links && 
    entry.links.some(link => transaction.links.includes(link))
  );
}

export {
  Booking,
  Open,
  Close,
  Commodity,
  Balance,
  Posting,
  Transaction,
  newMetadata,
  createSimplePosting,
  createSimplePostingWithCost,
  postingHasConversion,
  transactionHasConversion,
  sortEntries,
  findLinkedEntries
};
