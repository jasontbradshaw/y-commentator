// used to allow the popup to access the url of the current page's HN comments
var ITEM_ID = -1;

// holds content scraped directly from HN to fill in where search.yc falls down.
// contains URLs mapped to item id integers.
var URL_CACHE = new Object();

// scrapes the HN front page and 'newest' page, updating the URL cache
function scrapeHandler() {
    var numNewsPages = 3;
    var numNewestPages = 5;

    console.log("Scraping " + numNewsPages + " 'news' pages");
    scrapeAndUpdate("news", numNewsPages);

    console.log("Scraping " + numNewestPages + " 'newest' pages");
    scrapeAndUpdate("newest", numNewestPages);

    // count number of URLs in cache
    var urlCacheSize = 0;
    for (var url in URL_CACHE) {
        if (URL_CACHE.hasOwnProperty(url)) {
            urlCacheSize += 1;
        }
    }

    console.log("URL cache has " + urlCacheSize + " items");
    for (var url in URL_CACHE) {
        if (URL_CACHE.hasOwnProperty(url)) {
            console.log("  '" + url + "': " + URL_CACHE[url]);
        }
    }
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
        console.log("Failed to access '" + hnBaseURL + subdomain + "': " +
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

function searchYC(tabId, changeInfo, tab) {
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

        console.log("URL not in cache, requesting data for url: '" +
                searchURL + escape(tab.url) + "'");

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
        console.log("Successfully parsed response JSON, got " + results.length +
                " results");

        // only show the page action icon if there were any results
        if (results.length > 0) {
            // get the first result, the only one we'll consider
            item = results[0];

            // set the local item id variable
            newItemId = item["id"];
        }
    }

    // show the page action if the local item id was set
    if (newItemId > -1) {
        console.log("Showing page action icon");
        chrome.pageAction.show(tabId);

        // set the global item id so the popup can access it
        console.log("Setting global item id to " + newItemId);
        ITEM_ID = newItemId;
    }
    // hide the action icon otherwise
    else {
        console.log("Hiding page action icon");
        chrome.pageAction.hide(tabId);
    }
}

// do an initial scrape
console.log("Doing initial content scrape");
scrapeHandler();

// continue scraping for content periodically
var scrapeInterval = 900000; // 15 minutes
console.log("Setting scrape interval to " + scrapeInterval + " ms");
setInterval("scrapeHandler()", scrapeInterval);

// listen for changes to any tab so we can check for HN content for its URL
console.log("Setting tab update event listener");
chrome.tabs.onUpdated.addListener(searchYC);
