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

test("can do an incremental reduce", function (assert) {
    var client = mongo("mongodb://localhost:27017/colingo-group-tests")

    var input = client("event-log")
    var output = client("snapshot.colingo-room")

    var inserted = insert(input, [{
        "eventType" : "add"
        , "value" : {
            "title" : "some room"
            , "type" : "colingo-room"
            , "id" : "1"
            , "timestamp" : 1360877429848
        }
    }])

    var reduced = expand(take(inserted, 1), function () {
        return snapshotReduce("colingo-room", {
            inputCollection: input
            , outputCollection: output
        })
    })

    var secondInsertion = expand(reduced, function () {
        return insert(input, {
            "eventType" : "add"
            , "value" : {
                "name" : "Jake"
                , "message" : "test"
                , "type" : "colingo-room~messages"
                , "parentId" : [ "1" ]
                , "id" : "3dedc0cc-917b-48ed-a3c9-6166011fb458"
                , "timestamp" : 1360878425642
            }
        })
    })

    var secondReduced = expand(take(secondInsertion, 1), function () {
        return snapshotReduce("colingo-room", {
            inputCollection: input
            , outputCollection: output
        })
    })

    var results = expand(secondReduced, function (col) {
        return find(output, {})
    })

    passback(results, Array, function (err, results) {
        assert.ifError(err)
        var result = results[0].value

        assert.deepEqual(result, {
            title: "some room"
            , id: "1"
            , type: "colingo-room"
            , timestamp: 1360877429848
            , messages: [{
                name: "Jake"
                , message: "test"
                , id: "3dedc0cc-917b-48ed-a3c9-6166011fb458"
                , timestamp: 1360878425642
                , type: "colingo-room~messages"
                , parentId: ["1"]
            }]
            , __lastTimestamp__: 1360878425642
        })

        cleanup(input, output, function () {
            assert.end()
        })
    })
})