#!/usr/bin/env bun

import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { addTransaction, getBalance } from "./ledger.js";
import { main as checkMain } from "./accelledger/scripts/check.js";
import { setupDoctorCommands } from "./accelledger/scripts/doctor.js";

const program = new Command();

program
  .version("1.0.0")
  .description("AccelLedger - An open source ledger built for accounting");

program
  .command("add-transaction")
  .description("Add a new transaction to the ledger")
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "date",
        message: "Enter the transaction date (YYYY-MM-DD):",
      },
      {
        type: "input",
        name: "description",
        message: "Enter a description for the transaction:",
      },
      {
        type: "number",
        name: "amount",
        message: "Enter the transaction amount:",
      },
      {
        type: "list",
        name: "type",
        message: "Select the transaction type:",
        choices: ["Income", "Expense"],
      },
    ]);

    addTransaction(answers);
    console.log(chalk.green("Transaction added successfully:"));
    console.log(chalk.cyan(JSON.stringify(answers, null, 2)));
  });

program
  .command("view-balance")
  .description("View the current balance")
  .action(() => {
    const balance = getBalance();
    console.log(
      chalk.blue(`Current balance: ${chalk.bold("$" + balance.toFixed(2))}`)
    );
  });

program
  .command("check <filename>")
  .description("Check an Accelledger input file for errors")
  .option("-v, --verbose", "Print timings")
  .option("-C, --no-cache", "Disable the cache")
  .option("--cache-filename <path>", "Override the cache filename")
  .option("-a, --auto", "Implicitly enable auto-plugins")
  .action(async (filename, options) => {
    try {
      await checkMain(filename, options);
    } catch (error) {
      console.error(
        chalk.red("An error occurred while checking the file:"),
        error
      );
      process.exit(1);
    }
  });

const doctorCommand = program
  .command("doctor")
  .description("Run diagnostic tools on an AccelLedger file");

setupDoctorCommands(doctorCommand);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
