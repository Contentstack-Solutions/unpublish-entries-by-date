#!/usr/bin/env node

import "dotenv/config";

import fetch from "node-fetch";
import { hideBin } from "yargs/helpers";
import yargs from "yargs";

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

function LOG(options, message) {
  if (options.verbose) {
    console.log(`[${options.mode}] :: ${message}`);
  }
}

async function run(options) {
  let contentTypes = await getContentTypes();

  contentTypes = contentTypes.content_types.map((ct) => ct.uid);
  if (options.contentTypeFilter) {
    const ctArray = options.contentTypeFilter.split(",");
    contentTypes = contentTypes.filter((contentType) => ctArray.includes(contentType));
  }
  LOG(options, `Content Types to Unpublish: ${contentTypes.toString()}`);

  for (let i = 0; i < contentTypes.length; i++) {
    let entryArray = await getEntries(contentTypes[i], options);
    for (let j = 0; j < entryArray.entries.length; j++) {
      let createdDate = new Date(Date.parse(entryArray.entries[j].created_at));

      if (createdDate.getTime() < options.date.getTime()) {
        unpublishEntry(contentTypes[i], entryArray.entries[j], options);
      } else {
        LOG(
          options,
          `Skip [${options.locale}][${entryArray.entries[j].title}] [${entryArray.entries[j].uid}]. Content was created after : ${options.unpublishOlderThan}`
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

async function getEntries(contentType, options) {
  return new Promise(async (resolve, reject) => {
    await fetch(
      `https://cdn.contentstack.io/v3/content_types/${contentType}/entries?environment=${options.environment}&query={ "created_at": { "$lt": "${options.utcString}" } }`,
      {
        method: "GET",
        headers: { api_key: process.env.REACT_API_KEY, access_token: process.env.REACT_DELIVERY_TOKEN },
      }
    )
      .then((response) => response.json())
      .then((data) => resolve(data))
      .catch((error) => {
        reject(error);
      });
  });
}

async function unpublishEntry(contentType, entry, options) {
  const log = `Unpublish [${options.locale}][${entry.title}][${entry.uid}]. Content was created on: ${entry.created_at}`;
  if (options.mode && options.mode === "live") {
    return new Promise(async (resolve, reject) => {
      const unpublishBody = {
        entry: {
          environments: [options.environment],
          locales: [options.locale],
        },
        locale: options.locale,
      };
      LOG(options, log);
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
            LOG({ ...options, verbose: true }, `Rate limit exceeded. Waiting for 1 seconds.`);
            delay(options.limitWait)
              .then(() => {
                resolve(unpublishEntry(contentType, entry, options));
              })
              .catch((error) => {
                LOG({ ...options, verbose: true }, `${log} :: Error`, error);
                reject(error);
              });
            resolve({});
          } else {
            LOG(options, `${log} :: Success`);
            resolve({});
          }
        })
        .catch((error) => {
          LOG({ ...options, verbose: true }, `${log} :: Error`, error);
          reject(error);
        });
    });
  } else {
    LOG(options, log);
  }
}

yargs(hideBin(process.argv))
  .command({
    command: "run",
    describe: "Unpublishes entries older than a specific date",
    handler: (argv) => {
      // console.log("ARGS", argv);
      const d = new Date(argv.unpublishOlderThan);

      const options = {
        date: d,
        isoString: d.toISOString(),
        utcString: d.toUTCString(),
        unpublishOlderThan: argv.unpublishOlderThan,
        contentTypeFilter: argv.contentTypeFilter,
        environment: argv.environment,
        locale: argv.locale,
        mode: argv.mode,
        verbose: argv.verbose,
        wait: argv.limitWait,
      };
      if (argv.verbose) {
        console.log(`Running <${argv.$0}> with options:`, options);
      }
      run(options);
    },
  })
  .option("unpublishOlderThan", {
    alias: "d",
    describe: "Threshold date to unpublish entries (YYYY-MM-DD [HH:mm:ss])",
    type: "string",
    demandOption: true,
  })
  .option("contentTypeFilter", {
    alias: "f",
    describe: "Content type filter as a comma separated list of content types",
    type: "string",
    demandOption: false,
  })
  .option("environment", {
    alias: "e",
    describe: "Environment to unpublish entries from",
    type: "string",
    demandOption: true,
  })
  .option("locale", {
    alias: "l",
    describe: "Locale to unpublish entries from",
    type: "string",
    demandOption: true,
  })
  .option("mode", {
    alias: "m",
    describe: "Mode to run the script in",
    type: "string",
    demandOption: false,
    choices: ["live", "dry-run"],
    default: "dry-run",
  })
  .option("limitWait", {
    alias: "w",
    describe: "Milliseconds to wait for next publish attempt if API rate limit is reached",
    type: "number",
    demandOption: false,
    default: 100,
  })
  .option("verbose", {
    alias: "v",
    describe: "Verbose mode",
    type: "boolean",
    demandOption: false,
    default: false,
  })

  .example(
    `$0 run -d "2022-02-16 15:32:07" -e production -l en-us -f article,home -m dry-run  --v`,
    "Using dry-rum mode logs entries older than 2022-02-16 15:32:07 that will be unpublished from production environment for en-us locale for article and home content types, when running in live mode."
  )
  .example(
    `$0 run -d "2022-02-16" -e production -l en-us -m live`,
    "Unpublishes entries older than 2022-02-16 that will be unpublished from production environment for en-us locale for article and home content types."
  )
  //node unpublish.js run -d "2022-02-16 15:32:07" -e production -l en-us -f article,home -m dry-run  --v
  .help().argv;
