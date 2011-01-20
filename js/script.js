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

        // the url for getting an item from news.ycombinator.com by its id
        var commentURL = "http://news.ycombinator.com/item?id=" + item["id"];

        // create the HTML for displaying the comments in an iframe
        var html = '<html><head>';
        html += '<link rel="stylesheet" href="css/style.css" type="text/css" />';
        html += '</head><body>';
        html += '<iframe src="' + commentURL;
        html += '" width="120%" height="103%"></iframe>';
        html += '</body></html>';

        // show the icon
        chrome.pageAction.show(tabId);
    }
    // hide the page action with 0 results (ensure it's not visible)
    else {
        chrome.pageAction.hide(tabId);
    }
}

// listen for changes to any tab
chrome.tabs.onUpdated.addListener(searchYC);
