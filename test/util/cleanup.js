var after = require("after")

module.exports = cleanup

function cleanup(client) {
    var cols = [].slice.call(arguments, 1)
    var callback = cols.pop()

    var done = after(cols.length, function () {
        client.close(callback)
    })

    cols.forEach(function (col) {
        col(function (err, col) {
            col.drop(done)
        })
    })
}
