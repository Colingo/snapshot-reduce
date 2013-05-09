var test = require("tape")
var mongo = require("continuable-mongo")

var snapshotReduce = require("../../index")
var cleanup = require("../util/cleanup")

test("can do an incremental reduce", function (assert) {
    var client = mongo("mongodb://localhost:27017/colingo-group-tests")

    var input = client.collection("event-log")
    var output = client.collection("snapshot.colingo-room")

    input.insert([{
        "eventType" : "add",
        "timestamp" : 1360877429848,
        "value" : {
            "title" : "some room",
            "type" : "colingo-room",
            "id" : "1"
        }
    }], function (err, records) {
        assert.ifError(err)
        assert.equal(records.length, 1)

        snapshotReduce("colingo-room", {
            inputCollection: input,
            outputCollection: output
        }, function (err, result) {
            assert.ifError(err)
            assert.ok(result)

            input.insert([{
                "eventType" : "add",
                "timestamp" : 1360878425642,
                "value" : {
                    "name" : "Jake",
                    "message" : "test",
                    "type" : "colingo-room~messages",
                    "parentId" : [ "1" ],
                    "id" : "3dedc0cc-917b-48ed-a3c9-6166011fb458"
                }
            }], next)
        })
    })

    function next(err, records) {
        assert.ifError(err)
        assert.equal(records.length, 1)

        snapshotReduce("colingo-room", {
            inputCollection: input,
            outputCollection: output
        }, function (err, result) {
            assert.ifError(err)
            assert.ok(result)

            output.find().toArray(function (err, results) {
                assert.ifError(err)
                var result = results[0].value

                assert.deepEqual(result, {
                    title: "some room",
                    id: "1",
                    type: "colingo-room",
                    messages: [{
                        name: "Jake",
                        message: "test",
                        id: "3dedc0cc-917b-48ed-a3c9-6166011fb458",
                        type: "colingo-room~messages",
                        parentId: ["1"]
                    }],
                    __lastTimestamp__: 1360878425642
                })

                cleanup(client, input, output, function (err) {
                    assert.ifError(err)
                    assert.end()
                })
            })
        })
    }
})
