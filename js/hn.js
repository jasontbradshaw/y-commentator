// these functions are found on the HN comment pages, and need to be loaded by
// popup.html to allow things like voting and linking to work.  we mirror them
// here to avoid the obvious security holes created by parsing them out ot the
// comment page's HTML and 'eval(...)'-ing them.
function byId(id) {
    return document.getElementById(id);
}

function vote(node) {
    var v = node.id.split(/_/);   // {'up', '123'}
    var item = v[1]; 

    // adjust score
    var score = byId('score_' + item);
    var newscore = parseInt(score.innerHTML) + (v[0] == 'up' ? 1 : -1);
    score.innerHTML = newscore + (newscore == 1 ? ' point' : 'points');

    // hide arrows
    byId('up_'   + item).style.visibility = 'hidden';
    byId('down_' + item).style.visibility = 'hidden';

    // ping server
    var ping = new Image();
    ping.src = node.href;

    return false; // cancel browser nav
}
