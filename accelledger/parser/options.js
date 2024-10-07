import { Decimal } from 'decimal.js';
import * as data from '../core/data.js';
import * as account_types from '../core/account_types.js';
import * as account from '../core/account.js';


const DEFAULT_ACCOUNT_TYPES = account_types.DEFAULT_ACCOUNT_TYPES;

// Helper functions
function optionsValidateProcessingMode(value) {
    if (value !== "raw" && value !== "default") {
        throw new Error(`Invalid value '${value}'`);
    }
    return value;
}

function optionsValidatePlugin(value) {
    const match = value.match(/(.*):(.*)/)
    if (match) {
        const [, pluginName, pluginConfig] = match;
        return [pluginName, pluginConfig];
    }
    return [value, null];
}

function optionsValidateTolerance(value) {
    return new Decimal(value);
}

function optionsValidateToleranceMap(value) {
    const match = value.match(/(.*):(.*)/)
    if (!match) {
        throw new Error(`Invalid value '${value}'`);
    }
    const [, currency, toleranceStr] = match;
    return [currency, new Decimal(toleranceStr)];
}

function optionsValidateBoolean(value) {
    return ["1", "true", "yes"].includes(value.toLowerCase());
}

function optionsValidateBookingMethod(value) {
    if (Object.prototype.hasOwnProperty.call(data.Booking, value)) {
        return data.Booking[value];
    }
    throw new Error(`Invalid booking method: ${value}`);
}

// Option descriptor
class OptDesc {
    constructor(name, defaultValue, exampleValue = undefined, converter = null, deprecated = false, alias = null) {
        this.name = name;
        this.defaultValue = defaultValue;
        this.exampleValue = exampleValue !== undefined ? exampleValue : defaultValue;
        this.converter = converter;
        this.deprecated = deprecated;
        this.alias = alias;
    }
}

// Option groups
const OUTPUT_OPTION_GROUPS = [
    {
        description: `
      The name of the top-level Accelledger input file parsed from which the
      contents of the ledger have been extracted. This may be null, if no file
      was used.
    `,
        options: [new OptDesc("filename", null)]
    },
    {
        description: `
      A list of other filenames to include. This is output from the parser and
      processed by the loader but the list should otherwise have been cleared by the
      time it gets to the top-level loader.load_*() function that invoked it.
      The filenames are absolute. Relative include filenames are resolved against
      the file that contains the include directives.

      This is used in the parser, but also, the loader sets this list to the
      full list of parsed absolute filenames in the options map. This is how you
      can find out the entire list of files involved in an Accelledger load
      procedure.
    `,
        options: [new OptDesc("include", [], "some-other-file.accelledger")]
    },
    // ... (other output option groups)
];

const PUBLIC_OPTION_GROUPS = [
    {
        description: `
      The title of this ledger / input file. This shows up at the top of every
      page.
    `,
        options: [new OptDesc("title", "Accelledger", "Joe Smith's Personal Ledger")]
    },
    {
        description: `
      Root names of every account. This can be used to customize your category
      names, so that if you prefer "Revenue" over "Income" or "Capital" over
      "Equity", you can set them here. The account names in your input files
      must match, and the parser will validate these. You should place these
      options at the beginning of your file, because they affect how the parser
      recognizes account names.
    `,
        options: [
            new OptDesc("name_assets", DEFAULT_ACCOUNT_TYPES.assets),
            new OptDesc("name_liabilities", DEFAULT_ACCOUNT_TYPES.liabilities),
            new OptDesc("name_equity", DEFAULT_ACCOUNT_TYPES.equity),
            new OptDesc("name_income", DEFAULT_ACCOUNT_TYPES.income),
            new OptDesc("name_expenses", DEFAULT_ACCOUNT_TYPES.expenses),
        ]
    },
    // ... (other public option groups)
];

const OPTION_GROUPS = [...OUTPUT_OPTION_GROUPS, ...PUBLIC_OPTION_GROUPS];

// A map of option names to their descriptors
const OPTIONS = Object.fromEntries(
    OPTION_GROUPS.flatMap(group => group.options.map(desc => [desc.name, desc]))
);

// A map of option names to their default values
const OPTIONS_DEFAULTS = Object.fromEntries(
    OPTION_GROUPS.flatMap(group => group.options.map(desc => [desc.name, desc.defaultValue]))
);

// A set of options that cannot be modified
const READ_ONLY_OPTIONS = new Set(["filename", "plugin"]);

function getAccountTypes(options) {
    return new account_types.AccountTypes(
        options.name_assets,
        options.name_liabilities,
        options.name_equity,
        options.name_income,
        options.name_expenses
    );
}

function getPreviousAccounts(options) {
    const equity = options.name_equity;
    const accountPreviousEarnings = account.join(equity, options.account_previous_earnings);
    const accountPreviousBalances = account.join(equity, options.account_previous_balances);
    const accountPreviousConversions = account.join(equity, options.account_previous_conversions);
    return [accountPreviousEarnings, accountPreviousBalances, accountPreviousConversions];
}

function getCurrentAccounts(options) {
    const equity = options.name_equity;
    const accountCurrentEarnings = account.join(equity, options.account_current_earnings);
    const accountCurrentConversions = account.join(equity, options.account_current_conversions);
    return [accountCurrentEarnings, accountCurrentConversions];
}

function getUnrealizedAccount(options) {
    const income = options.name_income;
    return account.join(income, options.account_unrealized_gains);
}

function listOptions() {
    let output = '';
    for (const group of PUBLIC_OPTION_GROUPS) {
        for (const desc of group.options) {
            output += `option "${desc.name}" "${desc.exampleValue}"\n`;
            if (desc.deprecated) {
                output += `  THIS OPTION IS DEPRECATED: ${desc.deprecated}\n\n`;
            }
        }
        const description = group.description.replace(/\s+/g, ' ').trim();
        output += description.replace(/(.{1,80})/g, '$1\n');
        output += '\n\n';
    }
    return output;
}

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
    listOptions,
    optionsValidateProcessingMode,
    optionsValidatePlugin,
    optionsValidateTolerance,
    optionsValidateToleranceMap,
    optionsValidateBoolean,
    optionsValidateBookingMethod
};
