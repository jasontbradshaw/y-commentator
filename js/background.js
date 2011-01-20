// used to allow the popup to access the url of the current page's HN comments
var commentId = -1;

function searchYC(tabId, changeInfo, tab) {
    // the URL used to access searchyc.com's API
    var searchURL = "http://json.searchyc.com/domains/find?url=";

    // issue a synchronous request for the page data
    var req = new XMLHttpRequest();
    req.open("GET", searchURL + escape(tab.url), false);
    req.send(null);

    // parse results
    var results = JSON.parse(req.responseText);

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
        chrome.pageAction.setTitle(details);

        // set the id used for getting an item's comments from HN so it can be
        // viewed externally.
        commentId = item["id"];

        // show the icon
        chrome.pageAction.show(tabId);
    }
    // hide the page action when there are no results
    else {
        chrome.pageAction.hide(tabId);
    }
}

// listen for changes to any tab
chrome.tabs.onUpdated.addListener(searchYC);
