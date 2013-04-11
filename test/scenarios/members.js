var mongo = require("mongo-client")
var insert = require("mongo-client/insert")
var find = require("mongo-client/find")
var expand = require("reducers/expand")
var take = require("reducers/take")
var passback = require("callback-reduce/passback")

var test = require("tape")
var timestamp = require("monotonic-timestamp")

var snapshotReduce = require("../../index")
var reduce = snapshotReduce.reduce
var map = snapshotReduce.map
var cleanup = require("../util/cleanup")

var events = [
    Event({
        id: "1"
        , type: "colingo-feed::course~members"
        , parentId: ["0"]
        , name: "steve"
    }, "add")
    , Event({
        id: "1"
        , type: "colingo-feed::course~members"
        , parentId: ["0"]
        , online: true
    }, "modify")
    , Event({
        id: "2"
        , type: "colingo-feed::course~members"
        , parentId: ["0"]
        , online: true
    }, "modify")
]

test("reduce function on events", function (assert) {
    var mapped = events.map(function (ev) {
        return map.call(ev)[1]
    })
    var result = reduce(null, mapped)

    assert.deepEqual(result, {
        id: "0",
        __lastTimestamp__: result.__lastTimestamp__,
        members: [{
            id: "1",
            type: "colingo-feed::course~members",
            parentId: ["0"],
            name: "steve",
            online: true
        }]
    })

    assert.end()
})

test("modify non-existent records does not add shit", function (assert) {
    var client = mongo("mongodb://localhost:27017/colingo-members-tests")

    var inputName = "event-log"
    var outputName = "snapshot.colingo-feed::course"
    var input = client(inputName)
    var output = client(outputName)

    var inserted = insert(input, events)

    var reduced = expand(take(inserted, 1), function () {
        return snapshotReduce("colingo-feed::course", {
            inputCollection: input
            , outputCollection: output
        })
    })

    var result = expand(reduced, function () {
        return find(output, {})
    })

    passback(result, Array, function (err, results) {
        assert.ifError(err)

        assert.deepEqual(results[0].value, {
            id: "0"
            , __lastTimestamp__: events[2].timestamp
            , members: [{
                id: "1"
                , type: "colingo-feed::course~members"
                , parentId: ["0"]
                , name: "steve"
                , online: true
            }]
        })

        cleanup(input, output, function () {
            assert.end()
        })
    })
})

function Event(value, type) {
    return {
        eventType: type || "add"
        , timestamp: timestamp()
        , value: value
    }
}
