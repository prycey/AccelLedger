/**
 * Realization of specific lists of account postings into reports.
 *
 * This code converts a list of entries into a tree of RealAccount nodes.
 * The RealAccount objects contain lists of Posting instances instead of Transactions,
 * or other entry types that are attached to an account, such as a Balance or Note entry.
 */

class RealAccount {
  constructor(accountName) {
    this.account = accountName;
    this.txnPostings = [];
    this.balance = new Inventory();
    this.children = {};
  }

  setChild(key, value) {
    if (typeof key !== "string" || !key) {
      throw new Error(`Invalid RealAccount key: '${key}'`);
    }
    if (!(value instanceof RealAccount)) {
      throw new Error(`Invalid RealAccount value: '${value}'`);
    }
    if (!value.account.endsWith(key)) {
      throw new Error(
        `RealAccount name '${value.account}' inconsistent with key: '${key}'`
      );
    }
    this.children[key] = value;
  }
}

function iterChildren(realAccount, leafOnly = false) {
  function* iterator(account) {
    if (!leafOnly || Object.keys(account.children).length === 0) {
      yield account;
    }
    for (const child of Object.values(account.children).sort((a, b) =>
      a.account.localeCompare(b.account)
    )) {
      yield* iterator(child);
    }
  }
  return iterator(realAccount);
}

function get(realAccount, accountName, defaultValue = null) {
  const components = accountName.split(":");
  let current = realAccount;
  for (const component of components) {
    current = current.children[component];
    if (!current) return defaultValue;
  }
  return current;
}

function getOrCreate(realAccount, accountName) {
  const components = accountName.split(":");
  let current = realAccount;
  let path = [];
  for (const component of components) {
    path.push(component);
    if (!current.children[component]) {
      const newAccount = new RealAccount(path.join(":"));
      current.setChild(component, newAccount);
    }
    current = current.children[component];
  }
  return current;
}

function realize(entries, minAccounts = null, computeBalance = true) {
  const txnPostingsMap = postingsByAccount(entries);
  const realRoot = new RealAccount("");

  for (const [accountName, txnPostings] of Object.entries(txnPostingsMap)) {
    const realAccount = getOrCreate(realRoot, accountName);
    realAccount.txnPostings = txnPostings;
    if (computeBalance) {
      realAccount.balance = computePostingsBalance(txnPostings);
    }
  }

  if (minAccounts) {
    for (const accountName of minAccounts) {
      getOrCreate(realRoot, accountName);
    }
  }

  return realRoot;
}

function postingsByAccount(entries) {
  const txnPostingsMap = {};
  for (const entry of entries) {
    if (entry instanceof Transaction) {
      for (const posting of entry.postings) {
        if (!txnPostingsMap[posting.account]) {
          txnPostingsMap[posting.account] = [];
        }
        txnPostingsMap[posting.account].push(new TxnPosting(entry, posting));
      }
    } else if (
      entry instanceof Open ||
      entry instanceof Close ||
      entry instanceof Balance ||
      entry instanceof Note ||
      entry instanceof Document
    ) {
      if (!txnPostingsMap[entry.account]) {
        txnPostingsMap[entry.account] = [];
      }
      txnPostingsMap[entry.account].push(entry);
    } else if (entry instanceof Pad) {
      for (const account of [entry.account, entry.sourceAccount]) {
        if (!txnPostingsMap[account]) {
          txnPostingsMap[account] = [];
        }
        txnPostingsMap[account].push(entry);
      }
    } else if (entry instanceof Custom) {
      for (const customValue of entry.values) {
        if (customValue.dtype === account.TYPE) {
          if (!txnPostingsMap[customValue.value]) {
            txnPostingsMap[customValue.value] = [];
          }
          txnPostingsMap[customValue.value].push(entry);
        }
      }
    }
  }
  return txnPostingsMap;
}

// ... (other helper functions like computePostingsBalance, filter, etc.)

module.exports = {
  RealAccount,
  iterChildren,
  get,
  getOrCreate,
  realize,
  postingsByAccount,
  // ... (export other functions as needed)
};
