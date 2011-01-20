// run this function once the popup has loaded
window.onload = function() {
    // get the background page so we can get the item id for the current page
    var bgPage = chrome.extension.getBackgroundPage();

    // if the page had comments, update the popup
    if (bgPage.ITEM_ID >= 0) {
        console.log("Updating popup for item id " + bgPage.ITEM_ID);

        var hnItemURL = "http://news.ycombinator.com/item?id=";

        // load the page in an iframe in the extension popup using the item id
        var iframe = document.createElement("iframe");
        iframe.src = hnItemURL + bgPage.ITEM_ID;
        iframe.width = "120%";
        iframe.height = "103%";

        // append the iframe to the popup body
        console.log("Adding iframe with address '" + iframe.src + "'");
        document.body.appendChild(iframe);
    }
    else {
        console.error("Invalid item id: " + bgPage.ITEM_ID);
    }
}
