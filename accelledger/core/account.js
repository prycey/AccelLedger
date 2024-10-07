/**
 * Functions that operate on account strings.
 */

// Component separator for account names
const sep = ":";

// Regular expression for valid account name components
const ACC_COMP_TYPE_RE = /[A-Z][a-zA-Z0-9\-]*/;
const ACC_COMP_NAME_RE = /[A-Z0-9][a-zA-Z0-9\-]*/;

// Regular expression for a valid account
const ACCOUNT_RE = new RegExp(
  `^${ACC_COMP_TYPE_RE.source}(${sep}${ACC_COMP_NAME_RE.source})+$`
);

/**
 * Return true if the given string is a valid account name.
 * @param str - A string to be checked for account name pattern.
 * @returns True if the string has the form of an account's name.
 */
function isValid(str) {
  return typeof str === "string" && ACCOUNT_RE.test(str);
}

/**
 * Join the names with the account separator.
 * @param components - The components of an account name.
 * @returns A string joined in a single account name.
 */
function join(...components) {
  return components.join(sep);
}

/**
 * Split an account's name into its components.
 * @param accountName - An account name.
 * @returns The components of the account name (without the separators).
 */
function split(accountName) {
  return accountName.split(sep);
}

/**
 * Return the name of the parent account of the given account.
 * @param accountName - The name of the account whose parent to return.
 * @returns The name of the parent account of this account.
 */
function parent(accountName) {
  if (typeof accountName !== "string" || !accountName) {
    return null;
  }
  const components = accountName.split(sep);
  components.pop();
  return components.join(sep) || null;
}

/**
 * Get the name of the leaf of this account.
 * @param accountName - The name of the account whose leaf name to return.
 * @returns The name of the leaf of the account.
 */
function leaf(accountName) {
  if (typeof accountName !== "string") {
    return null;
  }
  return accountName.split(sep).pop() || null;
}

/**
 * Get the name of the account without the root.
 * @param accountName - The name of the account whose non-root portion to return.
 * @returns The name of the non-root portion of this account name.
 */
function sansRoot(accountName) {
  if (typeof accountName !== "string") {
    return null;
  }
  const components = accountName.split(sep).slice(1);
  return components.length > 0 ? components.join(sep) : null;
}

/**
 * Return the first few components of an account's name.
 * @param numComponents - The number of components to return.
 * @param accountName - An account name.
 * @returns The account root up to 'numComponents' components.
 */
function root(numComponents, accountName) {
  return split(accountName).slice(0, numComponents).join(sep);
}

/**
 * Return true if the account contains a given component.
 * @param accountName - An account name.
 * @param component - A component of an account name.
 * @returns True if the component is in the account.
 */
function hasComponent(accountName, component) {
  return new RegExp(`(^|${sep})${component}(${sep}|$)`).test(accountName);
}

/**
 * Return the common prefix of a list of account names.
 * @param accounts - A sequence of account name strings.
 * @returns The common parent account. If none, returns an empty string.
 */
function commonPrefix(accounts) {
  if (accounts.length === 0) return "";
  const sortedAccounts = [...accounts].sort();
  const first = sortedAccounts[0];
  const last = sortedAccounts[sortedAccounts.length - 1];
  let i = 0;
  while (i < first.length && first[i] === last[i]) i++;
  return first.slice(0, i).split(sep).slice(0, -1).join(sep);
}

/**
 * A generator of the names of the parents of this account, including this account.
 * @param accountName - The name of the account we want to start iterating from.
 * @returns A generator of account name strings.
 */
function* parents(accountName) {
  while (accountName) {
    yield accountName;
    accountName = parent(accountName) || "";
  }
}

/**
 * Account name transformer.
 */
class AccountTransformer {
  constructor(rsep = null) {
    this.rsep = rsep;
  }

  render(accountName) {
    return this.rsep === null
      ? accountName
      : accountName.replace(new RegExp(sep, "g"), this.rsep);
  }

  parse(transformedName) {
    return this.rsep === null
      ? transformedName
      : transformedName.replace(new RegExp(this.rsep, "g"), sep);
  }
}

module.exports = {
  sep,
  isValid,
  join,
  split,
  parent,
  leaf,
  sansRoot,
  root,
  hasComponent,
  commonPrefix,
  parents,
  AccountTransformer
};