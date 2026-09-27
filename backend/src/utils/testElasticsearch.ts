import elasticsearch from "../config/elasticsearch";

async function test() {
  try {
    const response = await elasticsearch.info();

    console.log("Elasticsearch connected!");
    console.log(response);
  } catch (error) {
    console.error("Elasticsearch connection failed:", error);
  }
}

test();