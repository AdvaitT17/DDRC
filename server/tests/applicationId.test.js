const {
  generateNextApplicationId,
} = require("../utils/applicationId");

describe("generateNextApplicationId", () => {
  test("generates next sequential id for the same month", async () => {
    const mockConn = {
      query: jest.fn().mockResolvedValue([[{ last_num: 60 }]]),
    };

    const result = await generateNextApplicationId(
      mockConn,
      new Date("2026-04-15T00:00:00.000Z")
    );

    expect(result).toBe("2026-04-0061");
    expect(mockConn.query).toHaveBeenCalledTimes(1);
    const [sql, params] = mockConn.query.mock.calls[0];
    expect(sql).toContain("status = 'completed'");
    expect(params).toEqual(["2026-04-%"]);
  });

  test("starts from 0001 when no completed registrations exist for month", async () => {
    const mockConn = {
      query: jest.fn().mockResolvedValue([[{ last_num: 0 }]]),
    };

    const result = await generateNextApplicationId(
      mockConn,
      new Date("2026-04-15T00:00:00.000Z")
    );

    expect(result).toBe("2026-04-0001");
  });

  test("resets sequence for a new month", async () => {
    const mockConn = {
      query: jest.fn().mockResolvedValue([[{ last_num: 0 }]]),
    };

    const result = await generateNextApplicationId(
      mockConn,
      new Date("2026-05-01T00:00:00.000Z")
    );

    expect(result).toBe("2026-05-0001");
  });
});
