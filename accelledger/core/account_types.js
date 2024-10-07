const path = require("path");
const os = require("os");

const sep = ":";

const ACC_COMP_TYPE_RE = /[\p{Lu}][\p{L}\p{Nd}\-]*/u;
const ACC_COMP_NAME_RE = /[\p{Lu}\p{Nd}][\p{L}\p{Nd}\-]*/u;

const ACCOUNT_RE = new RegExp(
  `(?:${ACC_COMP_TYPE_RE.source})(?:${sep}${ACC_COMP_NAME_RE.source})+`
);

const TYPE = "<AccountDummy>";

function isValid(string) {
  return typeof string === "string" && ACCOUNT_RE.test(string);
}

function join(...components) {
  return components.join(sep);
}

function split(accountName) {
  return accountName.split(sep);
}

function parent(accountName) {
  if (typeof accountName !== "string") return null;
  const components = accountName.split(sep);
  components.pop();
  return components.join(sep);
}

function leaf(accountName) {
  if (typeof accountName !== "string") return null;
  return accountName.split(sep).pop() ?? null;
}

function sansRoot(accountName) {
  if (typeof accountName !== "string") return null;
  const components = accountName.split(sep).slice(1);
  return join(...components);
}

function root(numComponents, accountName) {
  return join(...split(accountName).slice(0, numComponents));
}

function hasComponent(accountName, component) {
  const regex = new RegExp(`(^|:)${component}(:|$)`);
  return regex.test(accountName);
}

function commonPrefix(accounts) {
  const accountsLists = accounts.map((account) => account.split(sep));
  const commonList = path.commonPrefix(accountsLists);
  return commonList.join(sep);
}

function* walk(rootDirectory) {
  const stack = [rootDirectory];
  while (stack.length) {
    const root = stack.pop();
    const dirs = [];
    const files = [];
    dirs.sort();
    files.sort();
    const relroot = root.slice(rootDirectory.length + 1);
    let accountName = relroot.split(path.sep).join(sep);
    accountName = accountName.normalize("NFKC");
    if (isValid(accountName)) {
      yield [root, accountName, dirs, files];
    }
  }
}

function parentMatcher(accountName) {
  const regex = new RegExp(`${accountName}($|${sep})`);
  return (str) => regex.test(str);
}

function* parents(accountName) {
  while (accountName) {
    yield accountName;
    accountName = parent(accountName);
  }
}

class AccountTransformer {
  constructor(rsep = null) {
    this.rsep = rsep;
  }

  render(accountName) {
    return this.rsep === null
      ? accountName
      : accountName.split(sep).join(this.rsep);
  }

  parse(transformedName) {
    return this.rsep === null
      ? transformedName
      : transformedName.split(this.rsep).join(sep);
  }
}

const DEFAULT_ACCOUNT_TYPES = {
  assets: "Assets",
  liabilities: "Liabilities",
  equity: "Equity",
  income: "Income",
  expenses: "Expenses"
};

function getAccountType(accountName) {
  if (typeof accountName !== "string") {
    throw new Error(`Account is not a string: ${accountName}`);
  }
  return split(accountName)[0];
}

function getAccountSortKey(accountTypes, accountName) {
  const type = getAccountType(accountName);
  return [Object.values(accountTypes).indexOf(type), accountName];
}

function isAccountType(accountType, accountName) {
  return new RegExp(`^${accountType}${sep}`).test(accountName);
}

function isRootAccount(accountName) {
  if (typeof accountName !== "string") {
    throw new Error(`Account is not a string: ${accountName}`);
  }
  return Boolean(accountName) && /^([A-Z][A-Za-z0-9\-]+)$/.test(accountName);
}

function isBalanceSheetAccount(accountName, accountTypes) {
  if (typeof accountName !== "string") {
    throw new Error(`Account is not a string: ${accountName}`);
  }
  if (typeof accountTypes !== "object") {
    throw new Error(`Account types has invalid type: ${accountTypes}`);
  }
  const accountType = getAccountType(accountName);
  return [accountTypes.assets, accountTypes.liabilities, accountTypes.equity].includes(accountType);
}

function isIncomeStatementAccount(accountName, accountTypes) {
  if (typeof accountName !== "string") {
    throw new Error(`Account is not a string: ${accountName}`);
  }
  if (typeof accountTypes !== "object") {
    throw new Error(`Account types has invalid type: ${accountTypes}`);
  }
  const accountType = getAccountType(accountName);
  return [accountTypes.income, accountTypes.expenses].includes(accountType);
}

function isEquityAccount(accountName, accountTypes) {
  if (typeof accountName !== "string") {
    throw new Error(`Account is not a string: ${accountName}`);
  }
  if (typeof accountTypes !== "object") {
    throw new Error(`Account types has invalid type: ${accountTypes}`);
  }
  const accountType = getAccountType(accountName);
  return accountType === accountTypes.equity;
}

function isInvertedAccount(accountName, accountTypes) {
  if (typeof accountName !== "string") {
    throw new Error(`Account is not a string: ${accountName}`);
  }
  if (typeof accountTypes !== "object") {
    throw new Error(`Account types has invalid type: ${accountTypes}`);
  }
  const accountType = getAccountType(accountName);
  return [accountTypes.liabilities, accountTypes.income, accountTypes.equity].includes(accountType);
}

function getAccountSign(accountName, accountTypes = DEFAULT_ACCOUNT_TYPES) {
  if (typeof accountName !== "string") {
    throw new Error(`Account is not a string: ${accountName}`);
  }
  const accountType = getAccountType(accountName);
  return [accountTypes.assets, accountTypes.expenses].includes(accountType) ? 1 : -1;
}

module.exports = {
  DEFAULT_ACCOUNT_TYPES,
  getAccountType,
  getAccountSortKey,
  isAccountType,
  isRootAccount,
  isBalanceSheetAccount,
  isIncomeStatementAccount,
  isEquityAccount,
  isInvertedAccount,
  getAccountSign
};