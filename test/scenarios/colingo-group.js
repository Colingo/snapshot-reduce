var mongo = require("mongo-client")
var insert = require("mongo-client/insert")
var find = require("mongo-client/find")
var expand = require("reducers/expand")
var take = require("reducers/take")
var passback = require("callback-reduce/passback")

var test = require("tape")
var uuid = require("node-uuid")

var snapshotReduce = require("../../index")
var cleanup = require("../util/cleanup")

test("can reduce raw data into snapshots", function (assert) {
    var client = mongo("mongodb://localhost:27017/colingo-group-tests")

    var inputName = "event-log"
    var outputName = "snapshot.colingo-group"
    var input = client(inputName)
    var output = client(outputName)

    var groupId = uuid()
    var memberOne = uuid()
    var memberTwo = uuid()
    var ts = Date.now()

    var inserted = insert(input, [{
        eventType: "add"
        , value: {
            title: "a"
            , type: "colingo-group"
            , id: groupId
            , timestamp: ts
        }
    }, {
        eventType: "add"
        , value: {
            name: "b"
            , id: memberOne
            , type: "colingo-group" + "~members"
            , imageUri: "b"
            , parentId: [groupId]
            , timestamp: ts
        }
    }, {
        eventType: "add"
        , value: {
            name: "c"
            , id: memberTwo
            , type: "colingo-group" + "~members"
            , imageUri: "c"
            , parentId: [groupId]
            , timestamp: ts
        }
    }, {
        eventType: "remove"
        , value: {
            id: memberOne
            , type: "colingo-group" + "~members"
            , name: "b"
            , parentId: [groupId]
            , timestamp: ts
        }
    }])

    var reduced = expand(take(inserted, 1), function () {
        return snapshotReduce("colingo-group", {
            inputCollection: input
            , outputCollection: output
        })
    })

    var results = expand(reduced, function (col) {
        return find(output, {})
    })

    passback(results, Array, function (err, results) {
        assert.ifError(err)
        // console.log("results", results)
        var result = results[0].value

        // console.log("r", result)

        assert.deepEqual(result, {
            title: "a"
            , id: groupId
            , type: "colingo-group"
            , timestamp: ts
            , members: [{
                name: "c"
                , id: memberTwo
                , type: "colingo-group~members"
                , imageUri: "c"
                , parentId: [groupId]
                , timestamp: ts
            }]
            , __lastTimestamp__: ts
        })

        cleanup(input, output, function () {
            assert.end()
        })
    })
})

