var test = require("tape")
var uuid = require("node-uuid")
var mongo = require("continuable-mongo")
var timestamp = require("monotonic-timestamp")

var snapshotReduce = require("../../index")
var cleanup = require("../util/cleanup")

test("can reduce data into snapshot", function (assert) {
    var client = mongo("mongodb://localhost:27017/colingo-hangout-tests2")

    var inputName = "event-log"
    var outputName = "snapshot.colingo-feed::course"
    var input = client.collection(inputName)
    var output = client.collection(outputName)

    var courseId = uuid()
    var hangoutId = uuid()
    var ts = Date.now()
    var createdAt = timestamp()
    var lastUpdated1 = timestamp()
    var lastUpdated2 = timestamp()

    input.insert([{
        eventType: "add",
        timestamp: ts,
        value: {
            a: "a",
            b: "b",
            c: "c",
            createdAt: createdAt,
            lastUpdated: lastUpdated1,
            type: "colingo-feed::course~hangout",
            parentId: [courseId],
            id: hangoutId
        }
    }, {
        eventType: "modify",
        timestamp: ts + 1,
        value: {
            b: "d",
            d: "d",
            lastUpdated: lastUpdated2,
            type: "colingo-feed::course~hangout",
            parentId: [courseId],
            id: hangoutId
        }
    }], function (err, records) {
        assert.ifError(err)
        assert.equal(records.length, 2)

        snapshotReduce("colingo-feed::course", {
            inputCollection: input,
            outputCollection: output
        }, function (err, result) {
            assert.ifError(err)
            assert.ok(result)

            output.find().toArray(function (err, list) {
                assert.ifError(err)

                var result = list[0].value

                assert.deepEqual(result, {
                    __lastTimestamp__: ts + 1,
                    id: courseId,
                    hangout: [{
                        a: "a",
                        b: "d",
                        c: "c",
                        d: "d",
                        createdAt: createdAt,
                        lastUpdated: lastUpdated2,
                        type: "colingo-feed::course~hangout",
                        parentId: [courseId],
                        id: hangoutId
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
