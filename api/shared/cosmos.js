const { CosmosClient } = require('@azure/cosmos');

const databaseId = process.env.COSMOS_DATABASE_NAME || 'pickleball';
const containerId = process.env.COSMOS_CONTAINER_NAME || 'leaderboard';

let containerPromise;

async function getContainer() {
  if (!process.env.COSMOS_CONNECTION_STRING) {
    throw new Error('COSMOS_CONNECTION_STRING is not configured.');
  }

  if (!containerPromise) {
    const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
    containerPromise = client.databases
      .createIfNotExists({ id: databaseId })
      .then(({ database }) => database.containers.createIfNotExists({
        id: containerId,
        partitionKey: { paths: ['/type'] }
      }))
      .then(({ container }) => container);
  }

  return containerPromise;
}

function normalizeTeam(players) {
  if (!Array.isArray(players) || players.length !== 2) {
    throw new Error('Winner must include exactly two players.');
  }

  const cleaned = players
    .map((player) => String(player || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  if (cleaned.length !== 2 || cleaned[0] === cleaned[1]) {
    throw new Error('Winner must include two unique player names.');
  }

  return cleaned;
}

function pairId(players) {
  return normalizeTeam(players).join('|').toLowerCase();
}

function toClientRecord(record) {
  return {
    player1: record.player1,
    player2: record.player2,
    totalWins: record.totalWins
  };
}

module.exports = {
  getContainer,
  normalizeTeam,
  pairId,
  toClientRecord
};
