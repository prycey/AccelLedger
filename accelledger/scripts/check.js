#!/usr/bin/env bun

import { program } from "commander";
import chalk from "chalk";
import { loadFile } from "../loader.js";
import { logTime } from "../utils/misc_utils.js";
import { validate } from "../ops/validation.js";

program
  .argument("<filename>", "Accelledger input file to process")
  .option("-v, --verbose", "Print timings")
  .option("-C, --no-cache", "Disable the cache")
  .option("--cache-filename <path>", "Override the cache filename")
  .option("-a, --auto", "Implicitly enable auto-plugins")
  .parse();

const options = program.opts();
const filename = program.args[0];

async function main() {
  const useCache = !options.noCache;

  try {
    if (options.verbose) {
      console.log = (...args) => console.info(chalk.blue("INFO:"), ...args);
    }

    if (!useCache || options.cacheFilename) {
      loadFile.initialize(useCache, options.cacheFilename);
    }

    const logTimings = options.verbose ? console.log : null;

    await logTime("accelledger.loader (total)", logTimings, async () => {
      const [entries, errors, optionsMap] = await loadFile(
        filename,
        logTimings,
        console.error
      );

      if (errors.length > 0) {
        console.error(chalk.red(`Found ${errors.length} loading errors:`));
        errors.forEach((error) => {
          console.error(chalk.yellow(`${error.source}: ${error.message}`));
        });
      }

      const validationErrors = validate(entries, optionsMap, logTimings);

      if (validationErrors.length > 0) {
        console.error(
          chalk.red(`Found ${validationErrors.length} validation errors:`)
        );
        validationErrors.forEach((error) => {
          console.error(chalk.yellow(`${error.source}: ${error.message}`));
        });
      }

      if (errors.length > 0 || validationErrors.length > 0) {
        process.exit(1);
      } else {
        console.log(chalk.green("No errors found."));
        process.exit(0);
      }
    });
  } catch (error) {
    console.error(chalk.red("An unexpected error occurred:"), error);
    process.exit(1);
  } finally {
    if (options.auto) {
      loadFile.PLUGINS_AUTO = oldPluginsAuto;
    }
  }
}

if (require.main === module) {
  main();
}

export { main };
