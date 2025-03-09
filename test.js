#!node

const _ = require('lodash');
const got = require('got');

program.requiredOption('--group <group>', 'the group which should be allowed access to the lockout');
program.option('--url <url>', 'the base URL of CiviCRM', 'https://archreactor.org/civicrm/ajax/api4/');
program.requiredOption('--key <key>', 'the CiviCRM key');
program.requiredOption('--apiKey <apiKey>', 'the CiviCRM API key');

program.parse();

const url = program.opts().url;
const key = program.opts().key;
const apiKey = program.opts().apiKey;
const groups = program.opts().group;

async function getMembersv4(url) {
  const params = new URLSearchParams({
    params: JSON.stringify({
      select: ['id', 'email_primary', 'display_name', 'Card_ID.new_card_id'],
      where: [['Card_ID.new_card_id', 'IS NOT EMPTY'], ['groups', 'IN', [groups.split(',')]]],
      orderBy: { display_name: 'ASC' },
    })
  });
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Civi-Auth' : 'Bearer ' + apiKey,
      'X-Civi-Key'  : key,
    },
    body: params.toString()
  };

  const response = await fetch(url, options).json();

  return response.values
    .map((val) => {
      const id = val.id
      const name = val.display_name;
      const email = val.email_primary;
      const cards = val['Card_ID.new_card_id'].split(',')
        .filter((card) => card.length > 0)
        .map((cardId) => cardId.toLowerCase());

      if (cards.length === 0) {
        console.error(`no cards found for ${name} - ${email}`);
      }

      return cards.map((card) => ({ id, name, email, card }))
    })
    .flat();
}

Promise.resolve()
  .then(async () => {

    members = await getMembersv4(url);

    console.log(members);
    // const members = (await Promise.all(groups.map((group) => {
    //   console.log(`fetching members for group ${group}`);
    //   return getGroupMembers(url, apiKey, group);
    // }))).flat()

    const allowedCards = `{${members.map((m) => `"${m.card}"`).join(',')}}`;
    const allowedNames = `{${members.map((m) => `"${m.name}"`).join(',')}}`;
    const allowedIds = `{${members.map((m) => `"${m.id}"`).join(',')}}`;


  })
  .catch((err) => {
    console.log('Error:');
    console.dir(err);
    process.exit(1);
  });