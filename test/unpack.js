var test = require("tape")
var uuid = require("node-uuid")

var ts = Date.now()

var unpackSnapshot = require("../unpack")

test("can merge snapshot and raw data", function (assert) {
    var groupId = uuid()
    var memberOne = uuid()
    var memberTwo = uuid()

    var snapshot = {
        title: "a",
        id: groupId,
        type: "colingo-group",
        members: [{
            name: "b",
            id: memberOne,
            type: "colingo-group~members",
            imageUri: "b",
            parentId: [groupId]
        }, {
            name: "c",
            id: memberTwo,
            type: "colingo-group~members",
            imageUri: "c",
            parentId: [groupId]
        }]
    }

    var list = unpackSnapshot(snapshot)

    assert.deepEqual(list, [{
        eventType: "add",
        timestamp: 0,
        value: {
            title: "a",
            id: groupId,
            type: "colingo-group"
        }
    }, {
        eventType: "add",
        timestamp: 0,
        value: {
            name: "b",
            id: memberOne,
            type: "colingo-group~members",
            imageUri: "b",
            parentId: [groupId]
        }
    }, {
        eventType: "add",
        timestamp: 0,
        value: {
            name: "c",
            id: memberTwo,
            type: "colingo-group~members",
            imageUri: "c",
            parentId: [groupId]
        }
    }])

    assert.end()
})

test("can unpack snapshot recursively", function (assert) {
    var events = [
        Event({
            id: "1",
            type: "colingo-feed::course",
            __lastTimestamp__: ts
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
    var snapshot = {
        id: "1",
        type: "colingo-feed::course",
        __lastTimestamp__: ts,
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
    }

    var list = unpackSnapshot(snapshot)

    assert.deepEqual(list, events)
    assert.end()
})

function Event(value) {
    return {
        eventType: "add",
        timestamp: ts,
        value: value
    }
}
