const simple = require("simple-mock");
const test = require("tap").test;

const homePath = `${__dirname}/../../src`;
const client = require(`${homePath}/client.js`);

test("Deduplicates arrays successfully", async t => {
  const array = [1, 2, "2", 3, "3", 3];
  t.deepIs(client.util.deduplicate(array), [1, 2, "2", 3, "3"]);
});

test("Fetches all pages successfully", async t => {
  const results = Array(101).fill(1);
  const request1 = simple.mock(client.issues, "getAll")
    .resolveWith({data: Array(100).fill(1)});

  const request2 = simple.mock(client, "hasNextPage")
    .returnWith(true)
    .returnWith(false);

  const request3 = simple.mock(client, "getNextPage")
    .resolveWith({data: [1]});

  const response = await client.util.getAllPages("issues.getAll", {key: "val"});
  t.is(request1.lastCall.arg.key, "val");
  t.is(request2.callCount, 2);
  t.deepIs(request3.lastCall.arg.data, Array(100).fill(1));
  t.deepIs(response, results);
});
