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

test("can reduce rooms", function (assert) {
    var client = mongo("mongodb://localhost:27017/colingo-group-tests")

    var input = client("event-log")
    var output = client("snapshot.colingo-room")

    var inserted = insert(input, [{
        "eventType" : "add"
        , "timestamp" : 1360877429848
        , "value" : {
            "title" : "some room"
            , "type" : "colingo-room"
            , "id" : "1"
        }
    }, {
        "eventType" : "add"
        , "timestamp" : 1360878425642
        , "value" : {
            "name" : "Jake"
            , "message" : "test"
            , "type" : "colingo-room~messages"
            , "parentId" : [ "1" ]
            , "id" : "3dedc0cc-917b-48ed-a3c9-6166011fb458"
        }
    }])

    var reduced = expand(take(inserted, 1), function () {
        return snapshotReduce("colingo-room", {
            inputCollection: input
            , outputCollection: output
        })
    })

    var results = expand(reduced, function (col) {
        return find(output, {})
    })

    passback(results, Array, function (err, results) {
        assert.ifError(err)
        var result = results[0].value

        assert.deepEqual(result, {
            title: "some room"
            , id: "1"
            , type: "colingo-room"
            , messages: [{
                name: "Jake"
                , message: "test"
                , id: "3dedc0cc-917b-48ed-a3c9-6166011fb458"
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
