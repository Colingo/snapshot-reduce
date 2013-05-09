var timestamp = require("monotonic-timestamp")
var mongo = require("continuable-mongo")

var test = require("tape")

var snapshotReduce = require("../../index")
var map = snapshotReduce.map
var reduce = snapshotReduce.reduce
var cleanup = require("../util/cleanup")

var events = [
    Event({
        id: "1",
        type: "colingo-feed::course"
    }),
    Event({
        id: "2",
        type: "colingo-feed::course~lessons",
        name: "I am a lesson",
        parentId: ["1"]
    }),
    Event({
        id: "3",
        type: "colingo-feed::course~lessons~questions",
        name: "I am a question",
        parentId: ["1", "2"]
    }),
    Event({
        id: "4",
        type: "colingo-feed::course~lessons~questions~answer",
        name: "I am an answer",
        parentId: ["1", "2", "3"]
    })
]

test("map events", function (assert) {
    var res = map.call(events[0])

    assert.deepEqual(res, ["1", {
        id: "1",
        type: "colingo-feed::course",
        __lastTimestamp__: res[1].__lastTimestamp__
    }])

    var res2 = map.call(events[1])

    assert.deepEqual(res2, ["1", {
        __lastTimestamp__: res2[1].__lastTimestamp__,
        id: "1",
        lessons: [{
            id: "2",
            type: "colingo-feed::course~lessons",
            name: "I am a lesson",
            parentId: ["1"]
        }]
    }])

    var res3 = map.call(events[2])

    assert.deepEqual(res3, ["1", {
        __lastTimestamp__: res3[1].__lastTimestamp__,
        lessons: [{
            id: "2",
            questions: [{
                id: "3",
                type: "colingo-feed::course~lessons~questions",
                name: "I am a question",
                parentId: ["1", "2"]
            }]
        }]
    }])

    var res4 = map.call(events[3])

    assert.deepEqual(res4, ["1", {
        __lastTimestamp__: res4[1].__lastTimestamp__,
        lessons: [{
            id: "2",
            questions: [{
                id: "3",
                answer: [{
                    id: "4",
                    type: "colingo-feed::course~lessons~questions~answer",
                    name: "I am an answer",
                    parentId: ["1", "2", "3"]
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
        id: "1",
        type: "colingo-feed::course",
        __lastTimestamp__: result.__lastTimestamp__
    })

    var events2 = events.slice(0, 2).map(function (v) {
        return map.call(v)[1]
    })

    var result2 = reduce(null, events2)

    assert.deepEqual(result2, {
        id: "1",
        type: "colingo-feed::course",
        __lastTimestamp__: result2.__lastTimestamp__ ,
        lessons: [{
            id: "2",
            type: "colingo-feed::course~lessons",
            name: "I am a lesson",
            parentId: ["1"]
        }]
    })

    var events3 = events.slice(0, 3).map(function (v) {
        return map.call(v)[1]
    })

    var result3 = reduce(null, events3)

    assert.deepEqual(result3, {
        id: "1",
        type: "colingo-feed::course",
        __lastTimestamp__: result3.__lastTimestamp__,
        lessons: [{
            id: "2",
            type: "colingo-feed::course~lessons",
            name: "I am a lesson",
            parentId: ["1"],
            questions: [{
                id: "3",
                type: "colingo-feed::course~lessons~questions",
                name: "I am a question",
                parentId: ["1", "2"]
            }]
        }]
    })

    var events4 = events.map(function (v) {
        return map.call(v)[1]
    })

    var result4 = reduce(null, events4)

    assert.deepEqual(result4, {
        id: "1",
        type: "colingo-feed::course",
        __lastTimestamp__: result4.__lastTimestamp__,
        lessons: [{
            id: "2",
            type: "colingo-feed::course~lessons",
            name: "I am a lesson",
            parentId: ["1"],
            questions: [{
                id: "3",
                type: "colingo-feed::course~lessons~questions",
                name: "I am a question",
                parentId: ["1", "2"],
                answer: [{
                    id: "4",
                    type: "colingo-feed::course~lessons~questions~answer",
                    name: "I am an answer",
                    parentId: ["1", "2", "3"]
                }]
            }]
        }]
    })

    assert.end()
})

test("can reduce courses", function (assert) {
    var client = mongo("mongodb://localhost:27017/snapshot-reduce-tests")

    var input = client.collection("event-log")
    var output = client.collection("snapshot.colingo-feed::course")

    input.insert([
        Event({
            id: "1",
            type: "colingo-feed::course"
        }),
        Event({
            id: "2",
            type: "colingo-feed::course~lessons",
            name: "I am a lesson",
            parentId: ["1"]
        }),
        Event({
            id: "3",
            type: "colingo-feed::course~lessons~questions",
            name: "I am a question",
            parentId: ["1", "2"]
        }),
        Event({
            id: "4",
            type: "colingo-feed::course~lessons~questions~answer",
            name: "I am an answer",
            parentId: ["1", "2", "3"]
        })
    ], function (err, result) {
        assert.ifError(err)
        assert.equal(result.length, 4)

        snapshotReduce("colingo-feed::course", {
            inputCollection: input,
            outputCollection: output
        }, function (err, result) {
            assert.ifError(err)
            assert.ok(result)

            output.find().toArray(function (err, results) {
                assert.ifError(err)

                var result = results && results[0].value

                var questions = [{
                    id: "3",
                    type: "colingo-feed::course~lessons~questions",
                    name: "I am a question",
                    parentId: ["1", "2"],
                    answer: [{
                        id: "4",
                        type: "colingo-feed::course~lessons~questions~answer",
                        name: "I am an answer",
                        parentId: ["1", "2", "3"]
                    }]
                }]

                var expected = {
                    id: "1",
                    type: "colingo-feed::course",
                    __lastTimestamp__: result.__lastTimestamp__,
                    lessons: [{
                        id: "2",
                        type: "colingo-feed::course~lessons",
                        name: "I am a lesson",
                        parentId: ["1"],
                        questions: questions
                    }]
                }

                assert.deepEqual(result, expected)

                cleanup(client, input, output, function (err) {
                    assert.ifError(err)

                    assert.end()
                })
            })
        })
    })
})

function Event(value) {
    return {
        eventType: "add",
        timestamp: timestamp(),
        value: value
    }
}
