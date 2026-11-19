## 2026-11-19: Task search

### Feature and plan

Add an optional q parameter to Flask's GET /api/tasks endpoint and connect a React search field. Match titles and descriptions without case sensitivity, treat % and _ literally, and preserve ownership, status, and tag filtering.


### Review and correction

The first search test failed because the backend ignored q and returned an unrelated task. The implementation uses strpos with lower and handles missing descriptions with COALESCE. Query values are passed separately from SQL.

A frontend approach that appended created tasks or retained edited tasks could show entries that did not match the active search. This was corrected by reloading the matching list from Flask after task mutations. Requests for old searches are cancelled, and search resets on login and logout.

### Verification

- All 18 Flask API tests passed against task_tracker_test.
- Coverage includes title and description matching, no matches, empty queries, literal % and _, combined filters, and user isolation.
- React lint and production build passed.
- Browser checks are pending confirmation: title/description searches, no matches, clearing filters, combined filters, and results after mutations.


## 2026-11-19: Review fixes

- Added strict task-field validation to both APIs. Invalid types and dates return
  400 on creation and updates; null is rejected for done and tags.
- Flask framework errors now use JSON while preserving HTTP status and headers.
- Test configuration accepts environment variables and initializes the app with
  test-only settings before import. Verified authentication tests with local
  dotenv loading disabled and no application signing key supplied.
- Added bcrypt accounts, expiring JWT verification, and owner-scoped task routes
  to Node, including literal search and safe client/server error responses.
- Added Node dependencies, run/test commands, setup documentation, and a public
  environment template. Generated a local Node signing key in its ignored .env.
- Removed diagnostic count queries and obsolete connection comments from schema.sql.
- Verification: 51 Flask tests passed on the separate test database; 9 Node HTTP
  API tests passed using isolated collection doubles; frontend lint passed.
- Live MongoDB integration and browser interaction checks remain outstanding.
