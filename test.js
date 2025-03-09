#!node

const _ = require('lodash');
const got = require('got');
const { Command } = require('commander');
const civicrm = require('civicrm');

const program = new Command();
program.requiredOption('--group <group>', 'the group which should be allowed access to the lockout');
program.option('--url <url>', 'the base URL of the website', 'https://archreactor.org');
program.option('--path <path>', 'the path of the CiviCRM v4 API', '/civicrm/ajax/api4');
program.requiredOption('--key <key>', 'the CiviCRM key');
program.requiredOption('--apiKey <apiKey>', 'the CiviCRM API key');

program.parse();

const url = program.opts().url;
const apipath = program.opts().path;
const key = program.opts().key;
const apiKey = program.opts().apiKey;
const groups = program.opts().group;

const civicAPI = civicrm({
  server: url,
  path: apipath,
  api_key: apiKey,
  key: key,
});

const members = civicAPI.get('Contact', {
  select: ['id', 'email_primary.email', 'display_name', 'Card_ID.new_card_id'],
  where: [['Card_ID.new_card_id', 'IS NOT EMPTY'], ['groups', 'IN', groups.split(',')]],
  orderBy: { display_name: 'ASC' },
}).then((res) => {
  let members = res.values.map((val) => {
    const id = val.id
    const name = val.display_name;
    const email = val['email_primary.email'];
    const cards = val['Card_ID.new_card_id'].split(',')
      .filter((card) => card.length > 0)
      .map((cardId) => cardId.toLowerCase());

    if (cards.length === 0) {
      console.error(`no cards found for ${name} - ${email}`);
    }

    return cards.map((card) => ({ id, name, email, card }));
  })
  .flat();    //return res;

  const allowedCards = `{${members.map((m) => `"${m.card}"`).join(',')}}`;
  const allowedNames = `{${members.map((m) => `"${m.name}"`).join(',')}}`;
  const allowedIds = `{${members.map((m) => `"${m.id}"`).join(',')}}`;

  console.log(allowedCards, allowedNames, allowedIds);
}).catch((err) => {
  console.log(err);
});
