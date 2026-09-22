import { describe, expect, it } from "vitest";
import { GET, POST, PATCH, DELETE } from "../src/app/api/workspace/[resource]/route";

const context = { params: Promise.resolve({ resource: "templates" }) };

describe("workspace templates CRUD", () => {
  it("creates, updates, lists, and deletes note templates", async () => {
    // 1. Create
    const createReq = new Request("http://localhost/api/workspace/templates", {
      method: "POST",
      body: JSON.stringify({ name: "Test Template", content: "## Heading\n\nContent" }),
    });
    const createRes = await POST(createReq, context);
    expect(createRes.status).toBe(200);
    const createData = await createRes.json();
    expect(createData.id).toBeDefined();
    const templateId = createData.id;

    // 2. List
    const getRes = await GET(new Request("http://localhost/api/workspace/templates"), context);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    const found = getData.templates.find((t: { id: string }) => t.id === templateId);
    expect(found).toBeDefined();
    expect(found.name).toBe("Test Template");

    // 3. Patch (Rename & Update Content)
    const patchReq = new Request("http://localhost/api/workspace/templates", {
      method: "PATCH",
      body: JSON.stringify({
        id: templateId,
        name: "Renamed Template",
        content: "## Updated Heading",
      }),
    });
    const patchRes = await PATCH(patchReq, context);
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.updated).toBe(true);

    // Verify update
    const getRes2 = await GET(new Request("http://localhost/api/workspace/templates"), context);
    const getData2 = await getRes2.json();
    const updated = getData2.templates.find((t: { id: string }) => t.id === templateId);
    expect(updated.name).toBe("Renamed Template");
    expect(updated.content).toBe("## Updated Heading");

    // 4. Delete
    const deleteReq = new Request("http://localhost/api/workspace/templates", {
      method: "DELETE",
      body: JSON.stringify({ id: templateId }),
    });
    const deleteRes = await DELETE(deleteReq, context);
    expect(deleteRes.status).toBe(200);

    // Verify deletion
    const getRes3 = await GET(new Request("http://localhost/api/workspace/templates"), context);
    const getData3 = await getRes3.json();
    const afterDelete = getData3.templates.find((t: { id: string }) => t.id === templateId);
    expect(afterDelete).toBeUndefined();
  });
});
