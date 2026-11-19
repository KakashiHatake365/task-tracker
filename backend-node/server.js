const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("node:path");

function validateTask(data, partial = false) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw Object.assign(new Error("Invalid JSON"), { status: 400 });
    }
    const fields = ["title", "description", "done", "dueDate", "tags"];
    const task = Object.fromEntries(fields.filter(key => Object.hasOwn(data, key))
        .map(key => [key, data[key]]));
    function invalid(message) {
        throw Object.assign(new Error(message), { status: 400 });
    }
    if (!partial || Object.hasOwn(task, "title")) {
        if (typeof task.title !== "string" || [...task.title.trim()].length < 1 ||
            [...task.title.trim()].length > 200) invalid("Title must be 1-200 characters");
        task.title = task.title.trim();
    }
    if (Object.hasOwn(task, "description") && task.description !== null &&
        typeof task.description !== "string") invalid("Description must be text or null");
    if (Object.hasOwn(task, "done") && typeof task.done !== "boolean") {
        invalid("Done must be true or false");
    }
    if (Object.hasOwn(task, "tags") && (!Array.isArray(task.tags) ||
        !task.tags.every(tag => typeof tag === "string"))) invalid("Tags must be a list of text");
    if (Object.hasOwn(task, "dueDate") && task.dueDate !== null) {
        const value = task.dueDate;
        const parsed = typeof value === "string" ? new Date(`${value}T00:00:00.000Z`) : null;
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
            value.startsWith("0000-") || !Number.isFinite(parsed.getTime()) ||
            parsed.toISOString().slice(0, 10) !== value) {
            invalid("Due date must be a valid YYYY-MM-DD date or null");
        }
    }
    return task;
}

function publicUser(user) {
    return { id: user._id.toString(), email: user.email };
}

function formatTask(task) {
    const { _id, ...data } = task;
    return { ...data, id: _id.toString() };
}

function createApp({ db, jwtSecret, bcryptRounds = 12 }) {
    if (typeof jwtSecret !== "string" || !jwtSecret.trim()) {
        throw new Error("JWT_SECRET_KEY is not configured");
    }
    const app = express();
    const tasks = db.collection("tasks");
    const users = db.collection("users");
    app.use(cors());
    app.use(express.json());

    async function requireAuth(req, res, next) {
        const parts = (req.get("Authorization") || "").trim().split(/\s+/);
        if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
            return res.status(401).json({ error: "Authentication required" });
        }
        let payload;
        try {
            payload = jwt.verify(parts[1], jwtSecret, { algorithms: ["HS256"] });
            if (!payload || typeof payload.sub !== "string" ||
                !/^[a-fA-F0-9]{24}$/.test(payload.sub) ||
                !Number.isFinite(payload.exp) || !Number.isFinite(payload.iat) ||
                payload.iat > Date.now() / 1000) {
                return res.status(401).json({ error: "Invalid token" });
            }
        } catch {
            return res.status(401).json({ error: "Invalid or expired token" });
        }
        const user = await users.findOne({ _id: new ObjectId(payload.sub) });
        if (!user) return res.status(401).json({ error: "Invalid token" });
        req.user = publicUser(user);
        next();
    }

    app.get("/api/health", (req, res) => res.json({ status: "ok" }));

    app.post("/api/auth/register", async (req, res) => {
        const data = req.body;
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            return res.status(400).json({ error: "Invalid JSON" });
        }
        if (typeof data.email !== "string" || !data.email.trim()) {
            return res.status(400).json({ error: "Email is required" });
        }
        if (typeof data.password !== "string" || !data.password) {
            return res.status(400).json({ error: "Password is required" });
        }
        const email = data.email.trim().toLowerCase();
        if (!email.includes("@")) {
            return res.status(400).json({ error: "Enter a valid email address" });
        }
        if (Buffer.byteLength(data.password, "utf8") > 72) {
            return res.status(400).json({ error: "Password must be between 1 and 72 bytes" });
        }
        const passwordHash = await bcrypt.hash(data.password, bcryptRounds);
        try {
            const result = await users.insertOne({ email, passwordHash, createdAt: new Date() });
            res.status(201).json(publicUser({ _id: result.insertedId, email }));
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({ error: "Email is already registered" });
            }
            throw error;
        }
    });

    app.post("/api/auth/login", async (req, res) => {
        const data = req.body;
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            return res.status(400).json({ error: "Invalid JSON" });
        }
        if (typeof data.email !== "string" || typeof data.password !== "string" ||
            !data.password || Buffer.byteLength(data.password, "utf8") > 72) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        const user = await users.findOne({ email: data.email.trim().toLowerCase() });
        if (!user || !await bcrypt.compare(data.password, user.passwordHash)) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        const token = jwt.sign({}, jwtSecret, {
            algorithm: "HS256", subject: user._id.toString(), expiresIn: "1h",
        });
        res.json({ token });
    });

    app.get("/api/auth/me", requireAuth, (req, res) => res.json(req.user));
    app.use("/api/tasks", requireAuth);

    app.get("/api/tasks", async (req, res) => {
        const { status, tag, q } = req.query;
        if ([status, tag, q].some(value => value !== undefined && typeof value !== "string")) {
            return res.status(400).json({ error: "Filters must be text" });
        }
        const filter = { userId: req.user.id };
        if (status === "open") filter.done = false;
        if (status === "done") filter.done = true;
        if (tag) filter.tags = tag;
        if (q && q.trim()) {
            const pattern = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const search = new RegExp(pattern, "i");
            filter.$or = [{ title: search }, { description: search }];
        }
        const result = await tasks.find(filter).toArray();
        res.json(result.map(formatTask));
    });

    // Every lookup includes the authenticated owner, never an owner from the body.
    function ownedTask(req, res, next) {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid ID" });
        }
        req.taskFilter = { _id: new ObjectId(req.params.id), userId: req.user.id };
        next();
    }

    app.get("/api/tasks/:id", ownedTask, async (req, res) => {
        const task = await tasks.findOne(req.taskFilter);
        if (!task) return res.status(404).json({ error: "Task not found" });
        res.json(formatTask(task));
    });

    app.post("/api/tasks", async (req, res) => {
        const data = validateTask(req.body);
        const task = {
            title: data.title, description: data.description ?? null,
            done: data.done ?? false, dueDate: data.dueDate ?? null,
            tags: data.tags ?? [], userId: req.user.id,
        };
        const result = await tasks.insertOne(task);
        res.status(201).json(formatTask({ ...task, _id: result.insertedId }));
    });

    app.patch("/api/tasks/:id", ownedTask, async (req, res) => {
        const updates = validateTask(req.body, true);
        const task = await tasks.findOneAndUpdate(req.taskFilter, { $set: updates },
            { returnDocument: "after" });
        if (!task) return res.status(404).json({ error: "Task not found" });
        res.json(formatTask(task));
    });

    app.delete("/api/tasks/:id", ownedTask, async (req, res) => {
        const result = await tasks.deleteOne(req.taskFilter);
        if (!result.deletedCount) return res.status(404).json({ error: "Task not found" });
        res.status(204).send();
    });

    app.use((req, res) => res.status(404).json({ error: "Not found" }));
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        const status = Number.isInteger(error.status) && error.status >= 400 &&
            error.status < 500 ? error.status : 500;
        if (error.type === "entity.parse.failed") {
            return res.status(400).json({ error: "Invalid JSON" });
        }
        if (status === 500) {
            // Log the error type, not request bodies, hashes, tokens, or database URLs.
            console.error("Database or server operation failed:", error.name);
        }
        res.status(status).json({ error: status === 500 ? "Internal server error" : error.message });
    });
    return app;
}

async function start() {
    require("dotenv").config({ path: path.join(__dirname, ".env") });
    if (!process.env.JWT_SECRET_KEY) throw new Error("JWT_SECRET_KEY is not configured");
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        await db.collection("users").createIndex({ email: 1 }, { unique: true });
        await db.collection("tasks").createIndex({ userId: 1 });
        const app = createApp({ db, jwtSecret: process.env.JWT_SECRET_KEY });
        return app.listen(process.env.PORT || 3000, () => {
            console.log("Task API server started");
        });
    } catch (error) {
        await client.close();
        throw error;
    }
}

if (require.main === module) {
    start().catch(error => {
        console.error("Startup failed; check MongoDB and JWT configuration:", error.name);
        process.exitCode = 1;
    });
}

module.exports = { createApp };
