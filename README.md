# unpublish-old-entries

## Using `unpublish.js`

First you need to change `.example.env` to `.env` and fill in the file.

```bash
node unpublish.js --help

unpublish.js [command]

Commands:
  unpublish.js run  Unpublishes entries older than a specific date

Options:
      --version             Show version number [boolean]
  -d, --unpublishOlderThan  Threshold date to unpublish entries (YYYY-MM-DD [HH:mm:ss]) [string] [required]
  -f, --contentTypeFilter   Content type filter as a comma separated list of content types [string]
  -e, --environment         Environment to unpublish entries from [string] [required]
  -l, --locale              Locale to unpublish entries from [string] [required]
  -m, --mode                Mode to run the script in [string] [choices: "live", "dry-run"] [default: "dry-run"]
  -w, --limitWait           Milliseconds to wait for next publish attempt if API
                             rate limit is reached  [number] [default: 100]
  -v, --verbose             Verbose mode [boolean] [default: false]
      --help                Show help [boolean]
```

### Examples:

```bash
# Using dry-rum mode logs entries older than 2022-02-16 15:32:07 that will be unpublished from production environment for en-us locale for article and home content types, when running in live mode.
node unpbulish.js run -d "2022-02-16 15:32:07" -e production -l en-us -f article,home -m dry-run  --v

# Unpublishes entries older than 2022-02-16 that will be unpublished from production environment for en-us locale for article and home content types.
node unpublish.js run -d "2022-02-16" -e production -l en-us -m live

# With a retry wait time of 1 second:
node unpublish.js run -d "2022-02-16" -e production -l en-us -m live -w 1000
```

## Using index.js

**1. Change `.example.env` to `.env` and fill in `.env` file**

**2. Install Packages using `npm install`**

**3. Run using `node index.js`**
