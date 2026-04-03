const MAX_ID_GENERATION_RETRIES = 5;

async function generateNextApplicationId(conn, date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const prefix = `${year}-${month}`;

  const [maxIdResult] = await conn.query(
    `SELECT COALESCE(
        MAX(CAST(SUBSTRING_INDEX(application_id, '-', -1) AS UNSIGNED)),
        0
      ) AS last_num
     FROM registration_progress
     WHERE status = 'completed'
       AND application_id REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{4}$'
       AND application_id LIKE ? FOR UPDATE`,
    [`${prefix}-%`]
  );

  const lastNum = parseInt(maxIdResult[0]?.last_num || 0, 10);
  const appNum = String(lastNum + 1).padStart(4, "0");

  return `${prefix}-${appNum}`;
}

module.exports = {
  generateNextApplicationId,
  MAX_ID_GENERATION_RETRIES,
};
