import { drizzle } from "drizzle-orm/sqlite-proxy";
import { schema, suppliers } from "../src/database/schema";
const captured: string[] = [];
const db = drizzle(async (s, p) => {
  captured.push(s + " | params=" + JSON.stringify(p));
  return { rows: [] };
}, { schema });
db.insert(suppliers)
  .values({ id: "x1", code: "C1", name: "n1" })
  .then(() => console.log(captured[0]));
