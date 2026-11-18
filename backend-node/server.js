
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

let tasks;

const PORT = process.env.PORT || 3000;


// Format task response
function formatTask(task) {
    const { _id, ...data } = task;

    return {
        id: _id.toString(),
        ...data
    };
}


// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});


// Get all tasks
app.get("/api/tasks", async (req, res) => {
    const { status, tag } = req.query;

    const filter = {};

    if (status === "open") {
        filter.done = false;
    } else if (status === "done") {
        filter.done = true;
    }

    if (tag) {
        filter.tags = tag;
    }

    const result = await tasks.find(filter).toArray();

    res.json(result.map(formatTask));
});


// Get one task
app.get("/api/tasks/:id", async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({
            error: "Invalid ID"
        });
    }

    const task = await tasks.findOne({
        _id: new ObjectId(id)
    });

    if (!task) {
        return res.status(404).json({
            error: "Task not found"
        });
    }

    res.json(formatTask(task));
});


// Create a task
app.post("/api/tasks", async (req, res) => {
    const data = req.body || {};

    if (
        typeof data.title !== "string" ||
        data.title.trim().length < 1 ||
        data.title.trim().length > 200
    ) {
        return res.status(400).json({
            error: "Title must be 1-200 characters"
        });
    }

    const task = {
        title: data.title.trim(),
        description: data.description ?? null,
        done: data.done ?? false,
        dueDate: data.dueDate ?? null,
        tags: data.tags ?? []
    };

    const result = await tasks.insertOne(task);

    res.status(201).json(
        formatTask({
            ...task,
            _id: result.insertedId
        })
    );
});


// Update a task
app.patch("/api/tasks/:id", async (req, res) => {
    const { id } = req.params;
    const data = req.body || {};

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({
            error: "Invalid ID"
        });
    }

    const updates = {};

    const fields = [
        "title",
        "description",
        "done",
        "dueDate",
        "tags"
    ];

    for (const field of fields) {
        if (data[field] !== undefined) {
            updates[field] = data[field];
        }
    }

    if (updates.title !== undefined) {
        if (
            typeof updates.title !== "string" ||
            updates.title.trim().length < 1 ||
            updates.title.trim().length > 200
        ) {
            return res.status(400).json({
                error: "Title must be 1-200 characters"
            });
        }

        updates.title = updates.title.trim();
    }

    const task = await tasks.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updates },
        { returnDocument: "after" }
    );

    if (!task) {
        return res.status(404).json({
            error: "Task not found"
        });
    }

    res.json(formatTask(task));
});


// Delete a task
app.delete("/api/tasks/:id", async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({
            error: "Invalid ID"
        });
    }

    const result = await tasks.deleteOne({
        _id: new ObjectId(id)
    });

    if (result.deletedCount === 0) {
        return res.status(404).json({
            error: "Task not found"
        });
    }

    res.status(204).send();
});


// Error handling
app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).json({
        error: "Internal server error"
    });
});


// Connect to MongoDB and start server
async function start() {
    await client.connect();

    const db = client.db(process.env.DB_NAME);

    tasks = db.collection("tasks");

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

start().catch(console.error);
