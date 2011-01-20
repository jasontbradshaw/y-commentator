// runs after load so we ensure that we've got all the appropriate DOM elements
window.onload = function() {
    // get the background page so we can get the item id for the current page
    var bgPage = chrome.extension.getBackgroundPage();

    // get the item id for the currently selected tab
    var itemId = bgPage.ITEM_CACHE[bgPage.CURRENT_TAB_ID];
    console.log("Got item id " + itemId +
            " for tab id " + bgPage.CURRENT_TAB_ID);

    // if the page had comments, update the popup
    if (itemId >= 0) {
        // base URL for HN comment threads
        var hnItemURL = "http://news.ycombinator.com/item?id=";

        // load the page in an iframe in the extension popup using the item id
        var hnFrame = document.getElementById("hn_frame");
        hnFrame.src = hnItemURL + itemId;
        console.log("Updated iframe with address '" + hnFrame.src + "'");
    }
    else {
        console.error("Invalid item id: " + itemId);
    }
}
