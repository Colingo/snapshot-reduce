var mongo = require("mongo-client")
var insert = require("mongo-client/insert")
var find = require("mongo-client/find")
var timestamp = require("monotonic-timestamp")
var expand = require("reducers/expand")
var take = require("reducers/take")
var passback = require("callback-reduce/passback")

var test = require("tape")
var uuid = require("node-uuid")

var snapshotReduce = require("../../index")
var cleanup = require("../util/cleanup")

test("can reduce data into snapshot", function (assert) {
    var client = mongo("mongodb://localhost:27017/colingo-hangout-tests2")

    var inputName = "event-log"
    var outputName = "snapshot.colingo-feed::course"
    var input = client(inputName)
    var output = client(outputName)

    var courseId = uuid()
    var hangoutId = uuid()
    var ts = Date.now()
    var createdAt = timestamp()
    var lastUpdated1 = timestamp()
    var lastUpdated2 = timestamp()

    var inserted = insert(input, [{
        eventType: "add"
        , timestamp: ts
        , value: {
            a: "a"
            , b: "b"
            , c: "c"
            , createdAt: createdAt
            , lastUpdated: lastUpdated1
            , type: "colingo-feed::course~hangout"
            , parentId: [courseId]
            , id: hangoutId
        }
    }, {
        eventType: "modify"
        , timestamp: ts + 1
        , value: {
            b: "d"
            , d: "d"
            , lastUpdated: lastUpdated2
            , type: "colingo-feed::course~hangout"
            , parentId: [courseId]
            , id: hangoutId
        }
    }])

    var reduced = expand(take(inserted, 1), function () {
        return snapshotReduce("colingo-feed::course", {
            inputCollection: input
            , outputCollectionName: output
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
            __lastTimestamp__: ts + 1
            , hangout: [{
                a: "a"
                , b: "d"
                , c: "c"
                , d: "d"
                , createdAt: createdAt
                , lastUpdated: lastUpdated2
                , type: "colingo-feed::course~hangout"
                , parentId: [courseId]
                , id: hangoutId
            }]
        })

        cleanup(input, output, function () {
            assert.end()
        })
    })
})
