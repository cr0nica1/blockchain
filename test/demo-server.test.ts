import { expect } from "chai";
import request from "supertest";
import { createDemoState } from "../src/demo-state";
import { createDemoApp } from "../src/demo-server";

describe("Demo state", function () {
  it("creates issued credential metadata", async function () {
    const demo = await createDemoState();
    const state = demo.getPublicState();

    expect(state.credential.issuer).to.equal(state.universityAddress);
    expect(state.credential.degreeField).to.equal("Computer Science");
    expect(state.transcript).to.have.length(3);
    expect(state.signature).to.match(/^0x[0-9a-f]+$/i);
  });

  it("discloses one course with a Merkle proof", async function () {
    const demo = await createDemoState();
    const presentation = demo.discloseCourse("SEC301");

    expect(presentation.disclosedCourse.courseCode).to.equal("SEC301");
    expect(presentation.merkleProof.length).to.be.greaterThan(0);
    expect(presentation.credential.transcriptRoot).to.equal(demo.getPublicState().credential.transcriptRoot);
  });

  it("rejects unknown course disclosure", async function () {
    const demo = await createDemoState();

    expect(() => demo.discloseCourse("UNKNOWN")).to.throw("course not found");
  });
});

describe("Demo API", function () {
  async function app() {
    return createDemoApp(await createDemoState());
  }

  it("returns public demo state", async function () {
    const response = await request(await app()).get("/api/demo-state").expect(200);

    expect(response.body.credential.degreeField).to.equal("Computer Science");
    expect(response.body.transcript.map((course: { courseCode: string }) => course.courseCode)).to.deep.equal([
      "CS101",
      "MATH201",
      "SEC301"
    ]);
  });

  it("discloses and verifies a selected course", async function () {
    const server = await app();
    const disclosure = await request(server)
      .post("/api/disclose")
      .send({ courseCode: "SEC301" })
      .expect(200);

    expect(disclosure.body.disclosedCourse.courseCode).to.equal("SEC301");

    const verification = await request(server)
      .post("/api/verify")
      .send(disclosure.body)
      .expect(200);

    expect(verification.body.valid).to.equal(true);
    expect(verification.body.checks).to.deep.equal({
      signatureValid: true,
      issuerAuthorized: true,
      notRevoked: true,
      merkleProofValid: true
    });
  });

  it("returns 404 for unknown course", async function () {
    const response = await request(await app())
      .post("/api/disclose")
      .send({ courseCode: "UNKNOWN" })
      .expect(404);

    expect(response.body.error).to.equal("course not found");
  });

  it("fails verification after revocation", async function () {
    const server = await app();
    const disclosure = await request(server)
      .post("/api/disclose")
      .send({ courseCode: "CS101" })
      .expect(200);

    await request(server).post("/api/revoke").expect(200);

    const verification = await request(server)
      .post("/api/verify")
      .send(disclosure.body)
      .expect(200);

    expect(verification.body.valid).to.equal(false);
    expect(verification.body.checks.notRevoked).to.equal(false);
  });
});
