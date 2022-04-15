#!/usr/bin/env node

import "dotenv/config";

import fetch from "node-fetch";
import { hideBin } from "yargs/helpers";
import yargs from "yargs";

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

function LOG(mode, verbose, message) {
  if (verbose) {
    console.log(`[${mode}] :: ${message}`);
  }
}

async function run(unpublishOlderThan, contentTypeFilter, environment, locale, mode, verbose) {
  let contentTypes = await getContentTypes();

  contentTypes = contentTypes.content_types.map((ct) => ct.uid);
  if (contentTypeFilter) {
    const ctArray = contentTypeFilter.split(",");
    contentTypes = contentTypes.filter((contentType) => ctArray.includes(contentType));
  }
  LOG(mode, verbose, `Content Types to Unpublish: ${contentTypes.toString()}`);

  for (let i = 0; i < contentTypes.length; i++) {
    let entryArray = await getEntries(contentTypes[i], environment, verbose);
    for (let j = 0; j < entryArray.entries.length; j++) {
      let createdDate = new Date(Date.parse(entryArray.entries[j].created_at));
      const thresholdDate = new Date(Date.parse(unpublishOlderThan));
      if (createdDate.getTime() < thresholdDate.getTime()) {
        unpublishEntry(contentTypes[i], entryArray.entries[j], locale, environment, mode, verbose);
      } else {
        LOG(
          verbose,
          `Skip [${locale}][${entryArray.entries[j].title}] [${entryArray.entries[j].uid}]. Content was created after : ${unpublishOlderThan}`
        );
      }
    }
  }
}

async function getContentTypes() {
  return new Promise(async (resolve, reject) => {
    await fetch("https://cdn.contentstack.io/v3/content_types", {
      method: "GET",
      headers: { api_key: process.env.REACT_API_KEY, access_token: process.env.REACT_DELIVERY_TOKEN },
    })
      .then((res) => res.json())
      .then((data) => resolve(data))
      .catch((error) => reject(error));
  });
}

async function getEntries(contentType, environment) {
  return new Promise(async (resolve, reject) => {
    await fetch("https://cdn.contentstack.io/v3/content_types/" + contentType + "/entries?environment=" + environment, {
      method: "GET",
      headers: { api_key: process.env.REACT_API_KEY, access_token: process.env.REACT_DELIVERY_TOKEN },
    })
      .then((response) => response.json())
      .then((data) => resolve(data))
      .catch((error) => {
        reject(error);
      });
  });
}

async function unpublishEntry(contentType, entry, locale, environment, mode, verbose) {
  const log = `Unpublish [${locale}][${entry.title}][${entry.uid}]. Content was created on: ${entry.created_at}`;
  if (mode && mode === "live") {
    return new Promise(async (resolve, reject) => {
      const unpublishBody = {
        entry: {
          environments: [environment],
          locales: [locale],
        },
        locale: locale,
      };
      LOG(mode, verbose, log);
      await fetch(
        "https://api.contentstack.io/v3/content_types/" + contentType + "/entries/" + entry.uid + "/unpublish",
        {
          method: "POST",
          headers: {
            api_key: process.env.REACT_API_KEY,
            authorization: process.env.REACT_MANAGEMENT_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(unpublishBody),
        }
      )
        .then((response) => response.json())
        .then((data) => {
          if (data.error_code && data.data_error_code === "429") {
            LOG(mode, verbose, `Rate limit exceeded. Waiting for 1 seconds.`);
            delay(1000)
              .then(() => {
                resolve(unpublishEntry(contentType, entry, locale, environment, mode));
              })
              .catch((error) => {
                LOG(mode, true, `${log} :: Error`, error);
                reject(error);
              });
            resolve({});
          } else {
            LOG(mode, verbose, `${log} :: Success`);
            resolve({});
          }
        })
        .catch((error) => {
          LOG(mode, true, `${log} :: Error`, error);
          reject(error);
        });
    });
  } else {
    LOG(mode, verbose, log);
  }
}

yargs(hideBin(process.argv))
  .command({
    command: "run",
    describe: "Unpublishes entries older than a specific date",
    builder: {
      unpublishOlderThan: {
        alias: "d",
        describe: "Threshold date to unpublish entries (YYYY-MM-DD [HH:mm:ss])",
        type: "string",
        demandOption: true,
      },
      contentTypeFilter: {
        alias: "f",
        describe: "Content type filter as a comma separated list of content types",
        type: "string",
        demandOption: false,
      },
      environment: {
        alias: "e",
        describe: "Environment to unpublish entries from",
        type: "string",
        demandOption: true,
      },
      locale: {
        alias: "l",
        describe: "Locale to unpublish entries from",
        type: "string",
        demandOption: true,
      },
      mode: {
        alias: "m",
        describe: "Mode to run the script in",
        type: "string",
        demandOption: false,
        choices: ["live", "dry-run"],
        default: "dry-run",
      },
      verbose: {
        alias: "v",
        describe: "Verbose mode",
        type: "boolean",
        demandOption: false,
        default: false,
      },
    },
    handler: (argv) => {
      // console.log("ARGS", argv);
      run(argv.unpublishOlderThan, argv.contentTypeFilter, argv.environment, argv.locale, argv.mode, argv.verbose);
    },
  })
  .demandCommand(1, "You need at least one command before moving on")
  .demandOption(["unpublishOlderThan", "environment", "locale"])
  .help().argv;
