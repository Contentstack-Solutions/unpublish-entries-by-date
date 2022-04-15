import fetch from 'node-fetch';
import 'dotenv/config'

async function run() {
    let contentTypes = await getContentTypes();
    for (let i = 0; i < contentTypes.content_types.length; i++) {
        let contentType = contentTypes.content_types[i].uid;
        let entryArray = await getEntries(contentType);
        for (let j = 0; j < entryArray.entries.length; j++) {
            let createdDate = new Date(Date.parse(entryArray.entries[j].created_at));
            let todaysDate = new Date();
            if ((todaysDate - createdDate) / (1000 * 3600 * 24 * 365) >= 2) {
                console.log("Content is older than 2 years | Title: " + entryArray.entries[j].title + " | UID: " + entryArray.entries[j].uid);
                //unpublishEntry(contentType, entryArray.entries[j]);
            }
            else {
                console.log("Content is less than 2 years old | Title: " + entryArray.entries[j].title + " | UID: " + entryArray.entries[j].uid);
            }
        }
    }
}

async function getContentTypes() {
    return new Promise(async (resolve, reject) => {
        await fetch("https://cdn.contentstack.io/v3/content_types", {
            method: 'GET',
            headers: { "api_key": process.env.REACT_API_KEY, "access_token": process.env.REACT_DELIVERY_TOKEN }
        })
            .then(res => res.json())
            .then(data => resolve(data))
            .catch(error => reject(error))
    })
}

async function getEntries(contentType) {
    return new Promise(async (resolve, reject) => {
        await fetch("https://cdn.contentstack.io/v3/content_types/" + contentType + "/entries?environment=production", {
            method: 'GET',
            headers: { "api_key": process.env.REACT_API_KEY, "access_token": process.env.REACT_DELIVERY_TOKEN }
        })
            .then(response => response.json())
            .then(data => resolve(data))
            .catch((error) => {
                reject(error);
            })
    })
}

async function unpublishEntry(contentType, entry) {
    return new Promise(async (resolve, reject) => {
        await fetch("https://api.contentstack.io/v3/content_types/+" + contentType + "/entries/" + entry.uid + "/unpublish", {
            method: 'POST',
            headers: { "api_key": process.env.REACT_API_KEY, "authorization": process.env.REACT_MANAGEMENT_TOKEN }
        })
            .then(response => response.json())
            .then((data) => {
                console.log(data);
                resolve();
            })
            .catch((error) => reject(error))
    })
}

run();