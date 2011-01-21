// used to allow the popup to access the url of the current page's HN comments
var ITEM_CACHE = new Object();

// the id of the currently selected tab.  allows the popup to grab the
// appropriate item id from the global item cache.
var CURRENT_TAB_ID = -1;

// holds content scraped directly from HN to fill in where search.yc falls down.
// contains URLs mapped to item id integers.
var URL_CACHE = new Object();

// scrapes the HN 'newest' page, updating the URL cache
function scrapeHandler(numNewsPages, numNewestPages) {
    console.log("Scraping " + numNewsPages + " 'news' pages");
    scrapeAndUpdate("news", numNewsPages);

    console.log("Scraping " + numNewestPages + " 'newest' pages");
    scrapeAndUpdate("newest", numNewestPages);

    // count and enumerate URLs in cache
    var cacheSize = 0;
    for (var url in URL_CACHE) {
        if (URL_CACHE.hasOwnProperty(url)) {
            cacheSize += 1;
        }
    }

    console.log("URL cache has " + cacheSize + " items");
}

// scrapes content directly from HN to fill in for lag in searchYC database.
// updates the global object that holds the URLs in-place.
function scrapeAndUpdate(subdomain, numPages) {
    // bottom out when we've hit our page quota
    if (numPages <= 0) {
        return;
    }

    // TODO: don't scrape if the cache is really large, log that fact

    // the base URL for Hacker News, which we append the given subdomain to
    var hnBaseURL = "http://news.ycombinator.com/";

    // download the requested page syncronously
    var req = new XMLHttpRequest();
    req.open("GET", hnBaseURL + subdomain, false);
    req.send(null);

    console.log("Scraping URL '" + hnBaseURL + subdomain + "'");

    // exit if we couldn't access the page
    if (req.status != 200) {
        console.error("Failed to access '" + hnBaseURL + subdomain + "': " +
                req.status + ", " + req.statusText);
        return;
    }
    else {
        console.log("Got news.ycombinator.com response");
    }

    //  matches urls and their respective item ids
    var itemPattern = '<td class="title"><a href="(.+?)"(?: rel="nofollow")?>.+?';
    itemPattern += '<td class="subtext"><span id=score_([0-9]+)>';
    itemRegex = new RegExp(itemPattern, "g");

    // matches the 'More' link to the next page of results
    var morePattern = '<a href="/(x[?]fnid=.+?)" rel="nofollow">More</a></td></tr>';
    moreRegex = new RegExp(morePattern);

    // matches items that refer directly to HN threads (we'll ignore these)
    var hnItemPattern = 'item[?]id=[0-9]+';
    var hnItemRegex = new RegExp(hnItemPattern);

    // iterate over all the matched items in this page's HTML
    var hnPage = req.responseText;
    var match = itemRegex.exec(hnPage);

    // ensure we're working against a correct match
    while (match != null && match.length == 3) {
        // get the useful parts of each matched item
        var itemURL = match[1];
        var itemId = match[2];

        // only add items that don't refer to Hacker News threads
        if (!hnItemRegex.test(itemURL)) {
            // add or update the url/id relationship to the cache
            URL_CACHE[itemURL] = parseInt(itemId);
        }

        // advance the match over the page HTML
        match = itemRegex.exec(hnPage);
    }

    // parse out the link to 'More' so we can continue grabbing items
    var moreLink = "";
    var moreMatch = moreRegex.exec(hnPage);
    if (moreMatch != null && moreMatch.length == 2) {
        moreLink = moreMatch[1];
    }

    // continue onward to download the next page, decrementing the page counter
    scrapeAndUpdate(moreLink, numPages - 1);
}

// searches the URL cache, then searchyc.com's archive for the current tab's
// URL, then stores its id into a global variable accessible from the popup.
function searchYC(tabId, changeInfo, tab) {
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
        else {
            console.log("Got searchYC response");
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
function updateCurrentTabId(tabId, selectInfo) {
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
