const { getContainer, normalizeTeam, pairId, toClientRecord } = require('../shared/cosmos');

module.exports = async function leaderboard(context, req) {
  try {
    if (req.method === 'GET') {
      context.res = await getLeaderboard();
      return;
    }

    if (req.method === 'POST') {
      context.res = await saveWin(req.body);
      return;
    }

    if (req.method === 'DELETE') {
      context.res = await clearLeaderboard(req);
      return;
    }

    context.res = { status: 405, body: { message: 'Method not allowed.' } };
  } catch (error) {
    context.log.error(error);
    context.res = {
      status: error.statusCode || 500,
      body: { message: error.message || 'Leaderboard request failed.' }
    };
  }
};

async function getLeaderboard() {
  const container = await getContainer();
  const { resources } = await container.items
    .query({
      query: 'SELECT c.player1, c.player2, c.totalWins FROM c WHERE c.type = @type ORDER BY c.totalWins DESC',
      parameters: [{ name: '@type', value: 'winRecord' }]
    })
    .fetchAll();

  return { status: 200, body: resources };
}

async function saveWin(body = {}) {
  const winner = normalizeTeam(body.winner);
  const id = pairId(winner);
  const container = await getContainer();
  const item = container.item(id, 'winRecord');

  try {
    const { resource } = await item.read();
    if (!resource) {
      return await createWinRecord(container, id, winner);
    }

    const nextRecord = {
      ...resource,
      totalWins: Number(resource.totalWins || 0) + 1,
      updatedAt: new Date().toISOString()
    };
    const { resource: saved } = await item.replace(nextRecord);
    return { status: 200, body: toClientRecord(saved) };
  } catch (error) {
    if (error.code !== 404) throw error;
    return await createWinRecord(container, id, winner);
  }
}

async function createWinRecord(container, id, winner) {
  const record = {
    id,
    type: 'winRecord',
    player1: winner[0],
    player2: winner[1],
    totalWins: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const { resource: saved } = await container.items.create(record);
  return { status: 201, body: toClientRecord(saved) };
}

async function clearLeaderboard(req) {
  const expectedPassword = process.env.ADMIN_CLEAR_PASSWORD;
  const providedPassword = req.headers['x-admin-password'] || req.body?.password;

  if (!expectedPassword) {
    return { status: 500, body: { message: 'ADMIN_CLEAR_PASSWORD is not configured.' } };
  }

  if (!providedPassword || providedPassword !== expectedPassword) {
    return { status: 401, body: { message: 'Incorrect admin password.' } };
  }

  const container = await getContainer();
  const { resources } = await container.items
    .query({
      query: 'SELECT c.id FROM c WHERE c.type = @type',
      parameters: [{ name: '@type', value: 'winRecord' }]
    })
    .fetchAll();

  await Promise.all(resources.map((record) => container.item(record.id, 'winRecord').delete()));
  return { status: 200, body: { message: 'Leaderboard cleared.' } };
}
