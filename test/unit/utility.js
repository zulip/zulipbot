import nock from "nock";
import { test } from "tap";

import client from "../../src/client.js";

test("Deduplicates arrays successfully", async (t) => {
  const array = [1, 2, "2", 3, "3", 3];
  t.strictSame(client.util.deduplicate(array), [1, 2, "2", 3, "3"]);
});

test("Fetches all pages successfully", async (t) => {
  const results = Array.from({ length: 101 }).fill(1);

  const scope = nock("https://api.github.com")
    .get("/issues?key=val")
    .reply(200, Array.from({ length: 30 }).fill(1), {
      link: '<https://api.github.com/issues?key=val&page=2>; rel="next", <https://api.github.com/issues?key=val&page=4>; rel="last"',
    })
    .get("/issues?key=val&page=2")
    .reply(200, Array.from({ length: 30 }).fill(1), {
      link: '<https://api.github.com/issues?key=val&page=1>; rel="prev", <https://api.github.com/issues?key=val&page=3>; rel="next", <https://api.github.com/issues?key=val&page=4>; rel="last", <https://api.github.com/issues?key=val&page=1>; rel="first"',
    })
    .get("/issues?key=val&page=3")
    .reply(200, Array.from({ length: 30 }).fill(1), {
      link: '<https://api.github.com/issues?key=val&page=2>; rel="prev", <https://api.github.com/issues?key=val&page=4>; rel="next", <https://api.github.com/issues?key=val&page=4>; rel="last", <https://api.github.com/issues?key=val&page=1>; rel="first"',
    })
    .get("/issues?key=val&page=4")
    .reply(200, Array.from({ length: 11 }).fill(1), {
      link: '<https://api.github.com/issues?key=val&page=3>; rel="prev", <https://api.github.com/issues?key=val&page=1>; rel="first"',
    });

  const response = await client.util.getAllPages("issues.list", { key: "val" });
  t.strictSame(response, results);

  scope.done();
});
