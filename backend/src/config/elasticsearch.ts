import { Client } from "@elastic/elasticsearch";

const elasticsearch = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
});

export default elasticsearch;