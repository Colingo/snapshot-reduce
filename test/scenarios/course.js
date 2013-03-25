var mongo = require("mongo-client")
var insert = require("mongo-client/insert")
var find = require("mongo-client/find")
var expand = require("reducers/expand")
var take = require("reducers/take")
var passback = require("callback-reduce/passback")
var timestamp = require("monotonic-timestamp")

var test = require("tape")
var uuid = require("node-uuid")
var extend = require("xtend")
var util = require("util")

var snapshotReduce = require("../../index")
var map = snapshotReduce.map
var reduce = snapshotReduce.reduce
var cleanup = require("../util/cleanup")

var events = [
    Event({
        id: "1"
        , type: "colingo-feed::course"
    })
    , Event({
        id: "2"
        , type: "colingo-feed::course~lessons"
        , name: "I am a lesson"
        , parentId: ["1"]
    })
    , Event({
        id: "3"
        , type: "colingo-feed::course~lessons~questions"
        , name: "I am a question"
        , parentId: ["1", "2"]
    })
    , Event({
        id: "4"
        , type: "colingo-feed::course~lessons~questions~answer"
        , name: "I am an answer"
        , parentId: ["1", "2", "3"]
    })
]

test("map events", function (assert) {
    var res = map.call(events[0])

    assert.deepEqual(res, ["1", {
        id: "1"
        , type: "colingo-feed::course"
        , __lastTimestamp__: res[1].__lastTimestamp__
    }])

    var res = map.call(events[1])

    assert.deepEqual(res, ["1", {
        __lastTimestamp__: res[1].__lastTimestamp__
        , id: "1"
        , lessons: [{
            id: "2"
            , type: "colingo-feed::course~lessons"
            , name: "I am a lesson"
            , parentId: ["1"]
        }]
    }])

    var res = map.call(events[2])

    assert.deepEqual(res, ["1", {
        __lastTimestamp__: res[1].__lastTimestamp__
        , lessons: [{
            id: "2"
            , questions: [{
                id: "3"
                , type: "colingo-feed::course~lessons~questions"
                , name: "I am a question"
                , parentId: ["1", "2"]
            }]
        }]
    }])

    var res = map.call(events[3])

    assert.deepEqual(res, ["1", {
        __lastTimestamp__: res[1].__lastTimestamp__
        , lessons: [{
            id: "2"
            , questions: [{
                id: "3"
                , answer: [{
                    id: "4"
                    , type: "colingo-feed::course~lessons~questions~answer"
                    , name: "I am an answer"
                    , parentId: ["1", "2", "3"]
                }]
            }]
        }]
    }])

    assert.end()
})

test("reduce events", function (assert) {
    var events1 = events.slice(0, 1).map(function (v) {
        return map.call(v)[1]
    })

    var result = reduce(null, events1)

    assert.deepEqual(result, {
        id: "1"
        , type: "colingo-feed::course"
        , __lastTimestamp__: result.__lastTimestamp__
    })

    var events2 = events.slice(0, 2).map(function (v) {
        return map.call(v)[1]
    })

    var result = reduce(null, events2)

    assert.deepEqual(result, {
        id: "1"
        , type: "colingo-feed::course"
        , __lastTimestamp__: result.__lastTimestamp__
        , lessons: [{
            id: "2"
            , type: "colingo-feed::course~lessons"
            , name: "I am a lesson"
            , parentId: ["1"]
        }]
    })

    var events3 = events.slice(0, 3).map(function (v) {
        return map.call(v)[1]
    })

    var result = reduce(null, events3)

    assert.deepEqual(result, {
        id: "1"
        , type: "colingo-feed::course"
        , __lastTimestamp__: result.__lastTimestamp__
        , lessons: [{
            id: "2"
            , type: "colingo-feed::course~lessons"
            , name: "I am a lesson"
            , parentId: ["1"]
            , questions: [{
                id: "3"
                , type: "colingo-feed::course~lessons~questions"
                , name: "I am a question"
                , parentId: ["1", "2"]
            }]
        }]
    })

    var events4 = events.map(function (v) {
        return map.call(v)[1]
    })

    var result = reduce(null, events4)

    assert.deepEqual(result, {
        id: "1"
        , type: "colingo-feed::course"
        , __lastTimestamp__: result.__lastTimestamp__
        , lessons: [{
            id: "2"
            , type: "colingo-feed::course~lessons"
            , name: "I am a lesson"
            , parentId: ["1"]
            , questions: [{
                id: "3"
                , type: "colingo-feed::course~lessons~questions"
                , name: "I am a question"
                , parentId: ["1", "2"]
                , answer: [{
                    id: "4"
                    , type: "colingo-feed::course~lessons~questions~answer"
                    , name: "I am an answer"
                    , parentId: ["1", "2", "3"]
                }]
            }]
        }]
    })

    assert.end()
})

test("can reduce courses", function (assert) {
    var client = mongo("mongodb://localhost:27017/snapshot-reduce-tests")

    var input = client("event-log")
    var output = client("snapshot.colingo-feed::course")

    var inserted = insert(input, [
        Event({
            id: "1"
            , type: "colingo-feed::course"
        })
        , Event({
            id: "2"
            , type: "colingo-feed::course~lessons"
            , name: "I am a lesson"
            , parentId: ["1"]
        })
        , Event({
            id: "3"
            , type: "colingo-feed::course~lessons~questions"
            , name: "I am a question"
            , parentId: ["1", "2"]
        })
        , Event({
            id: "4"
            , type: "colingo-feed::course~lessons~questions~answer"
            , name: "I am an answer"
            , parentId: ["1", "2", "3"]
        })
    ])

    var reduced = expand(take(inserted, 1), function () {
        return snapshotReduce("colingo-feed::course", {
            inputCollection: input
            , outputCollection: output
        })
    })

    var results = expand(reduced, function (col) {
        return find(output)
    })

    passback(results, Array, function (err, results) {
        assert.ifError(err)

        var result = results && results[0].value

        assert.deepEqual(result, {
            id: "1"
            , type: "colingo-feed::course"
            , __lastTimestamp__: result.__lastTimestamp__
            , lessons: [{
                id: "2"
                , type: "colingo-feed::course~lessons"
                , name: "I am a lesson"
                , parentId: ["1"]
                , questions: [{
                    id: "3"
                    , type: "colingo-feed::course~lessons~questions"
                    , name: "I am a question"
                    , parentId: ["1", "2"]
                    , answer: [{
                        id: "4"
                        , type: "colingo-feed::course~lessons~questions~answer"
                        , name: "I am an answer"
                        , parentId: ["1", "2", "3"]
                    }]
                }]
            }]
        })

        cleanup(input, output, function () {
            assert.end()
        })
    })
})

function Event(value) {
    return {
        eventType: "add"
        , timestamp: timestamp()
        , value: value
    }
}
