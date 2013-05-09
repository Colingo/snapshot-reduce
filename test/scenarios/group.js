var test = require("tape")
var uuid = require("node-uuid")
var mongo = require("continuable-mongo")

var snapshotReduce = require("../../index")
var cleanup = require("../util/cleanup")

test("can reduce raw data into snapshots", function (assert) {
    var client = mongo("mongodb://localhost:27017/colingo-group-tests")

    var inputName = "event-log"
    var outputName = "snapshot.colingo-group"
    var input = client.collection(inputName)
    var output = client.collection(outputName)

    var groupId = uuid()
    var memberOne = uuid()
    var memberTwo = uuid()
    var ts = Date.now()

    input.insert([{
        eventType: "add",
        timestamp: ts,
        value: {
            title: "a",
            type: "colingo-group",
            id: groupId
        }
    }, {
        eventType: "add",
        timestamp: ts,
        value: {
            name: "b",
            id: memberOne,
            type: "colingo-group" + "~members",
            imageUri: "b",
            parentId: [groupId]
        }
    }, {
        eventType: "add",
        timestamp: ts,
        value: {
            name: "c",
            id: memberTwo,
            type: "colingo-group" + "~members",
            imageUri: "c",
            parentId: [groupId]
        }
    }, {
        eventType: "remove",
        timestamp: ts,
        value: {
            id: memberOne,
            type: "colingo-group" + "~members",
            name: "b",
            parentId: [groupId]
        }
    }], function (err, records) {
        assert.ifError(err)
        assert.equal(records.length, 4)

        snapshotReduce("colingo-group", {
            inputCollection: input,
            outputCollection: output
        }, function (err, result) {
            assert.ifError(err)
            assert.ok(result)

            output.find().toArray(function (err, list) {
                assert.ifError(err)
                // console.log("results", results)
                var result = list[0].value

                // console.log("r", result)

                assert.deepEqual(result, {
                    title: "a",
                    id: groupId,
                    type: "colingo-group",
                    members: [{
                        name: "c",
                        id: memberTwo,
                        type: "colingo-group~members",
                        imageUri: "c",
                        parentId: [groupId]
                    }],
                    __lastTimestamp__: ts
                })

                cleanup(client, input, output, function (err) {
                    assert.ifError(err)

                    assert.end()
                })
            })
        })
    })
})

