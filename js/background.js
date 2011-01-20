// used to allow the popup to access the url of the current page's HN comments
var ITEM_ID = -1;

// holds content scraped directly from HN to fill in when search.yc falls down.
// contains URLs mapped to item id integers.
var SCRAPED_URLS = new Object();

// scrapes content directly from HN to fill in for lag in searchYC database.
// updates the global object that holds the URLs in-place.
function scrapeAndUpdate() {
    // the URL to the Hacker News front page
    var hnURL = "http://news.ycombinator.com/news";

    // download the front page syncronously
    var req = new XMLHttpRequest();
    req.open("GET", hnURL, false);
    req.send(null);

    // exit if we couldn't access the page
    if (req.status != 200) {
        return;
    }

    var hnFrontpage = req.responseXML;
    alert(hnFrontpage);
}

function searchYC(tabId, changeInfo, tab) {
    // the URL used to access searchyc.com's API
    var searchURL = "http://json.searchyc.com/domains/find?url=";

    console.log("Requesting data for url: '" + searchURL + escape(tab.url) + "'");

    // issue a synchronous request for the page data
    var req = new XMLHttpRequest();
    req.open("GET", searchURL + escape(tab.url), false);
    req.send(null);

    // exit if we couldn't access the searchYC server
    if (req.status != 200) {
        console.error("Could not access searchYC: " + req.status + ", " + req.statusText);
        return;
    }
    else {
        console.log("Got searchYC response");
    }

    // parse results
    var results = JSON.parse(req.responseText);
    console.log("Successfully parsed response JSON, got " + results.length + " results");

    // only show the page action icon if there were any results
    if (results.length > 0) {
        // get the first result, the only one we'll display
        item = results[0];

        // create a title string for the action
        var title = item["points"] + " points"
        title += " by " + item["username"];
        title += " on " + item["post_date"];

        // set the hover text of the icon
        var details = new Object();
        details.tabId = tabId;
        details.title = title;

        console.log("Setting icon title text to: '" + title + "'");
        chrome.pageAction.setTitle(details);

        // set the global item id variable
        console.log("Setting global item id to " + item["id"]);
        ITEM_ID = item["id"];

        // show the icon
        console.log("Showing action icon");
        chrome.pageAction.show(tabId);
    }
    // hide the page action when there are no results
    else {
        console.log("Hiding action icon");
        chrome.pageAction.hide(tabId);
    }
}

// listen for changes to any tab
chrome.tabs.onUpdated.addListener(searchYC);
