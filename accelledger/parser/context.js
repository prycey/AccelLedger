const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const path = require('path');
const { parseFile } = require('./parser.js');
const { hash } = require('../core/compare.js');
const { getEntryAccounts } = require('../core/getters.js');
const { computeEntryContext } = require('../core/interpolate.js');
const { printEntry } = require('./printer.js');
const { Inventory } = require('../core/inventory.js');
const { getCost } = require('../core/convert.js');

class Context {
    constructor() {
        this.entries = [];
        this.options = {};
        this.errors = [];
    }

    addEntry(entry) {
        if (!entry.meta) {
            entry.meta = {};
        }
        if (!entry.meta.uuid) {
            entry.meta.uuid = uuidv4();
        }
        if (!entry.date) {
            entry.date = moment().format('YYYY-MM-DD');
        }
        this.entries.push(entry);
    }

    getEntries() {
        return this.entries;
    }

    setOption(key, value) {
        this.options[key] = value;
    }

    getOption(key) {
        return this.options[key];
    }

    addError(message, entry = null) {
        this.errors.push({ message, entry });
    }

    getErrors() {
        return this.errors;
    }

    clear() {
        this.entries = [];
        this.errors = [];
    }
}

function renderFileContext(entries, optionsMap, filename, lineno) {
    // Find the closest entry
    const closestEntry = findClosestEntry(entries, filename, lineno);
    if (!closestEntry) {
        throw new Error(`No entry could be found before ${filename}:${lineno}`);
    }

    // Parse the original file to get the unbooked transaction
    let closestParsedEntry = null;
    if (path.existsSync(filename)) {
        const [parsedEntries] = parseFile(filename);
        closestParsedEntry = parsedEntries.find(entry => 
            entry.meta && entry.meta.lineno === closestEntry.meta.lineno
        );
    }

    return renderEntryContext(entries, optionsMap, closestEntry, closestParsedEntry);
}

function renderEntryContext(entries, optionsMap, entry, parsedEntry = null) {
    let output = '';
    const print = (str = '') => output += str + '\n';

    print(`** Transaction Id --------------------------------`);
    print();
    print(`Hash: ${hash(entry)}`);
    print(`Location: ${entry.meta.filename}:${entry.meta.lineno}`);
    print();
    print();

    // Get sorted list of accounts
    const accounts = getSortedAccounts(parsedEntry || entry);

    // Compute balances before and after the entry
    const [balanceBefore, balanceAfter] = computeEntryContext(entries, entry, accounts);

    // Print balances before
    print(`** Balances before transaction --------------------------------`);
    print();
    const beforeHashes = new Set();
    const averageCosts = {};
    printBalances(balanceBefore, accounts, beforeHashes, averageCosts, print);

    // Print average costs
    if (Object.keys(averageCosts).length > 0) {
        print(`** Average Costs --------------------------------`);
        print();
        printAverageCosts(averageCosts, print);
    }

    // Print the unbooked transaction
    print(`** Unbooked Transaction --------------------------------`);
    print();
    if (parsedEntry) {
        printEntry(parsedEntry, optionsMap.dcontext, { renderWeights: true }, print);
    }
    print();

    // Print the booked transaction
    print(`** Transaction --------------------------------`);
    print();
    printEntry(entry, optionsMap.dcontext, { renderWeights: true }, print);
    print();

    // Print residual and tolerances for transactions
    if (entry.type === 'Transaction') {
        print(`** Residual and Tolerances --------------------------------`);
        print();
        printResidualAndTolerances(entry, optionsMap, print);
    }

    // Print balances after
    print(`** Balances after transaction --------------------------------`);
    print();
    printBalances(balanceAfter, accounts, beforeHashes, {}, print);

    return output;
}

// Helper functions

function findClosestEntry(entries, filename, lineno) {
    return entries.reduce((closest, entry) => {
        if (entry.meta && entry.meta.filename === filename && 
            entry.meta.lineno <= lineno && 
            (!closest || entry.meta.lineno > closest.meta.lineno)) {
            return entry;
        }
        return closest;
    }, null);
}

function getSortedAccounts(entry) {
    const accounts = getEntryAccounts(entry);
    const order = {};
    if (entry.type === 'Transaction') {
        entry.postings.forEach((posting, index) => {
            order[posting.account] = index;
        });
    }
    return accounts.sort((a, b) => (order[a] || 1000) - (order[b] || 1000));
}

function printBalances(balances, accounts, beforeHashes, averageCosts, print) {
    const maxAccountWidth = Math.max(...accounts.map(a => a.length));
    const positionLine = (changed, account, position) => 
        `${changed ? '*' : ' '} ${account.padEnd(maxAccountWidth)}  ${position}`;

    accounts.forEach(account => {
        const balance = balances[account];
        const positions = balance.getPositions();

        if (balance.getCurrencies().length > 1) {
            averageCosts[account] = balance.average();
        }

        positions.forEach(position => {
            beforeHashes.add(`${account},${position.toString()}`);
            print(positionLine('', account, position.toString()));
        });

        if (positions.length === 0) {
            print(positionLine('', account, ''));
        }
        print();
    });
}

function printAverageCosts(averageCosts, print) {
    Object.entries(averageCosts).sort().forEach(([account, avgCost]) => {
        avgCost.forEach(position => {
            print(`  ${account.padEnd(maxAccountWidth)}  ${position.toString()}`);
        });
    });
    print();
    print();
}

function printResidualAndTolerances(entry, optionsMap, print) {
    const residual = computeResidual(entry.postings);
    if (!residual.isEmpty()) {
        print(`Residual: ${residual.toString()}`);
    }

    const tolerances = inferTolerances(entry.postings, optionsMap);
    if (Object.keys(tolerances).length > 0) {
        print(`Tolerances: ${Object.entries(tolerances).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }

    const costBasis = new Inventory(entry.postings.filter(p => p.cost !== null)).reduce(getCost);
    if (!costBasis.isEmpty()) {
        print(`Basis: ${costBasis.toString()}`);
    }
    print();
    print();
}

module.exports = {
    Context,
    renderFileContext,
    renderEntryContext
};