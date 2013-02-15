var after = require("after")
var fold = require("reducers/fold")
var close = require("mongo-client/close")

var slice = Array.prototype.slice

module.exports = cleanup

function cleanup() {
    var cols = slice.call(arguments)
    var callback = cols.pop()

    var done = after(cols.length, function () {
        close(cols[0], callback)
    })

    cols.forEach(function (col) {
        fold(col, function (col) {
            col.drop(done)
        })
    })
}
