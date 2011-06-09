// holds all state for the extension
var __YC_STATE = {
    // holds content scraped directly from HN to fill in where HNSearch falls
    // down. contains URLs mapped to item id integers. also used to cache items
    // once they've been looked up via the external API.
    "urls": {},

    // items we never want to look up in the api, namely chrome-specific pages.
    // stored as a list of regexp objects for quick matching.
    "filters": [
        RegExp("^chrome://.*$"), // chrome pages, like new tabs or history
        RegExp("^http://news\.ycombinator\.com/[a-z]+[?].*$"), // special HN pages
        RegExp("^http://www\.google\.com/search\?.*$") // Google search pages
    ]
}

// scrapes content directly from HN to fill in for lag in HNSearch database.
// updates the global object that holds the URLs in-place.
var scrapeAndUpdate = function (subdomain, numPages) {
    // bottom out when we've hit our page quota
    if (numPages <= 0) {
        // count URLs in cache and log before returning
        var cacheSize = 0;
        for (var url in __YC_STATE.urls) {
            if (__YC_STATE.urls.hasOwnProperty(url)) {
                cacheSize += 1;
            }
        }

        console.log("URL cache has " + cacheSize + " items");

        return;
    }

    // the base URL for Hacker News, which we append the given subdomain to
    var hnBaseURL = "http://news.ycombinator.com";

    // download the requested page asyncronously
    var req = new XMLHttpRequest();
    req.open("GET", hnBaseURL + subdomain, true);

    req.onreadystatechange = function (aEvt) {
        // give up if we're not done downloading the request yet
        if (req.readyState != 4) {
            return;
        }

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

        console.log("Searching " + tds.length +
                " td elements for matching titles");

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

            // get the subtext of the title, which contains the item id
            var subtext = title.parentNode.nextSibling.childNodes[1];

            // certain posts don't have a standard subtext and only contain
            // short subtext spans, so we skip those.
            if (subtext.firstChild.attributes != null) {
                // get the item id, a part of the score id for subtext tds
                var spanId =
                    subtext.firstChild.attributes.getNamedItem("id").value;

                // makes 'score_000000' into '000000' and parses the number
                var itemNum = parseInt(spanId.replace("score_", ""));

                // add the parsed item to the URL cache if it's not already there
                if (__YC_STATE.urls[itemURL] == null) {
                    __YC_STATE.urls[itemURL] = itemNum;
                    addedCount += 1;
                }
            }
        }

        console.log("Added " + addedCount + " new items to the cache");

        // continue on to download the next page, decrementing the page counter
        var moreLink = more.firstChild.attributes.getNamedItem("href").value;
        scrapeAndUpdate(moreLink, numPages - 1);
    };

    try {
        req.send(null);
    }
    catch (error) {
        console.error("Scrape failed with error:\n\t" + error);
        return;
    }
}

// scrapes HN, updating the URL cache
var scrapeHandler = function (numNewsPages, numNewestPages) {
    console.log("Scraping " + numNewsPages + " 'news' pages");
    scrapeAndUpdate("/news", numNewsPages);

    console.log("Scraping " + numNewestPages + " 'newest' pages");
    scrapeAndUpdate("/newest", numNewestPages);
}

// searches the URL cache, then hnsearch.com's archive for the current tab's
// URL, then updates the page action and URL cache if necessary.
var searchAndUpdate = function (tab) {
    // check the cache for the URL before hitting the external server
    if (__YC_STATE.urls[tab.url] != null) {
        console.log("Found '" + tab.url + "' in cache, item id " +
                __YC_STATE.urls[tab.url]);

        // show the page action for the given tab id
        console.log("Showing page action icon");
        chrome.pageAction.show(tab.id);

        return;
    }

    // ask the remote server for the URL
    else {
        // the URL used to access hnsearch.com's API. searches by URL only,
        // sorts putting newest items first, and limits results to one item.
        var searchURL = "http://api.thriftdb.com/api.hnsearch.com/items/_search?sortby=create_ts desc&limit=1&filter[fields][url][]=";

        console.log(tab.url + " not in cache, requesting data");

        // issue an asynchronous request for the page data
        var req = new XMLHttpRequest();
        req.open("GET", searchURL + tab.url, true);

        req.onreadystatechange = function (aEvt) {
            // give up if request hasn't finished loading yet
            if (req.readyState != 4) {
                return;
            }

            // exit if we couldn't access the HNSearch server
            if (req.status != 200) {
                console.error("Could not access HNSearch: " + req.status +
                        ", " + req.statusText);
                return;
            }

            // parse results
            var results = JSON.parse(req.responseText);
            console.log("Parsed response JSON, got " + results["hits"] +
                    " results");

            // set the result item id if there was a result, otherwise null
            var resultId = null;
            if (results["hits"] > 0) {
                // get the result id from the response, which is only one item
                item = results["results"][0]["item"];

                // return the found item id
                resultId = item["id"];
            }

            // show the page action and update the cache if we received a valid
            // item id.
            if (resultId != null) {
                // add the new URL to the global cache if need be
                if (__YC_STATE.urls[tab.url] == undefined) {
                    console.log("Adding " + tab.url + " to cache with item id " +
                            resultId);
                    __YC_STATE.urls[tab.url] = resultId;
                }

                console.log("Showing page action icon");
                chrome.pageAction.show(tab.id);
            }
            // hide the action icon otherwise
            else {
                console.log("Hiding page action icon");
                chrome.pageAction.hide(tab.id);
            }
        };

        try {
            req.send(null);
        }
        catch (error) {
            console.error("API search failed with error:\n\t" + error);
            return;
        }
    }
}

// the handler for doing an api search on tab load
var searchHandler = function (tabId, changeInfo, tab) {
    // run only when tab is loading. keeps from running twice when 'loading' as
    // well as when 'complete'. we run when 'loading' since it shows the icon
    // almost immediately rather than having to wait for the page to load first.
    if (changeInfo.status == "loading") {
        // filter out certain urls
        for (var i = 0; i < __YC_STATE.filters.length; i++) {
            var pattern = __YC_STATE.filters[i];
            // skip tabs that match against any of the filters
            if (pattern.test(tab.url)) {
                console.log("Tab URL " + tab.url + " matched against filter '" +
                        pattern.source + "', ignoring.");
                return;
            }
        }

        searchAndUpdate(tab);
    }
}

// open a tab containing the comments for the current tab's URL
var openComments = function (tab) {
    // get the item id for the currently selected tab
    var itemId = __YC_STATE.urls[tab.url];

    // error on invalid item id
    if (itemId >= 0) {
        // open a new tab with the comments page as the url
        var newTab = {
            "url": "http://news.ycombinator.com/item?id=" + itemId,
            "index": tab.index + 1 // open next to current tab
        }

        chrome.tabs.create(newTab);

        // TODO: allow opening of comments in a new window
        //window.open(newTab.url, "Hacker News Comments", "width=800,height=400");
    }
}

// listen for page action clicks so we can open comment tabs
console.log("Setting page action click listener");
chrome.pageAction.onClicked.addListener(openComments);

// listen for changes to any tab so we can check for HN content for its URL
console.log("Setting tab update event listener");
chrome.tabs.onUpdated.addListener(searchHandler);

// scrape for content periodically
var scrapeInterval = 420000; // 7 minutes
console.log("Setting scrape interval to " + scrapeInterval + " ms");
setInterval("scrapeHandler(" + 1 + ", " + 3 + ")", scrapeInterval);

// do an initial scrape, deeper than the periodic one
console.log("Doing initial content scrape");
scrapeHandler(2, 5);
