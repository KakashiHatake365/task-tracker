const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { createApp } = require("../server");

const secret = "test-only-node-signing-key-never-use-in-production";

// An isolated collection double exercises the HTTP API without touching MongoDB.
function memoryDatabase() {
    const collections = new Map();
    function matches(document, filter) {
        return Object.entries(filter).every(([key, value]) => {
            if (key === "$or") return value.some(part => matches(document, part));
            const actual = document[key];
            if (value instanceof RegExp) return typeof actual === "string" && value.test(actual);
            if (value instanceof ObjectId) return actual?.toString() === value.toString();
            if (Array.isArray(actual)) return actual.includes(value);
            return actual === value;
        });
    }
    return {
        collection(name) {
            if (!collections.has(name)) {
                const rows = [];
                collections.set(name, {
                    async insertOne(document) {
                        if (name === "users" && rows.some(row => row.email === document.email)) {
                            throw Object.assign(new Error("Duplicate email"), { code: 11000 });
                        }
                        const insertedId = new ObjectId();
                        rows.push({ ...document, _id: insertedId });
                        return { insertedId };
                    },
                    async findOne(filter) {
                        const row = rows.find(row => matches(row, filter));
                        return row ? { ...row } : null;
                    },
                    find(filter) {
                        return { toArray: async () => rows.filter(row => matches(row, filter))
                            .map(row => ({ ...row })) };
                    },
                    async findOneAndUpdate(filter, update) {
                        const row = rows.find(row => matches(row, filter));
                        if (!row) return null;
                        Object.assign(row, update.$set);
                        return { ...row };
                    },
                    async deleteOne(filter) {
                        const index = rows.findIndex(row => matches(row, filter));
                        if (index < 0) return { deletedCount: 0 };
                        rows.splice(index, 1);
                        return { deletedCount: 1 };
                    },
                });
            }
            return collections.get(name);
        },
    };
}

async function setup(t) {
    const db = memoryDatabase();
    const app = createApp({ db, jwtSecret: secret, bcryptRounds: 4 });
    const server = await new Promise(resolve => {
        const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    t.after(() => new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeIdleConnections();
    }));
    async function request(method, path, token, body, raw = false) {
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        if (body !== undefined) headers["Content-Type"] = "application/json";
        const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
            method, headers, body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
        });
        const text = await response.text();
        return { status: response.status, type: response.headers.get("content-type"),
            body: text ? JSON.parse(text) : null, text };
    }
    return { db, request };
}

async function account(request, email = "a@example.invalid") {
    const credentials = { email, password: "Practice-password-123!" };
    const registered = await request("POST", "/api/auth/register", null, credentials);
    assert.equal(registered.status, 201);
    const login = await request("POST", "/api/auth/login", null, credentials);
    assert.equal(login.status, 200);
    return { user: registered.body, token: login.body.token, credentials };
}

test("registration, hashing, duplicate email, login and current user", async t => {
    const { db, request } = await setup(t);
    const a = await account(request);
    assert.deepEqual(Object.keys(a.user).sort(), ["email", "id"]);
    const stored = await db.collection("users").findOne({ email: a.user.email });
    assert.notEqual(stored.passwordHash, a.credentials.password);
    assert.equal(await bcrypt.compare(a.credentials.password, stored.passwordHash), true);
    assert.equal((await request("POST", "/api/auth/register", null, a.credentials)).status, 409);
    assert.deepEqual((await request("GET", "/api/auth/me", a.token)).body, a.user);
    for (const email of [a.user.email, "missing@example.invalid"]) {
        const bad = await request("POST", "/api/auth/login", null, { email, password: "wrong" });
        assert.equal(bad.status, 401);
        assert.deepEqual(bad.body, { error: "Invalid email or password" });
    }
});

test("all task routes require a token while health remains public", async t => {
    const { request } = await setup(t);
    assert.equal((await request("GET", "/api/health")).status, 200);
    for (const [method, path] of [["GET", "/api/tasks"], ["GET", "/api/tasks/123"],
        ["POST", "/api/tasks"], ["PATCH", "/api/tasks/123"], ["DELETE", "/api/tasks/123"]]) {
        assert.equal((await request(method, path, null)).status, 401);
    }
});

test("invalid, expired, wrong-signature and incomplete tokens are rejected", async t => {
    const { request } = await setup(t);
    const a = await account(request);
    const tokens = ["invalid-token",
        jwt.sign({}, secret, { subject: a.user.id, expiresIn: -1 }),
        jwt.sign({}, "different-test-only-key", { subject: a.user.id, expiresIn: "1h" }),
        jwt.sign({}, secret, { subject: a.user.id }),
        jwt.sign({}, secret, { subject: a.user.id, expiresIn: "1h", noTimestamp: true }),
        jwt.sign({}, secret, { subject: a.user.id, expiresIn: "1h", algorithm: "HS384" })];
    for (const token of tokens) {
        assert.equal((await request("GET", "/api/tasks", token)).status, 401);
    }
});

test("task owners can create, read, edit and delete; other users cannot", async t => {
    const { db, request } = await setup(t);
    const a = await account(request);
    const b = await account(request, "b@example.invalid");
    // Unassigned legacy tasks are preserved but must not become public.
    await db.collection("tasks").insertOne({ title: "Legacy", done: false, tags: [] });
    const created = await request("POST", "/api/tasks", a.token, {
        title: " Private task ", userId: b.user.id, user_id: b.user.id, tags: ["work"],
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.userId, a.user.id);
    assert.equal(created.body.title, "Private task");
    const path = `/api/tasks/${created.body.id}`;
    assert.deepEqual((await request("GET", path, a.token)).body, created.body);
    assert.equal((await request("GET", "/api/tasks", a.token)).body.length, 1);
    assert.deepEqual((await request("GET", "/api/tasks", b.token)).body, []);
    for (const method of ["GET", "PATCH", "DELETE"]) {
        const denied = await request(method, path, b.token,
            method === "PATCH" ? { title: "Stolen" } : undefined);
        assert.equal(denied.status, 404);
    }
    const edited = await request("PATCH", path, a.token, { done: true, userId: b.user.id });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.done, true);
    assert.equal(edited.body.userId, a.user.id);
    assert.equal((await request("DELETE", path, a.token)).status, 204);
    assert.equal((await request("GET", path, a.token)).status, 404);
});

const invalidFields = [{ done: null }, { done: 123 }, { done: "false" },
    { tags: null }, { tags: "work" }, { tags: [1] }, { description: {} },
    { dueDate: "2026-02-30" }, { dueDate: "2026-99-99" }, { dueDate: 123 },
    { dueDate: "0000-01-01" }, { dueDate: "20261201" }];

test("create and patch reject malformed fields without changing tasks", async t => {
    const { request } = await setup(t);
    const a = await account(request);
    for (const fields of invalidFields) {
        assert.equal((await request("POST", "/api/tasks", a.token,
            { title: "Rejected", ...fields })).status, 400);
    }
    assert.deepEqual((await request("GET", "/api/tasks", a.token)).body, []);
    const created = await request("POST", "/api/tasks", a.token, { title: "Original" });
    for (const fields of invalidFields) {
        assert.equal((await request("PATCH", `/api/tasks/${created.body.id}`, a.token,
            fields)).status, 400);
    }
    assert.deepEqual((await request("GET", `/api/tasks/${created.body.id}`, a.token)).body,
        created.body);
    const leap = await request("PATCH", `/api/tasks/${created.body.id}`, a.token,
        { dueDate: "2028-02-29", description: null });
    assert.equal(leap.status, 200);
    assert.equal(leap.body.dueDate, "2028-02-29");
    assert.equal((await request("PATCH", `/api/tasks/${created.body.id}`, a.token,
        { dueDate: null })).body.dueDate, null);
});

test("search is literal, private and combines with status and tag", async t => {
    const { request } = await setup(t);
    const a = await account(request);
    const b = await account(request, "b@example.invalid");
    const first = await request("POST", "/api/tasks", a.token,
        { title: "Learn [%]_ Flask", tags: ["work"] });
    await request("POST", "/api/tasks", a.token,
        { title: "Other", description: "learn APIs", done: true, tags: ["work"] });
    await request("POST", "/api/tasks", b.token,
        { title: "Learn [%]_ private", tags: ["work"] });
    for (const q of ["[", "%", "_", "[%]_"]) {
        const result = await request("GET", `/api/tasks?q=${encodeURIComponent(q)}`, a.token);
        assert.equal(result.status, 200);
        assert.deepEqual(result.body.map(task => task.id), [first.body.id]);
    }
    const filtered = await request("GET", "/api/tasks?q=LEARN&status=open&tag=work", a.token);
    assert.deepEqual(filtered.body.map(task => task.id), [first.body.id]);
    assert.equal((await request("GET", "/api/tasks?q=learn", a.token)).body.length, 2);
    assert.equal((await request("GET", "/api/tasks?q=%20%20", a.token)).body.length, 2);
    assert.deepEqual((await request("GET", "/api/tasks?q=nomatch", a.token)).body, []);
});

test("invalid JSON, missing routes and invalid IDs return JSON client errors", async t => {
    const { request } = await setup(t);
    const a = await account(request);
    for (const [method, path, body, raw, expected] of [
        ["POST", "/api/tasks", '{"title":', true, 400],
        ["POST", "/api/tasks", [], false, 400],
        ["GET", "/api/tasks/bad-id", undefined, false, 400],
        ["GET", "/missing", undefined, false, 404],
        ["POST", "/api/tasks", { title: "x".repeat(110000) }, false, 413],
    ]) {
        const result = await request(method, path, a.token, body, raw);
        assert.equal(result.status, expected);
        assert.match(result.type, /application\/json/);
        assert.equal(typeof result.body.error, "string");
    }
});

test("a database failure returns a safe generic 500", async t => {
    const { db, request } = await setup(t);
    const a = await account(request);
    t.mock.method(console, "error", () => {});
    db.collection("tasks").find = () => { throw new Error("Private database details"); };
    const failed = await request("GET", "/api/tasks", a.token);
    assert.equal(failed.status, 500);
    assert.deepEqual(failed.body, { error: "Internal server error" });
});

test("the app refuses to start without a signing key", () => {
    assert.throws(() => createApp({ db: memoryDatabase(), jwtSecret: "" }), /JWT_SECRET_KEY/);
});
