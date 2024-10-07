import { loadFile, loadString, LoadError } from './loader.js';
import { parseFile, parseString, parseMany, parseOne } from './parser/parser.js';
import { book } from './parser/booking.js';
import { validate } from './ops/validation.js';
import { compress } from './ops/compress.js';
import { Context, renderFileContext, renderEntryContext } from './parser/context.js';
import { validateDirectories } from './scripts/directories.js';
import { Distribution } from './core/distribution.js';
import { compareEntries, includesEntries, excludesEntries } from './core/compare.js';
import { isGpgInstalled, isEncryptedFile, readEncryptedFile } from './utils/encryption.js';
import { EntryPrinter, formatEntry } from './parser/printer.js';
import { logTime, deprecated, box } from './utils/misc_utils.js';

// Export core functionality
export {
  loadFile,
  loadString,
  LoadError,
  parseFile,
  parseString,
  parseMany,
  parseOne,
  book,
  validate,
  compress,
  Context,
  renderFileContext,
  renderEntryContext,
  validateDirectories,
  Distribution,
  compareEntries,
  includesEntries,
  excludesEntries,
  isGpgInstalled,
  isEncryptedFile,
  readEncryptedFile,
  EntryPrinter,
  formatEntry,
  logTime,
  deprecated,
  box
};

// Export utility functions
export { tableToHtml, tableToText } from './utils/table.js';

// Export account-related functions
export {
  getAccountType,
  isRootAccount,
  isLeafAccount,
  getAccountTypes,
  isIncomeStatementAccount,
  isEquityAccount,
  isInvertedAccount
} from './core/account_types.js';

// Export option-related functions and constants
export {
  OptDesc,
  OPTION_GROUPS,
  OPTIONS,
  OPTIONS_DEFAULTS,
  READ_ONLY_OPTIONS,
  getAccountTypes,
  getPreviousAccounts,
  getCurrentAccounts,
  getUnrealizedAccount,
  listOptions
} from './parser/options.js';

// Export error classes
export { ParserError, ParserSyntaxError, DeprecatedError } from './parser/parser.js';
export { BookingError } from './parser/booking.js';
export { ValidateDirectoryError } from './scripts/directories.js';

// Export main CLI function
export { main as checkMain } from './scripts/check.js';
