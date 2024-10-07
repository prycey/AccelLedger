/**
 * Support for encrypted tests.
 * 
 * @copyright Copyright (C) 2015-2017  Martin Blais
 * @license GNU GPLv2
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Check if GPG 1.4.x or 2.x is installed.
 * @returns {Promise<boolean>} True if GPG is installed and supported.
 */
function isGpgInstalled() {
    return new Promise((resolve) => {
        exec('gpg --version', (error, stdout) => {
            if (error) {
                resolve(false);
                return;
            }
            const versionMatch = stdout.match(/gpg \(GnuPG\) (1\.4|2)\./);
            resolve(!!versionMatch);
        });
    });
}

/**
 * Check if the given filename contains an encrypted file.
 * @param {string} filename - The path to the file.
 * @returns {boolean} True if the file is encrypted.
 */
function isEncryptedFile(filename) {
    const ext = path.extname(filename);
    if (ext === '.gpg') {
        return true;
    }
    if (ext === '.asc') {
        const head = fs.readFileSync(filename, { encoding: 'utf8', flag: 'r' }).slice(0, 1024);
        return /--BEGIN PGP MESSAGE--/.test(head);
    }
    return false;
}

/**
 * Decrypt and read an encrypted file without temporary storage.
 * @param {string} filename - The path to the encrypted file.
 * @returns {Promise<string>} The decrypted contents of the file.
 * @throws {Error} If the file cannot be decrypted.
 */
function readEncryptedFile(filename) {
    return new Promise((resolve, reject) => {
        const command = `gpg --batch --decrypt ${path.resolve(filename)}`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Could not decrypt file (${error.code}): ${stderr}`));
                return;
            }
            resolve(stdout);
        });
    });
}

module.exports = {
    isGpgInstalled,
    isEncryptedFile,
    readEncryptedFile
};
