# Comparing the Two Backends
## How storing tags differed

In my Flask and PostgreSQL backend, I stored tags in a `TEXT[]` column on the `tasks` table. I filtered tasks using `%s = ANY(tags)`, passing the tag separately as a query parameter. This kept the implementation simple because each task's tags could be saved and loaded with the rest of the row. Another relational approach would be separate `tags` and `task_tags` tables, joined to `tasks`, but that is not how this version is implemented.

In my Node.js and MongoDB backend, tags are an array inside each task document. I filtered them using `{ tags: tag }`, which matches documents containing that value in their tags array. Both backends store tags alongside the task, but PostgreSQL defines the array's type in the table schema, while my MongoDB code does not currently enforce that tags must be an array of strings.

## Adding a priority to every task

For PostgreSQL, I would add a `priority` column with a default such as `normal` and constraints allowing only `low`, `normal`, or `high`. I would write a migration for the existing database and update `schema.sql` for new setups. A default would give existing tasks a priority, and `NOT NULL` would prevent missing values. The Flask create and update routes would also need to accept and validate the field.

For MongoDB, I would add `priority` to newly created task documents and include it in the fields accepted by the update route. There is no table column to add, but existing documents would still need a backfill, such as an `updateMany` operation setting `normal` where priority is missing. I would validate the allowed values in the API and could also enforce them with a collection validator.

For both versions, I would update the React form and task display, add tests, and keep the API response shape consistent between the backends.

## Which stack I would choose

For a real Task Tracker product, I would choose Flask and PostgreSQL. Tasks, users, and ownership have clear relationships, and database constraints and foreign keys would help keep that data consistent. SQL would also be useful for reporting, such as counting completed tasks by user or priority. This choice fits the structure of this product rather than making PostgreSQL the best option for every application.

Node.js and MongoDB would also be a reasonable choice, especially for a team comfortable with JavaScript and an application whose task documents need different fields. Embedded arrays make tags straightforward, but flexible documents still need validation and a plan for updating existing data.
