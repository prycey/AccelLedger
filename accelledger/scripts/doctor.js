#!/usr/bin/env bun

import { Command } from "commander";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { loadFile } from "../loader.js";
import { parseFile } from "../parser/parser.js";
import { compareEntries } from "../core/compare.js";
import { renderFileContext } from "../parser/context.js";
import { getAccountsUseMap, getAccountOpenClose } from "../core/getters.js";
import { Open } from "../core/data.js";
import { newMetadata } from "../core/data.js";
import { printEntries } from "../parser/printer.js";

const program = new Command();

// Add these new functions:
function findLinkedEntries(entries, links, includeInactive = false) {
  return entries.filter((entry) => {
    if (entry.constructor.name !== "Transaction") return false;
    if (!entry.links) return false;
    return Array.from(links).some((link) => entry.links.has(link));
  });
}

function findTaggedEntries(entries, tag) {
  return entries.filter((entry) => {
    if (entry.constructor.name !== "Transaction") return false;
    if (!entry.tags) return false;
    return entry.tags.has(tag);
  });
}

function setupDoctorCommands(program) {
  program
    .command("lex")
    .description("Dump the lexer output for an AccelLedger syntax file")
    .argument("<filename>", "The AccelLedger file to analyze")
    .action((filename) => {
      const { lexIterator } = require("../parser/lexer.js");
      for (const { token, lineno, text } of lexIterator(filename)) {
        console.log(
          `${token || "(None)".padEnd(12)} ${lineno
            .toString()
            .padStart(6)} ${JSON.stringify(text)}`
        );
      }
    });

  program
    .command("parse")
    .description("Parse the ledger in debug mode")
    .argument("<filename>", "The AccelLedger file to parse")
    .action((filename) => {
      parseFile(filename, { debug: true });
    });

  program
    .command("roundtrip")
    .description("Round-trip test on arbitrary ledger")
    .argument("<filename>", "The AccelLedger file to test")
    .action(async (filename) => {
      try {
        console.log("Read the entries");
        const [entries, errors, optionsMap] = await loadFile(filename);
        console.log(errors);

        console.log("Print them out to a file");
        const basename = path.basename(filename, path.extname(filename));
        const round1Filename = `${basename}.roundtrip1${path.extname(
          filename
        )}`;
        fs.writeFileSync(round1Filename, printEntries(entries));

        console.log("Read the entries from that file");
        const [entriesRoundtrip, errorsRoundtrip] = await loadFile(
          round1Filename
        );

        if (errorsRoundtrip.length) {
          console.log(
            "----------------------------------------------------------------------"
          );
          console.log(errorsRoundtrip);
          console.log(
            "----------------------------------------------------------------------"
          );
        }

        console.log("Print what you read to yet another file");
        const round2Filename = `${basename}.roundtrip2${path.extname(
          filename
        )}`;
        fs.writeFileSync(round2Filename, printEntries(entriesRoundtrip));

        console.log("Compare the original entries with the re-read ones");
        const { same, missing1, missing2 } = compareEntries(
          entries,
          entriesRoundtrip
        );
        if (same) {
          console.log(chalk.green("Entries are the same. Congratulations."));
        } else {
          console.error(chalk.red("Entries differ!"));
          console.log("\n\nDifferences:");

          const entriesSet = new Set(entries.map((e) => JSON.stringify(e)));
          const entriesRoundtripSet = new Set(
            entriesRoundtrip.map((e) => JSON.stringify(e))
          );

          console.log("Missing from original:");
          for (const entry of entriesRoundtripSet) {
            if (!entriesSet.has(entry)) {
              console.log(JSON.parse(entry));
            }
          }

          console.log("\nMissing from re-read:");
          for (const entry of entriesSet) {
            if (!entriesRoundtripSet.has(entry)) {
              console.log(JSON.parse(entry));
            }
          }
        }
      } finally {
        // Clean up temporary files
        if (
          typeof round1Filename !== "undefined" ||
          typeof round2Filename !== "undefined"
        ) {
          [round1Filename, round2Filename].filter(Boolean).forEach((file) => {
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
            }
          });
        }
      }
    });

  program
    .command("context")
    .description("Describe transaction context")
    .argument("<filename>", "The AccelLedger file to analyze")
    .argument("<location>", "The location to describe (e.g., filename:lineno)")
    .action((filename, location) => {
      const [searchFilename, lineno] = location.split(":");
      const [entries, errors, optionsMap] = loadFile(filename);
      const context = renderFileContext(
        entries,
        optionsMap,
        searchFilename || filename,
        parseInt(lineno)
      );
      console.log(context);
    });

  program
    .command("linked")
    .description("List related transactions")
    .argument("<filename>", "The AccelLedger file to analyze")
    .argument(
      "<locationSpec>",
      "The location specification (e.g., ^link or #tag)"
    )
    .action((filename, locationSpec) => {
      const [entries, errors, optionsMap] = loadFile(filename);
      let linkedEntries;

      if (locationSpec.startsWith("^")) {
        const links = new Set([locationSpec.slice(1)]);
        linkedEntries = findLinkedEntries(entries, links, false);
      } else if (locationSpec.startsWith("#")) {
        const tag = locationSpec.slice(1);
        linkedEntries = findTaggedEntries(entries, tag);
      } else {
        // Handle line number or region specification
        // This part would need to be implemented based on your specific needs
      }

      renderMiniBalances(linkedEntries, optionsMap);
    });

  program
    .command("missing-open")
    .description("Print Open directives missing in the file")
    .argument("<filename>", "The AccelLedger file to analyze")
    .action((filename) => {
      const [entries, errors, optionsMap] = loadFile(filename);
      const [firstUseMap] = getAccountsUseMap(entries);
      const openCloseMap = getAccountOpenClose(entries);

      const newEntries = [];
      for (const [account, firstUseDate] of Object.entries(firstUseMap)) {
        if (!openCloseMap.has(account)) {
          newEntries.push(
            new Open(
              newMetadata(filename, 0),
              firstUseDate,
              account,
              null,
              null
            )
          );
        }
      }

      const { printEntries } = require("../printer.js");
      printEntries(newEntries.sort((a, b) => a.date - b.date));
    });
}

// Add these utility functions and the renderMiniBalances implementation:
function formatAmount(amount, commodities) {
  if (typeof amount === "number") {
    return amount.toFixed(2);
  }
  const commodity = commodities[amount.currency] || { precision: 2 };
  return `${amount.number.toFixed(commodity.precision)} ${amount.currency}`;
}

function renderMiniBalances(entries, optionsMap) {
  const balances = {};
  const commodities = optionsMap.commodities || {};

  entries.forEach((entry) => {
    console.log(
      chalk.cyan(`${entry.date.toISOString().split("T")[0]} ${entry.narration}`)
    );
    entry.postings.forEach((posting) => {
      const account = posting.account;
      if (!balances[account]) {
        balances[account] = {};
      }
      if (!balances[account][posting.units.currency]) {
        balances[account][posting.units.currency] = 0;
      }
      balances[account][posting.units.currency] += posting.units.number;

      console.log(
        chalk.yellow(
          `  ${account.padEnd(40)} ${formatAmount(posting.units, commodities)}`
        )
      );
    });
    console.log();
  });

  console.log(chalk.green("Final Balances:"));
  Object.entries(balances).forEach(([account, currencies]) => {
    console.log(chalk.blue(account));
    Object.entries(currencies).forEach(([currency, balance]) => {
      console.log(
        `  ${currency.padEnd(10)} ${formatAmount(
          { number: balance, currency },
          commodities
        )}`
      );
    });
  });
}

// Remove the main function and export setupDoctorCommands
export { setupDoctorCommands };
