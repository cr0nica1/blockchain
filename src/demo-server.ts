import express, { Express } from "express";
import path from "path";
import { createDemoState, DemoState } from "./demo-state";

export function createDemoApp(demo: DemoState): Express {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/api/demo-state", (_req, res) => {
    res.json(demo.getPublicState());
  });

  app.post("/api/disclose", (req, res) => {
    try {
      const courseCode = String(req.body?.courseCode ?? "");
      const presentation = demo.discloseCourse(courseCode);
      res.json(presentation);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "course not found" });
    }
  });

  app.post("/api/verify", async (req, res) => {
    try {
      const result = await demo.verifyPresentation(req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "invalid presentation" });
    }
  });

  app.post("/api/revoke", (_req, res) => {
    demo.revokeCredential();
    res.json({ revoked: true });
  });

  return app;
}

async function main(): Promise<void> {
  const app = createDemoApp(await createDemoState());
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(`Demo running at http://localhost:${port}`);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
