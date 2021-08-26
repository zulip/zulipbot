"use strict";

const simple = require("simple-mock");
const test = require("tap").test;

const client = require("../../src/client.js");

test("Deduplicates arrays successfully", async (t) => {
  const array = [1, 2, "2", 3, "3", 3];
  t.strictSame(client.util.deduplicate(array), [1, 2, "2", 3, "3"]);
});

test("Fetches all pages successfully", async (t) => {
  const results = Array.from({ length: 101 }).fill(1);
  const request1 = simple
    .mock(client.issues.list.endpoint, "merge")
    .returnWith({ key: "val", endpoint: "GET /test" });
  const request2 = simple
    .mock(client, "paginate")
    .resolveWith(Array.from({ length: 101 }).fill(1));

  const response = await client.util.getAllPages("issues.list", { key: "val" });
  t.equal(request1.lastCall.arg.key, "val");
  t.equal(request2.lastCall.arg.key, "val");
  t.equal(request2.lastCall.arg.endpoint, "GET /test");
  t.strictSame(response, results);
});
