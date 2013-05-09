var test = require("tape")
var timestamp = require("monotonic-timestamp")
var mongo = require("continuable-mongo")

var snapshotReduce = require("../../index")
var reduce = snapshotReduce.reduce
var map = snapshotReduce.map
var cleanup = require("../util/cleanup")

var events = [
    Event({
        id: "1",
        type: "colingo-feed::course~members",
        parentId: ["0"],
        name: "steve"
    }, "add"),
    Event({
        id: "1",
        type: "colingo-feed::course~members",
        parentId: ["0"],
        online: true
    }, "modify"),
    Event({
        id: "2",
        type: "colingo-feed::course~members",
        parentId: ["0"],
        online: true
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
    var input = client.collection(inputName)
    var output = client.collection(outputName)

    input.insert(events, function (err, records) {
        assert.ifError(err)
        assert.equal(records.length, 3)

        snapshotReduce("colingo-feed::course", {
            inputCollection: input,
            outputCollection: output
        }, function (err, result) {
            assert.ifError(err)
            assert.ok(result)

            output.find().toArray(function (err, results) {
                assert.ifError(err)

                assert.deepEqual(results[0].value, {
                    id: "0",
                    __lastTimestamp__: events[2].timestamp,
                    members: [{
                        id: "1",
                        type: "colingo-feed::course~members",
                        parentId: ["0"],
                        name: "steve",
                        online: true
                    }]
                })

                cleanup(client, input, output, function (err) {
                    assert.ifError(err)
                    assert.end()
                })
            })
        })
    })
})

function Event(value, type) {
    return {
        eventType: type || "add",
        timestamp: timestamp(),
        value: value
    }
}
