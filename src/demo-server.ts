import express, { Express, Request, Response } from "express";
import path from "path";
import { AppService } from "./demo-state";

export function createDemoApp(service: AppService): Express {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/api/status", (_req: Request, res: Response) => {
    res.json(service.getStatus());
  });

  app.get("/api/issued", (_req: Request, res: Response) => {
    const state = service.getIssuedState();
    if (!state) {
      res.status(404).json({ error: "no credential issued yet" });
      return;
    }
    res.json(state);
  });

  app.post("/api/issue", async (req: Request, res: Response) => {
    try {
      const { degreeField, graduationYear, transcript } = req.body;

      if (!degreeField || !graduationYear || !Array.isArray(transcript) || transcript.length === 0) {
        res.status(400).json({ error: "degreeField, graduationYear, and transcript[] are required" });
        return;
      }

      const state = await service.issue(
        String(degreeField),
        Number(graduationYear),
        transcript.map((c: any) => ({
          courseCode: String(c.courseCode),
          courseName: String(c.courseName),
          grade: String(c.grade)
        }))
      );

      res.json(state);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "issue failed" });
    }
  });

  app.post("/api/disclose", (req: Request, res: Response) => {
    try {
      const courseCode = String(req.body?.courseCode ?? "");
      const presentation = service.discloseCourse(courseCode);
      res.json(presentation);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "course not found" });
    }
  });

  app.post("/api/verify", async (req: Request, res: Response) => {
    try {
      const result = await service.verifyPresentation(req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "verification failed" });
    }
  });

  app.post("/api/revoke", async (_req: Request, res: Response) => {
    try {
      const txHash = await service.revokeCredential();
      res.json({ revoked: true, txHash });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "revoke failed" });
    }
  });

  app.post("/api/reset", (_req: Request, res: Response) => {
    service.reset();
    res.json({ reset: true });
  });

  return app;
}

async function main(): Promise<void> {
  const service = await AppService.create();
  const app = createDemoApp(service);
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(`Demo running at http://localhost:${port}`);
    console.log(`Contract: ${service.getStatus().contractAddress}`);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
