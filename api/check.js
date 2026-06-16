// Vercel serverless function: GET /api/check
// Reads ANTHROPIC_KEY from the Vercel project's environment variables.

const { checkEndpoint, MODEL } = require("../lib/checkEndpoint");

module.exports = async (req, res) => {
  const result = await checkEndpoint();
  res.setHeader("cache-control", "no-store");
  res.status(200).json({ ...result, model: MODEL, time: new Date().toISOString() });
};
