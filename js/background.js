/*jslint white: true, undef: true, newcap: true, nomen: true, regexp: true, plusplus: true, bitwise: true, browser: true, devel: true, maxerr: 50, maxlen: 0, indent: 4 */
/*global chrome: false */

// used to allow the popup to access the url of the current page's HN comments
var ITEM_CACHE = {};

// holds content scraped directly from HN to fill in where search.yc falls down.
// contains URLs mapped to item id integers.
var URL_CACHE = {};

// the id of the currently selected tab.  allows the popup to grab the
// appropriate item id from the global item cache.
var CURRENT_TAB_ID = -1;

// scrapes content directly from HN to fill in for lag in searchYC database.
// updates the global object that holds the URLs in-place.
var scrapeAndUpdate = function (subdomain, numPages) {
    // bottom out when we've hit our page quota
    if (numPages <= 0) {
        return;
    }

    // TODO: don't scrape if the cache is really large, log that fact

    // the base URL for Hacker News, which we append the given subdomain to
    var hnBaseURL = "http://news.ycombinator.com";

    // download the requested page syncronously
    var req = new XMLHttpRequest();
    req.open("GET", hnBaseURL + subdomain, false);
    req.send(null);

    console.log("Scraping URL '" + hnBaseURL + subdomain + "'");

    // exit if we couldn't access the page
    if (req.status !== 200) {
        console.error("Failed to access '" + hnBaseURL + subdomain + "': " +
                req.status + ", " + req.statusText);
        return;
    }

    // render the HTML to a DOM element so we can navigate the heirarchy
    var hnPage = document.createElement("div");
    hnPage.innerHTML = req.responseText;

    // find all the item titles
    var tds = hnPage.getElementsByTagName("td");

    console.log("Searching " + tds.length + " td elements for matching titles");

    var titles = [];
    for (var i = 0; i < tds.length; i++) {
        var td = tds[i];

        // match titles with only 'class' attributes, nothing else
        var c = td.attributes.getNamedItem("class");
        if (c != null && c.value == "title" && td.attributes.length == 1) {
            titles.push(td);
        }
    }

    console.log("Found " + titles.length + " title items");

    // make sure we matched the expected number of total titles
    var expectedItems = 31;
    if (titles.length != expectedItems) {
        console.warning("Found " + titles.length + " items, expecting " +
                expectedItems);
    }

    // remove and save the final title, the only 'More' link
    var more = titles.pop();

    // we'll use this regex to ignore items that link directly to HN comments
    var hnItemPattern = "item[?]id=[0-9]+";
    var hnItemRegex = new RegExp(hnItemPattern);

    // add all the title and their matching subtexts to the global item cache
    var addedCount = 0;
    for (var i = 0; i < titles.length; i++) {
        var title = titles[i];

        // get the first link's URL, the first child of the title td
        var a = title.firstChild;
        var itemURL = a.attributes.getNamedItem("href").value;

        // skip items that link to HN itself
        if (hnItemRegex.test(itemURL)) {
            continue;
        }

        // get the item id, a part of the score id for subtext tds
        var subtext = title.parentNode.nextSibling.childNodes[1];
        var spanId = subtext.firstChild.attributes.getNamedItem("id").value;

        // makes 'score_000000' into '000000' and parses the number
        var itemNum = parseInt(spanId.replace("score_", ""));

        // add the parsed item to the URL cache if it's not already there
        if (URL_CACHE[itemURL] == null) {
            URL_CACHE[itemURL] = itemNum;
            addedCount += 1;
        }
    }

    console.log("Added " + addedCount + " new items to the cache");

    // continue onward to download the next page, decrementing the page counter
    var moreLink = more.firstChild.attributes.getNamedItem("href").value;
    scrapeAndUpdate(moreLink, numPages - 1);
}

// scrapes HN, updating the URL cache
var scrapeHandler = function (numNewsPages, numNewestPages) {
    console.log("Scraping " + numNewsPages + " 'news' pages");
    scrapeAndUpdate("/news", numNewsPages);

    console.log("Scraping " + numNewestPages + " 'newest' pages");
    scrapeAndUpdate("/newest", numNewestPages);

    // count and enumerate URLs in cache
    var cacheSize = 0;
    for (var url in URL_CACHE) {
        if (URL_CACHE.hasOwnProperty(url)) {
            cacheSize += 1;
        }
    }

    console.log("URL cache has " + cacheSize + " items");
}

// searches the URL cache, then searchyc.com's archive for the current tab's
// URL, then stores its id into a global variable accessible from the popup.
var searchYC = function (tabId, changeInfo, tab) {
    // don't run when tab isn't loading. keeps from running twice when
    // 'loading' as well as when 'complete'.  we run when 'loading' since it
    // shows the icon almost immediately rather than having to wait for the page
    // to load first.
    if (changeInfo.status != "loading") {
        return;
    }

    // used later to set global id and icon visibility
    var newItemId = -1;

    // check the cache for the URL before hitting searchYC
    if (URL_CACHE[tab.url] != null) {
        newItemId = URL_CACHE[tab.url];
        console.log("Found '" + tab.url + "' in cache, item id " + newItemId);
    }

    // ask the remote server for the URL
    else {
        // the URL used to access searchyc.com's API
        var searchURL = "http://json.searchyc.com/domains/find?url=";

        console.log("URL not in cache, requesting data for '" + tab.url + "'");

        // issue a synchronous request for the page data
        var req = new XMLHttpRequest();
        req.open("GET", searchURL + escape(tab.url), false);
        req.send(null);

        // exit if we couldn't access the searchYC server
        if (req.status != 200) {
            console.error("Could not access searchYC: " +
                    req.status + ", " + req.statusText);
            return;
        }

        // parse results
        var results = JSON.parse(req.responseText);
        console.log("Parsed response JSON, got " + results.length + " results");

        // only show the page action icon if there were any results
        if (results.length > 0) {
            // get the last result, as it's the most recent (and relevant?)
            item = results[results.length - 1];

            // set the local item id variable
            newItemId = item["id"];

            // add the new URL to the global cache
            console.log("Adding searchYC response data to global URL cache");
            URL_CACHE[tab.url] = newItemId;
        }
    }

    // show the page action if the local item id was set
    if (newItemId > -1) {
        // cache the global item id so the popup can access it
        console.log("Caching item id " + newItemId + " for tab id " + tab.id);
        ITEM_CACHE[tab.id] = newItemId;

        console.log("Showing page action icon");
        chrome.pageAction.show(tabId);
    }
    // hide the action icon otherwise
    else {
        console.log("Hiding page action icon");
        chrome.pageAction.hide(tabId);
    }
}

// updates the global current tab id so the popup can access the appropriate
// item cache entry.
var updateCurrentTabId = function (tabId, selectInfo) {
    console.log("Setting global current tab id to " + tabId);
    CURRENT_TAB_ID = tabId;
}

// listen for changes to any tab so we can check for HN content for its URL
console.log("Setting tab update event listener");
chrome.tabs.onUpdated.addListener(searchYC);

// listen tor tab selection changes so we can update the current global tab id
console.log("Setting tab selection change event listener");
chrome.tabs.onSelectionChanged.addListener(updateCurrentTabId);

// scrape for content periodically
var scrapeInterval = 180000; // 3 minutes
console.log("Setting scrape interval to " + scrapeInterval + " ms");
setInterval("scrapeHandler(" + 1 + ", " + 2 + ")", scrapeInterval);

// do an initial scrape, deeper than the periodic one
console.log("Doing initial content scrape");
scrapeHandler(5, 10);
