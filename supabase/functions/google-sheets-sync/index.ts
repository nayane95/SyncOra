import { authorize, json, serve } from "../_shared/http.ts";
import { synchronize } from "../_shared/sheets.ts";
serve(async (req) => {
  const { userId } = await authorize(req, true);
  return json(await synchronize(userId));
});
