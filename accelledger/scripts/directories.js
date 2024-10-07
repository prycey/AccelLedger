import fs from 'fs';
import path from 'path';
import { getAccounts } from '../core/getters.js';

class ValidateDirectoryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidateDirectoryError';
  }
}

function validateDirectory(accounts, documentDir) {
  const accountsWithParents = new Set(accounts);
  for (const account of accounts) {
    let parent = account;
    while (true) {
      parent = path.dirname(parent);
      if (parent === '.' || accountsWithParents.has(parent)) {
        break;
      }
      accountsWithParents.add(parent);
    }
  }

  const errors = [];
  walkAccounts(documentDir, (directory, accountName) => {
    if (!accountsWithParents.has(accountName)) {
      errors.push(
        new ValidateDirectoryError(
          `Invalid directory '${directory}': no corresponding account '${accountName}'`
        )
      );
    }
  });

  return errors;
}

function* walkAccounts(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    if (file.isDirectory()) {
      const fullPath = path.join(dir, file.name);
      const accountName = fullPath.slice(dir.length + 1).replace(/\//g, ':');
      yield [fullPath, accountName];
      yield* walkAccounts(fullPath);
    }
  }
}

function validateDirectories(entries, documentDirs) {
  const accounts = getAccounts(entries);

  for (const documentDir of documentDirs) {
    const errors = validateDirectory(accounts, documentDir);
    for (const error of errors) {
      console.error(`ERROR: ${error.message}`);
    }
  }
}

export { ValidateDirectoryError, validateDirectory, validateDirectories };
